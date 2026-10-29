const { app, BrowserWindow, ipcMain, shell, nativeImage, Tray, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Packaged: spawn the bundled yt-dlp.exe directly.
// Development: use the same executable from youtube-dl-exec so both builds
// resolve streams with identical options.
const ytDlpBinary = app.isPackaged
  ? path.join(process.resourcesPath, 'yt-dlp', 'yt-dlp.exe')
  : undefined;

const { execFile, spawn } = require('child_process');
const crypto = require('crypto');

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
      'ytsearch3:' + query,
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

function minimumFullDuration(expectedDuration) {
  const duration = Number(expectedDuration || 0);
  if (duration > 0 && duration < 45) return 20;
  if (duration >= 45) return Math.max(45, Math.floor(Math.min(duration * 0.6, 90)));
  return 60;
}

function pickSearchResult(raw, expectedDuration) {
  const entries = raw && raw._type === 'playlist' ? (raw.entries || []) : [raw];
  const minDuration = minimumFullDuration(expectedDuration);
  const playable = entries.filter((entry) => entry &&
    Number(entry.duration || 0) >= minDuration &&
    (entry.formats || []).some((format) => format.acodec !== 'none' && format.url));
  if (playable.length === 0) return null;
  const expected = Number(expectedDuration || 0);
  if (expected > 0) {
    playable.sort((a, b) => Math.abs(Number(a.duration) - expected) - Math.abs(Number(b.duration) - expected));
  }
  return playable[0];
}

async function findFullAudioTarget(query, expectedDuration) {
  const info = pickSearchResult(await ytSearch(query), expectedDuration);
  if (!info) return null;
  return {
    url: info.webpage_url || info.original_url || (info.id ? 'https://www.youtube.com/watch?v=' + info.id : null),
    duration: Number(info.duration || expectedDuration || 0),
  };
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
let miniWindow = null;
let tray = null;
let isQuitting = false;
let lastMiniPlayerState = {};

/* ---------- Oturumluk geçici tam şarkı önbelleği ---------- */
const temporaryAudioCache = new Map(); // normalized query -> { filePath, duration }
const temporaryAudioJobs = new Map();
let temporaryAudioDir = null;

function normalizeQuery(query) {
  return String(query || '').trim().toLocaleLowerCase('tr-TR');
}

function getTemporaryAudioDir() {
  if (temporaryAudioDir) return temporaryAudioDir;
  const systemTemp = path.resolve(app.getPath('temp'));
  const cacheRoot = path.resolve(systemTemp, 'lpotify-audio-cache');
  if (path.dirname(cacheRoot) !== systemTemp) throw new Error('Geçersiz geçici klasör');
  fs.mkdirSync(cacheRoot, { recursive: true });

  // Önceki çökmelerden kalmış bir günden eski oturum klasörlerini temizle.
  for (const item of fs.readdirSync(cacheRoot, { withFileTypes: true })) {
    if (!item.isDirectory() || !item.name.startsWith('session-')) continue;
    const candidate = path.resolve(cacheRoot, item.name);
    if (path.dirname(candidate) !== cacheRoot) continue;
    try {
      const stat = fs.statSync(candidate);
      if (Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000) {
        fs.rmSync(candidate, { recursive: true, force: true });
      }
    } catch { /* sonraki açılışta tekrar denenir */ }
  }

  temporaryAudioDir = path.join(cacheRoot, 'session-' + process.pid + '-' + Date.now());
  fs.mkdirSync(temporaryAudioDir, { recursive: true });
  return temporaryAudioDir;
}

function cleanupTemporaryAudio() {
  if (!temporaryAudioDir) return;
  const cacheRoot = path.resolve(app.getPath('temp'), 'lpotify-audio-cache');
  const candidate = path.resolve(temporaryAudioDir);
  if (path.dirname(candidate) !== cacheRoot || !path.basename(candidate).startsWith('session-')) return;
  try { fs.rmSync(candidate, { recursive: true, force: true }); } catch { /* Windows kapanışta kilitleyebilir */ }
  temporaryAudioDir = null;
  temporaryAudioCache.clear();
}

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

function createLocalAudioUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const token = crypto.randomBytes(12).toString('hex');
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  streams.set(token, { filePath, ext });
  if (streams.size > 100) {
    const first = streams.keys().next().value;
    streams.delete(first);
  }
  return 'http://127.0.0.1:' + proxyPort + '/stream?t=' + token;
}

function localAudioContentType(ext) {
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'webm') return 'audio/webm';
  if (ext === 'ogg' || ext === 'opus') return 'audio/ogg';
  if (ext === 'flac') return 'audio/flac';
  if (ext === 'wav') return 'audio/wav';
  return 'audio/mp4';
}

function parseLocalByteRange(value, total) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(value || '').trim());
  if (!match || total <= 0) return null;
  const startText = match[1];
  const endText = match[2];
  if (!startText && !endText) return null;

  let start;
  let end;
  if (!startText) {
    // M4A/MP4 oynatıcıları metadata için sıklıkla "son N bayt" ister.
    const suffixLength = Math.min(Number(endText), total);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = total - suffixLength;
    end = total - 1;
  } else {
    start = Number(startText);
    end = endText ? Math.min(Number(endText), total - 1) : total - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= total || end < start) {
    return null;
  }
  return { start, end };
}

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
        'Content-Type': localAudioContentType(entry.ext),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      };
      if (range) {
        const parsedRange = parseLocalByteRange(range, total);
        if (!parsedRange) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + total });
          return res.end();
        }
        const { start, end } = parsedRange;
        headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + total;
        headers['Content-Length'] = end - start + 1;
        res.writeHead(206, headers);
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(entry.filePath, { start, end }).pipe(res);
      } else {
        headers['Content-Length'] = total;
        res.writeHead(200, headers);
        if (req.method === 'HEAD') return res.end();
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
      backgroundThrottling: false,
    },
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && miniWindow && !miniWindow.isDestroyed()) {
      event.preventDefault();
      mainWindow.hide();
      createTray();
    }
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

function appIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon.png');
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
  mainWindow.restore();
  mainWindow.focus();
}

function createTray() {
  if (tray) return tray;
  const icon = nativeImage.createFromPath(appIconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Lpotify');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Lpotify’ı Aç', click: showMainWindow },
    { label: 'Mini Oynatıcıyı Göster', click: () => createMiniWindow() },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', showMainWindow);
  return tray;
}

function notifyMiniVisibility(visible) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini-player-visibility-changed', visible);
  }
}

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show();
    miniWindow.focus();
    return miniWindow;
  }
  miniWindow = new BrowserWindow({
    width: 380,
    height: 190,
    minWidth: 330,
    minHeight: 170,
    maxHeight: 260,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    backgroundColor: '#171717',
    icon: appIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  miniWindow.setAlwaysOnTop(true, 'floating');
  miniWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  miniWindow.loadFile(path.join(__dirname, 'mini-player.html'));
  miniWindow.webContents.on('did-finish-load', () => {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.webContents.send('mini-player-state', lastMiniPlayerState);
    }
  });
  miniWindow.on('closed', () => {
    miniWindow = null;
    notifyMiniVisibility(false);
  });
  notifyMiniVisibility(true);
  return miniWindow;
}

/**
 * "Sanatçı - Şarkı" sorgusunu YouTube'da arar, doğrudan SES akışının
 * URL'sini döndürür. Bu akış reklam sunucusundan geçmez → tam şarkı,
 * reklam yok.
 */
ipcMain.handle('resolve-audio', async (_event, payload) => {
  try {
    const query = typeof payload === 'string' ? payload : String(payload?.query || '');
    const expectedDuration = typeof payload === 'string' ? 0 : Number(payload?.duration || 0);
    if (!query.trim()) return null;
    const temporary = temporaryAudioCache.get(normalizeQuery(query));
    if (temporary && fs.existsSync(temporary.filePath)) {
      return {
        url: createLocalAudioUrl(temporary.filePath),
        title: query,
        duration: temporary.duration || 0,
        thumbnail: '',
        ext: path.extname(temporary.filePath).slice(1) || 'm4a',
      };
    }
    const pendingTemporary = temporaryAudioJobs.get(normalizeQuery(query));
    if (pendingTemporary) {
      const prepared = await pendingTemporary;
      if (prepared?.url) {
        return {
          url: prepared.url,
          title: query,
          duration: prepared.duration || expectedDuration,
          thumbnail: '',
          ext: 'm4a',
        };
      }
    }
    const info = pickSearchResult(await ytSearch(query), expectedDuration);
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
    const token = crypto.randomBytes(12).toString('hex');
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

/* Öne Çıkanlar parçalarını tam dosya olarak oturumluk klasöre hazırlar. */
ipcMain.handle('cache-audio-temporarily', async (_event, payload) => {
  const query = String(payload?.query || '').trim();
  const duration = Number(payload?.duration || 0);
  if (!query) return null;
  const key = normalizeQuery(query);
  const cached = temporaryAudioCache.get(key);
  if (cached && fs.existsSync(cached.filePath)) {
    return { url: createLocalAudioUrl(cached.filePath), duration: cached.duration || duration };
  }
  if (temporaryAudioJobs.has(key)) return temporaryAudioJobs.get(key);

  const job = (async () => {
    const binary = ytDlpBinary || devYtDlpPath();
    if (!binary || !fs.existsSync(binary)) return null;
    const target = await findFullAudioTarget(query, duration);
    if (!target?.url) return null;
    const id = crypto.createHash('sha1').update(key).digest('hex');
    const outTemplate = path.join(getTemporaryAudioDir(), id + '.%(ext)s');
    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-o', outTemplate,
      '--no-warnings',
      '--no-check-certificates',
      '--no-playlist',
      '--print', 'after_move:__LP_FILE__%(filepath)s',
      '--print', 'after_move:__LP_DURATION__%(duration)s',
      '--no-simulate',
      target.url,
    ];
    const filePath = await new Promise((resolve, reject) => {
      execFile(binary, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(err);
        const lines = String(stdout).split(/\r?\n/);
        const line = lines.find((value) => value.startsWith('__LP_FILE__'));
        const durationLine = lines.find((value) => value.startsWith('__LP_DURATION__'));
        resolve(line ? {
          filePath: line.slice('__LP_FILE__'.length).trim(),
          duration: Number(durationLine?.slice('__LP_DURATION__'.length).trim() || target.duration || duration),
        } : null);
      });
    });
    if (!filePath?.filePath || !fs.existsSync(filePath.filePath)) return null;
    temporaryAudioCache.set(key, filePath);
    return { url: createLocalAudioUrl(filePath.filePath), duration: filePath.duration || duration };
  })().catch((err) => {
    console.error('temporary audio cache failed:', err.message);
    return null;
  }).finally(() => temporaryAudioJobs.delete(key));

  temporaryAudioJobs.set(key, job);
  return job;
});

/* ---------- Şarkıyı "download mp" klasörüne gerçek dosya olarak indir ---------- */
ipcMain.handle('download-audio', async (event, payload) => {
  const { query, fileName, trackId, duration } = payload || {};
  try {
    const binary = ytDlpBinary || devYtDlpPath();
    if (!binary) {
      return { ok: false, error: 'yt-dlp bulunamadı' };
    }
    const dir = getDownloadsDir();
    const target = await findFullAudioTarget(query, duration);
    if (!target?.url) return { ok: false, error: 'Tam uzunlukta şarkı bulunamadı' };
    const outTemplate = path.join(dir, safeFileName(fileName || '%(title)s') + '.%(ext)s');
    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-o', outTemplate,
      '--no-warnings',
      '--no-check-certificates',
      '--no-playlist',
      '--newline',
      '--progress',
      '--progress-template', 'download:__LP_PROGRESS__%(progress._percent_str)s',
      '--print', 'after_move:__LP_FILE__%(filepath)s',
      '--no-simulate',
      target.url,
    ];
    const filePath = await new Promise((resolve, reject) => {
      const child = spawn(binary, args, { windowsHide: true });
      let output = '';
      let errors = '';
      let progressBuffer = '';
      const handleProgress = (chunk) => {
        progressBuffer += String(chunk);
        const lines = progressBuffer.split(/\r?\n/);
        progressBuffer = lines.pop() || '';
        for (const line of lines) {
          const match = /__LP_PROGRESS__\s*([\d.]+)%/.exec(line);
          if (match && trackId && !event.sender.isDestroyed()) {
            const percent = Math.max(0, Math.min(100, Math.round(Number(match[1]))));
            event.sender.send('download-progress', { trackId, percent });
          }
        }
      };
      child.stdout.on('data', (chunk) => { output += String(chunk); handleProgress(chunk); });
      child.stderr.on('data', (chunk) => { errors += String(chunk); handleProgress(chunk); });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) return reject(new Error(errors.trim() || 'yt-dlp çıkış kodu: ' + code));
        const line = output.split(/\r?\n/).find((value) => value.startsWith('__LP_FILE__'));
        resolve(line ? line.slice('__LP_FILE__'.length).trim() : null);
      });
    });
    if (!filePath) return { ok: false, error: 'Dosya yolu alınamadı' };
    if (trackId && !event.sender.isDestroyed()) {
      event.sender.send('download-progress', { trackId, percent: 100 });
    }
    return { ok: true, filePath, dir, url: createLocalAudioUrl(filePath) };
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
    return createLocalAudioUrl(filePath);
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

ipcMain.handle('toggle-mini-player', () => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.close();
    return false;
  }
  createMiniWindow();
  return true;
});

ipcMain.handle('close-mini-player', () => {
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close();
  return true;
});

ipcMain.on('mini-player-state', (_event, state) => {
  lastMiniPlayerState = state && typeof state === 'object' ? state : {};
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.webContents.send('mini-player-state', lastMiniPlayerState);
  }
});

ipcMain.on('mini-player-action', (event, action) => {
  // Mini pencerenin komutlarını yalnızca ana oynatıcıya ilet.
  if (miniWindow && event.sender === miniWindow.webContents && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini-player-action', action);
  }
});

app.whenReady().then(() => {
  // Görev çubuğu sağ tık menüsünde Electron logosu yerine Lpotify ikonu görünsün.
  if (process.platform === 'win32') app.setAppUserModelId('com.lpotify.app');
  startProxy();
  createWindow();
});
app.on('before-quit', () => {
  isQuitting = true;
  cleanupTemporaryAudio();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
app.on('window-all-closed', () => {
  if (!tray && !miniWindow) app.quit();
});
app.on('activate', () => {
  showMainWindow();
});
