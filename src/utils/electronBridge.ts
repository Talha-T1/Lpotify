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
export async function resolveAudioFull(query: string): Promise<ResolvedAudio | null> {
  if (!isElectron()) return null;
  try {
    return await (window as any).lpotify.resolveAudio(query);
  } catch {
    return null;
  }
}

/** "download mp" klasörüne gerçek dosya indirir (yalnızca Electron). */
export async function downloadAudioFile(
  query: string,
  fileName: string
): Promise<{ ok: boolean; filePath?: string; dir?: string; error?: string }> {
  if (!isElectron()) return { ok: false, error: 'Yalnızca uygulama içinde çalışır' };
  try {
    return await (window as any).lpotify.downloadAudio(query, fileName);
  } catch (e: any) {
    return { ok: false, error: e?.message || 'İndirme başarısız' };
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

/** Yerel dosya yolunu <audio>/Howler ile çalınabilir adrese çevirir.
 *  Electron'da güvenilir yol: dahili yerel sunucu (Range destekli).
 *  Tarayıcıda: file:// adresi döner (yine de çoğunlukla kullanılmaz). */
export async function getLocalAudioUrl(p: string): Promise<string> {
  if (isElectron()) {
    try {
      const url = await (window as any).lpotify.localAudioUrl(p);
      if (url) return url;
    } catch { /* fall through */ }
  }
  return filePathToUrl(p);
}

/** Yerel dosya yolunu <audio>/Howler ile çalınabilir file:// adresine çevirir. */
export function filePathToUrl(p: string): string {
  const norm = p.replace(/\\/g, '/');
  return encodeURI('file:///' + norm.replace(/^\/+/, '')).replace(/#/g, '%23').replace(/\?/g, '%3F');
}
