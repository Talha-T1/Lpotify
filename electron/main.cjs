const { app, BrowserWindow, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Packaged: spawn the bundled yt-dlp.exe directly.
// Development: use the same executable from youtube-dl-exec so both builds
// resolve streams with identical options.
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
    const binary = ytDlpBinary || devYtDlpPath();
    if (!binary || !fs.existsSync(binary)) return reject(new Error('yt-dlp bulunamadı'));
    execFile(binary, [
      'ytsearch1:' + query,
      '--dump-single-json',
      '--no-warnings',
      '--no-playlist',
      // Antivirus HTTPS inspection can otherwise make resolution fail while
      // the same song still downloads through a different network backend.
      '--no-check-certificates',
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

/* ---------- Windows görev çubuğu küçük önizleme düğmeleri ---------- */
const taskbarIconData = {
  heart: 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAFlSURBVEhL7ZWhcgJBEESRkZHIyMjIyMhIJJJPQCJxkUgkn4CMjIyMjIxEInHdVF/NpmYb7g6OisuT27MzvXsze6PRP7cC4JnkguRDXid5T3JJ8iWv9xIbFwDeARwYAPgpRRQD4KtooX8CeCP56DkrAKzyxkwUefLkGWme8xeS4+IawAbAVGuRdG+JDgBe48QTMzbx3A0l6JyLXKQk9xgA27b9lfs2B1Fkdy65kN56iugUVf+uBIPkna9l1ByRZ1sJJGch7CrhSlKBVSXY8caVeAXpO01dk9j5DfrQnCSTp/OgYQlx6dolyJg2y6hrDalNd7oy17uILmwGUEZdb7Be37e1oxP7NOVlRk7vv6C7K8HBzGMyeuyyqYseP3/M9Ih5jFDx9LTI1OmHbUMDVUY/EmzykJXBDE1mhrU2gHVK9BGnU7GyJhOd090LgHlKmP8Ra48djDrDks895mb0+4wZGTTpf8IRAUesnTafJqUAAAAASUVORK5CYII=',
  liked: 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAD4SURBVEhL7dQ9EgFBEIZhodARhEKhIwiFQqHQEdzAERzBMYRCoVAolL2temvQ+9mxPyVQypOZ7f5m1vZur/f39cxsaGZjXXe+7td1vRYwBbbAyZ4WscZ/3y94XaqfxppKZtYHziE4KjaJ4VHq62tmCbDSxshPqmuR92vmQ83pG3l7F7lbbwtYanbBH5IWd1QaiAczG2hlR5VjXZDRbA24amYJsNOmNoC9Zpb4A9Kmltaa+aLuXcgBNpqVBcz9/9SQnOxovgNMgIuGRekQM+1tzMxGuclKm+dHsil/P4CDhB87fapz0neqGGEfRd9Uaz4ijXH1x+wn3QD36pQym/QoiwAAAABJRU5ErkJggg==',
  prev: 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAADOSURBVEhL7ZSxDcIwEEVTUlIyAiUlZUrGYAzKdIzBGIxASckIlJR07yNHTnRy7MQxDRJ5kpt/X36SdXJVLfwfkmpJjT91OE8haR1mUfzFHU04D3EXA5ecbsscAbAHnjndnhyBpBVwNr1kd8CUQNIWuJtOshtlTCDpBLzN3FIukLQBriaPUSaQtANeJktRJnAZcDDbkqJc4HO372PP9J3AzI+JJxt0o0wJHH5Vb6aX7A7IEXS4tc3t9swROPx38cjptpT8pu7rcOsc5gu/wQe8xTIVcGGSAgAAAABJRU5ErkJggg==',
  play: 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAACZSURBVEhL7dSxDYMwEEZhRqBkjJSMkDEYJZtkjIxEyQbvR5Zs6XRKjIUvEgVfacu8u4ZhuF2apMmfhZL0Aj5/C6WAJAGbpMXfdyuBInwbH8iRuG2+BYqQbWqBpHubo0BxepvWQJK3efhvVLUGgBV4+veHWgLAW9Lo3zapBU5Pbf0KdE1t+UDI1JYNhE1t5b9p7NQWMIdPffN2gg7JERf3KusAAAAASUVORK5CYII=',
  pause: 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABdSURBVEhL7dShEQAgDARBSqO0dP4YRNyCQ7AzqJu8ZIzvWUlmkmpv3nTaR13ddNKAOmlAnTSgThpQJw2okwbUSQPqpAF10oA6aUCdNKBOGlAnDaiTBtRJ/736d2wBxN97x6hDfmMAAAAASUVORK5CYII=',
  next: 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAC/SURBVEhL7ZSxDcIwEEVTUlIyAiUlZUrGYAzKdIzBGIyQERiBkpLufXSSjaKTg5Ft0ZAnufF9+0nW+bpu4X+RtPF7c0jqJQ1h9b6exMLA9RtRuDgy+HqSeAh4AAdfn1IliAAXSWufM5oIDOAG7DPZckEEOH/I1gsMYJS0TWTbCAzgOWnRSBuBdZekYyJbLwjP8/4fzQThSU6ZbJnAWlTSzueMaoG1paSVz0SKBcA9NyaMIoH92LnR4Cmapgs/4wVgizaKY99qpwAAAABJRU5ErkJggg==',
};
const taskbarIcons = new Map();

function getTaskbarIcon(name) {
  if (!taskbarIcons.has(name)) {
    taskbarIcons.set(name, nativeImage.createFromDataURL('data:image/png;base64,' + taskbarIconData[name]));
  }
  return taskbarIcons.get(name);
}

function sendPlayerAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('taskbar-player-action', action);
  }
}

function updateTaskbarButtons(state = {}) {
  if (process.platform !== 'win32' || !mainWindow || mainWindow.isDestroyed()) return;
  if (!state.hasTrack) {
    mainWindow.setThumbarButtons([]);
    return;
  }
  mainWindow.setThumbarButtons([
    {
      tooltip: state.isLiked ? 'Favorilerden çıkar' : 'Favorilere ekle',
      icon: getTaskbarIcon(state.isLiked ? 'liked' : 'heart'),
      click: () => sendPlayerAction('toggle-like'),
    },
    { tooltip: 'Önceki şarkı', icon: getTaskbarIcon('prev'), click: () => sendPlayerAction('previous') },
    {
      tooltip: state.isPlaying ? 'Duraklat' : 'Oynat',
      icon: getTaskbarIcon(state.isPlaying ? 'pause' : 'play'),
      click: () => sendPlayerAction('play-pause'),
    },
    { tooltip: 'Sonraki şarkı', icon: getTaskbarIcon('next'), click: () => sendPlayerAction('next') },
  ]);
}

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
    const sourceHeaders = entry.headers || {};
    const headers = {
      'User-Agent': sourceHeaders['User-Agent'] || sourceHeaders['user-agent'] || 'Mozilla/5.0',
      'Accept': sourceHeaders.Accept || sourceHeaders.accept || '*/*',
      ...(sourceHeaders.Referer || sourceHeaders.referer ? { Referer: sourceHeaders.Referer || sourceHeaders.referer } : {}),
      ...(sourceHeaders.Origin || sourceHeaders.origin ? { Origin: sourceHeaders.Origin || sourceHeaders.origin } : {}),
      ...(req.headers.range ? { Range: req.headers.range } : {}),
    };
    const protocol = new URL(entry.url).protocol === 'http:' ? require('http') : require('https');
    const upstream = protocol.request(entry.url, {
      method: req.method,
      headers,
      // Limited to the media URL returned by yt-dlp. This keeps playback
      // working behind antivirus HTTPS inspection without changing Electron globally.
      rejectUnauthorized: false,
    }, (uRes) => {
      res.writeHead(uRes.statusCode || 500, {
        'Content-Type': uRes.headers['content-type'] || 'audio/mp4',
        ...(uRes.headers['content-length'] ? { 'Content-Length': uRes.headers['content-length'] } : {}),
        ...(uRes.headers['content-range'] ? { 'Content-Range': uRes.headers['content-range'] } : {}),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
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

    const formats = (info.formats || []).filter((f) =>
      f.acodec !== 'none' && f.url && (f.protocol === 'https' || f.protocol === 'http')
    );
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
      '--no-check-certificates',
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

ipcMain.on('taskbar-player-state', (_event, state) => {
  updateTaskbarButtons(state);
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
