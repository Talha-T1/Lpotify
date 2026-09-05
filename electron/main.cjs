const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Packaged: spawn the bundled yt-dlp.exe directly (no node module needed).
// Dev: use youtube-dl-exec package.
const ytDlpBinary = app.isPackaged
  ? path.join(process.resourcesPath, 'yt-dlp', 'yt-dlp.exe')
  : undefined;

const { execFile } = require('child_process');

// Yt-dlp arama sonuçları önbelleği: aynı şarkı tekrar açıldığında
// YouTube araması beklenmeden anında akış verilir (yükleme hızlanır).
const ytCache = new Map(); // query -> { info, at }
const YT_CACHE_TTL = 30 * 60 * 1000; // 30 dk

function ytSearch(query) {
  const cached = ytCache.get(query);
  if (cached && Date.now() - cached.at < YT_CACHE_TTL) {
    return Promise.resolve(cached.info);
  }
  return new Promise((resolve, reject) => {
    if (ytDlpBinary) {
      execFile(ytDlpBinary, ['ytsearch1:' + query, '--dump-single-json', '--no-warnings',
        // Android istemcisi imza çözümlemesi gerektirmez → çok daha hızlı sonuç.
        '--extractor-args', 'youtube:player_client=android,web_safari',
      ], {
        maxBuffer: 64 * 1024 * 1024,
      }, (err, stdout) => {
        if (err) return reject(err);
        try {
          const info = JSON.parse(stdout);
          ytCache.set(query, { info, at: Date.now() });
          resolve(info);
        } catch (e) { reject(e); }
      });
    } else {
      try {
        // lazy require so a missing dev package never crashes packaged apps
        const ytdl = require('youtube-dl-exec');
        ytdl('ytsearch1:' + query, { dumpSingleJson: true, noWarnings: true })
          .then((info) => {
            ytCache.set(query, { info, at: Date.now() });
            resolve(info);
          }, reject);
      } catch (e) { reject(e); }
    }
  });
}

// yt-dlp çalıştırılabilir dosyası (geliştirme modu için).
function devYtDlpPath() {
  try {
    const p = path.join(process.cwd(), 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp.exe');
    return fs.existsSync(p) ? p : null;
  } catch { return null; }
}

/* ---------- "download mp" indirme klasörü ---------- */
let downloadsDir = null;
function getDownloadsDir() {
  if (!downloadsDir) {
    downloadsDir = path.join(app.getPath('music'), 'download mp');
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  return downloadsDir;
}

// Windows'ta dosya adında kullanılamayan karakterleri temizler.
function safeFileName(name) {
  return String(name).replace(/[<>:"/\\|?*]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);
}

let mainWindow = null;

/* ---------- Yerel ses proxy sunucusu ----------
 * googlevideo URL'leri doğrudan <audio> ile çekildiğinde
 * header/UA kısıtları nedeniyle kesilebilir. Akışı ana süreçte
 * doğru başlıklarla köprüleyerek sorunsuz, tam uzunlukta çalar.
 */
const streams = new Map(); // token -> { url, headers }
let proxyServer = null;
let proxyPort = 0;

function startProxy() {
  proxyServer = http.createServer((req, res) => {
    const token = new URL(req.url, 'http://x').searchParams.get('t');
    const entry = token && streams.get(token);
    if (!entry) {
      res.writeHead(404);
      return res.end('not found');
    }
    // Yerel dosya ("download mp" klasörü): doğrudan diskten, Range destekli sun.
    if (entry.filePath) {
      const stat = fs.statSync(entry.filePath);
      const total = stat.size;
      const range = req.headers.range;
      const headers = {
        'Content-Type': entry.ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
        'Accept-Ranges': 'bytes',
      };
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m && m[1] ? parseInt(m[1], 10) : 0;
        const end = m && m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
        headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + total;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        fs.createReadStream(entry.filePath, { start, end }).pipe(res);
      } else {
        headers['Content-Length'] = total;
        res.writeHead(200, headers);
        fs.createReadStream(entry.filePath).pipe(res);
      }
      req.on('close', () => {});
      return;
    }
    const headers = {
      'User-Agent': entry.headers['User-Agent'] || 'Mozilla/5.0',
      ...(entry.headers['Range'] ? { Range: req.headers.range } : {}),
    };
    const upstream = require('https').request(entry.url, { headers }, (uRes) => {
      res.writeHead(uRes.statusCode || 500, {
        'Content-Type': uRes.headers['content-type'] || 'audio/mp4',
        ...(uRes.headers['content-length'] ? { 'Content-Length': uRes.headers['content-length'] } : {}),
        ...(uRes.headers['content-range'] ? { 'Content-Range': uRes.headers['content-range'] } : {}),
        'Accept-Ranges': 'bytes',
      });
      uRes.pipe(res);
    });
    upstream.on('error', () => {
      try { res.destroy(); } catch {}
    });
    req.on('close', () => upstream.destroy());
    upstream.end();
  }).listen(0, '127.0.0.1', () => {
    proxyPort = proxyServer.address().port;
  });
}

function createWindow() {
  // Paketlenmiş uygulamada ikon resources içine kopyalanır; geliştirmede build/ klasöründen alınır.
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    icon: require('fs').existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Prod: built files. Dev: Vite dev server (fallback to dist).
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000/').catch(() => {
      mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    });
  }
}

/**
 * "Sanatçı - Şarkı" sorgusunu YouTube'da arar, doğrudan SES akışının
 * URL'sini döndürür. Bu akış reklam sunucusundan geçmez → tam şarkı,
 * reklam yok.
 */
ipcMain.handle('resolve-audio', async (_event, query) => {
  try {
    let info = await ytSearch(query);
    // ytsearch even with "1" can wrap results in a playlist object
    if (info && info._type === 'playlist') info = (info.entries || [])[0];
    // İlk sonuç sesli format vermediyse listedeki diğer sonucu dene.
    if (info && !((info.formats || []).some((f) => f.acodec !== 'none' && f.url))) {
      const cached = ytCache.get(query);
      const raw = cached ? cached.info : null;
      const alt = raw && raw._type === 'playlist' ? (raw.entries || [])[1] : null;
      if (alt && (alt.formats || []).some((f) => f.acodec !== 'none' && f.url)) {
        info = alt;
      }
    }
    if (!info) return null;

    const formats = (info.formats || []).filter((f) => f.acodec !== 'none' && f.url);
    if (formats.length === 0) return null;

    // Önce salt sesli formatlar (vcodec none); hiç yoksa sesi olan herhangi
    // bir formatı kullan — 30 sn önizlemeye düşmekten kurtarır.
    let pool = formats.filter((f) => f.vcodec === 'none');
    if (pool.length === 0) pool = formats;
    pool.sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
    const best = pool[0];

    // Stream through the local proxy so playback never falls back to a 30s preview.
    const token = require('crypto').randomBytes(12).toString('hex');
    streams.set(token, { url: best.url, headers: info.http_headers || {} });
    // keep map small
    if (streams.size > 100) {
      const first = streams.keys().next().value;
      streams.delete(first);
    }

    return {
      url: 'http://127.0.0.1:' + proxyPort + '/stream?t=' + token,
      title: info.title,
      duration: info.duration || 0,
      thumbnail: info.thumbnail || '',
      ext: best.ext || 'm4a',
    };
  } catch (err) {
    console.error('yt-dlp resolve failed:', err.message);
    return null;
  }
});

/* ---------- Şarkıyı "download mp" klasörüne gerçek dosya olarak indir ---------- */
ipcMain.handle('download-audio', async (_event, payload) => {
  const { query, fileName } = payload || {};
  try {
    const binary = ytDlpBinary || devYtDlpPath();
    if (!binary) {
      return { ok: false, error: 'yt-dlp bulunamadı' };
    }
    const dir = getDownloadsDir();
    const outTemplate = path.join(dir, safeFileName(fileName || '%(title)s') + '.%(ext)s');
    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-o', outTemplate,
      '--no-warnings',
      '--no-playlist',
      '--print', 'after_move:filepath',
      '--no-simulate',
      'ytsearch1:' + query,
    ];
    const filePath = await new Promise((resolve, reject) => {
      execFile(binary, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(err);
        const lines = String(stdout).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        resolve(lines.length ? lines[lines.length - 1] : null);
      });
    });
    if (!filePath) return { ok: false, error: 'Dosya yolu alınamadı' };
    return { ok: true, filePath, dir };
  } catch (err) {
    console.error('download failed:', err.message);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-downloads-dir', () => {
  try { return getDownloadsDir(); } catch { return null; }
});

// Yerel ses dosyasını uygulama içinden güvenle çalmak için proxy adresi üret.
ipcMain.handle('local-audio-url', (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const token = require('crypto').randomBytes(12).toString('hex');
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    streams.set(token, { filePath, ext });
    if (streams.size > 100) {
      const first = streams.keys().next().value;
      streams.delete(first);
    }
    return 'http://127.0.0.1:' + proxyPort + '/stream?t=' + token;
  } catch {
    return null;
  }
});

ipcMain.handle('open-downloads-folder', () => {
  try { shell.openPath(getDownloadsDir()); return true; } catch { return false; }
});

app.whenReady().then(() => {
  // Görev çubuğu sağ tık menüsünde Electron logosu yerine Lpotify ikonu görünsün.
  if (process.platform === 'win32') app.setAppUserModelId('com.lpotify.app');
  startProxy();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
