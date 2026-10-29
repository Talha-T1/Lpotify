/**
 * Electron ana süreciyle (yt-dlp) köprü. Tarayıcıda çalışırken null döner.
 */
export function isElectron(): boolean {
  return typeof (window as any).lpotify?.resolveAudio === 'function';
}

export interface ResolvedAudio {
  url: string;
  title: string;
  duration: number;
  thumbnail: string;
  ext: string;
}

/** yt-dlp ile tam uzunlukta, reklamsız ses akışı çözümler. */
export async function resolveAudioFull(query: string, duration = 0): Promise<ResolvedAudio | null> {
  if (!isElectron()) return null;
  try {
    return await (window as any).lpotify.resolveAudio(query, duration);
  } catch {
    return null;
  }
}

/** "download mp" klasörüne gerçek dosya indirir (yalnızca Electron). */
export async function downloadAudioFile(
  query: string,
  fileName: string,
  trackId: string,
  duration = 0
): Promise<{ ok: boolean; filePath?: string; dir?: string; url?: string; error?: string }> {
  if (!isElectron()) return { ok: false, error: 'Yalnızca uygulama içinde çalışır' };
  try {
    const result = await (window as any).lpotify.downloadAudio(query, fileName, trackId, duration);
    if (result?.filePath && result?.url) localAudioUrlCache.set(result.filePath, result.url);
    return result;
  } catch (e: any) {
    return { ok: false, error: e?.message || 'İndirme başarısız' };
  }
}

export async function cacheAudioTemporarily(
  query: string,
  duration: number
): Promise<{ url: string; duration: number } | null> {
  if (!isElectron()) return null;
  try {
    return await (window as any).lpotify.cacheAudioTemporarily(query, duration);
  } catch {
    return null;
  }
}

export function onDownloadProgress(
  callback: (payload: { trackId: string; percent: number }) => void
): () => void {
  try {
    return (window as any).lpotify?.onDownloadProgress?.(callback) || (() => {});
  } catch {
    return () => {};
  }
}

export function getDownloadsDir(): Promise<string | null> {
  if (!isElectron()) return Promise.resolve(null);
  return (window as any).lpotify.getDownloadsDir();
}

export function openDownloadsFolder(): Promise<boolean> {
  if (!isElectron()) return Promise.resolve(false);
  return (window as any).lpotify.openDownloadsFolder();
}

export type TaskbarPlayerAction = 'toggle-like' | 'previous' | 'play-pause' | 'next';

export function updateTaskbarControls(state: {
  hasTrack: boolean;
  isPlaying: boolean;
  isLiked: boolean;
}): void {
  try { (window as any).lpotify?.updateTaskbarControls?.(state); } catch { /* ignore */ }
}

export function onTaskbarPlayerAction(
  callback: (action: TaskbarPlayerAction) => void
): () => void {
  try {
    return (window as any).lpotify?.onTaskbarPlayerAction?.(callback) || (() => {});
  } catch {
    return () => {};
  }
}

/** Yerel dosya yolunu <audio>/Howler ile çalınabilir adrese çevirir.
 *  Electron'da güvenilir yol: dahili yerel sunucu (Range destekli).
 *  Tarayıcıda: file:// adresi döner (yine de çoğunlukla kullanılmaz). */
const localAudioUrlCache = new Map<string, string>();
const prewarmedLocalAudio = new Map<string, HTMLAudioElement>();

export async function getLocalAudioUrl(p: string): Promise<string> {
  const cached = localAudioUrlCache.get(p);
  if (cached) return cached;
  if (isElectron()) {
    try {
      const url = await (window as any).lpotify.localAudioUrl(p);
      if (url) {
        localAudioUrlCache.set(p, url);
        return url;
      }
    } catch { /* fall through */ }
  }
  return filePathToUrl(p);
}

/** İndirilenler sayfasındaki yerel adresleri tıklamadan önce hazırlar. */
export function prewarmLocalAudioUrls(paths: string[]): void {
  paths.filter(Boolean).forEach((path) => {
    if (prewarmedLocalAudio.has(path)) return;
    void getLocalAudioUrl(path).then((url) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;
      prewarmedLocalAudio.set(path, audio);
      audio.load();
    });
  });
}

/** Yerel dosya yolunu <audio>/Howler ile çalınabilir file:// adresine çevirir. */
export function filePathToUrl(p: string): string {
  const norm = p.replace(/\\/g, '/');
  return encodeURI('file:///' + norm.replace(/^\/+/, '')).replace(/#/g, '%23').replace(/\?/g, '%3F');
}
