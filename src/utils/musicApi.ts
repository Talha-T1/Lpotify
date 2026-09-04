import { Track } from '../types';

const DEEZER_API = 'https://api.deezer.com';
const ARCHIVE_API = 'https://archive.org/advancedsearch.php';
const ARCHIVE_DOWNLOAD = 'https://archive.org/download/';

/* ------------------------------------------------------------------ */
/* Deezer (JSONP) — MyT Müzik tarzı uygulamaların kullandığı katalog.  */
/* Arama anında döner: gerçek şarkı adı, sanatçı, albüm kapağı, süre.  */
/* ------------------------------------------------------------------ */

let jsonpSeq = 0;
function jsonp<T = any>(url: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cbName = '__lpotify_cb_' + Date.now() + '_' + jsonpSeq++;
    const script = document.createElement('script');
    const cleanup = () => {
      delete (window as any)[cbName];
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP timeout'));
    }, timeoutMs);
    (window as any)[cbName] = (data: T) => {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };
    script.src = url + (url.includes('?') ? '&' : '?') + 'output=jsonp&callback=' + cbName;
    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('JSONP error'));
    };
    document.head.appendChild(script);
  });
}

function mapDeezer(d: any): Track {
  return {
    id: 'deezer-' + d.id,
    title: d.title_short || d.title || 'Bilinmeyen',
    artist: d.artist?.name || 'Bilinmeyen Sanatçı',
    album: d.album?.title || 'Tekli',
    duration: d.duration || 0,
    coverUrl: d.album?.cover_big || d.album?.cover_medium || d.album?.cover || '',
    audioUrl: d.preview || '',
    source: 'deezer' as const,
  };
}

async function deezerSearch(query: string, limit: number): Promise<Track[]> {
  const data = await jsonp(
    DEEZER_API + '/search?q=' + encodeURIComponent(query) + '&limit=' + limit
  );
  const items: any[] = data?.data || [];
  return items.map(mapDeezer);
}

async function deezerChart(limit: number): Promise<Track[]> {
  const data = await jsonp(DEEZER_API + '/chart/0/tracks?limit=' + limit);
  const items: any[] = data?.data || [];
  return items.map(mapDeezer);
}

/* ------------------------------------------------------------------ */
/* Internet Archive — Deezer önizlemesi yerine TAM ŞARKI bulmak için.  */
/* ------------------------------------------------------------------ */

const archiveMetaCache = new Map<string, any>();
const fullTrackCache = new Map<string, Track>();

function pickAudioFile(files: any[]): { url: string; length: number } | null {
  for (const ext of ['mp3', 'm4a', 'ogg', 'flac']) {
    const f = files.find(
      (x: any) =>
        x && x.name && x.name.toLowerCase().endsWith('.' + ext) &&
        typeof x.length === 'number' && x.length > 60
    );
    if (f) return { url: ARCHIVE_DOWNLOAD + encodeURIComponent(f.name), length: f.length };
  }
  return null;
}

async function fetchArchiveMeta(identifier: string): Promise<any | null> {
  if (archiveMetaCache.has(identifier)) return archiveMetaCache.get(identifier);
  const r = await fetch('https://archive.org/metadata/' + encodeURIComponent(identifier));
  const m = await r.json();
  archiveMetaCache.set(identifier, m);
  return m;
}

async function findFullTrack(title: string): Promise<{ url: string; length: number } | null> {
  const q =
    'title:(' + title + ') AND mediatype:audio AND format:(MP3)';
  const url =
    ARCHIVE_API +
    '?q=' + encodeURIComponent(q) +
    '&fl[]=identifier&fl[]=title&sort[]=downloads desc&rows=5&output=json';
  const res = await fetch(url);
  const data = await res.json();
  const docs: any[] = data?.response?.docs || [];
  for (const d of docs) {
    if (!d.identifier) continue;
    try {
      const meta = await fetchArchiveMeta(d.identifier);
      const file = meta && Array.isArray(meta.files) ? pickAudioFile(meta.files) : null;
      if (file) return file;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

/**
 * Çalma sırasında çağrılır: Deezer 30 sn önizlemesini Archive'teki tam
 * sürümle değiştirmeyi dener (4 sn içinde bulunamazsa önizleme kalır).
 */
export async function resolveTrack(track: Track): Promise<Track> {
  if (track.source !== 'deezer' || !track.audioUrl) return track;
  const cached = fullTrackCache.get(track.id);
  if (cached) return cached;
  try {
    const full = await withTimeout(findFullTrack(track.title), 4000);
    if (full) {
      const upgraded: Track = { ...track, audioUrl: full.url, duration: Math.round(full.length) };
      fullTrackCache.set(track.id, upgraded);
      return upgraded;
    }
  } catch {
    /* fall back to preview */
  }
  fullTrackCache.set(track.id, track);
  return track;
}

/* --------------------------- Public API --------------------------- */

// Ana sayfa sonuçlarını localStorage'da önbelleğe al: uygulama açılışında
// ağ beklenmeden anında render edilir (yavaş açılış sorunu için).
function cachedJsonList<T>(key: string, ttlMs: number, fetcher: () => Promise<T[]>): Promise<T[]> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.items) && parsed.items.length > 0 && Date.now() - parsed.at < ttlMs) {
        return Promise.resolve(parsed.items as T[]);
      }
    }
  } catch { /* ignore */ }
  return fetcher().then((items) => {
    if (items.length > 0) {
      try { localStorage.setItem(key, JSON.stringify({ items, at: Date.now() })); } catch { /* ignore */ }
    }
    return items;
  });
}

export async function searchTracks(query: string, limit: number = 24): Promise<Track[]> {
  try {
    const tracks = await deezerSearch(query, limit);
    if (tracks.length > 0) return tracks;
  } catch (error) {
    console.error('Search error:', error);
  }
  return getMockTracks(query);
}

export async function getFeaturedTracks(limit: number = 24): Promise<Track[]> {
  return cachedJsonList('lpotify-featured-v1', 60 * 60 * 1000, async () => {
    try {
      const tracks = await deezerChart(limit);
      if (tracks.length > 0) return tracks;
    } catch (error) {
      console.error('Featured error:', error);
    }
    return getMockTracks('popular');
  });
}

export async function getTracksByGenre(genre: string, limit: number = 24): Promise<Track[]> {
  return cachedJsonList('lpotify-genre-' + genre + '-v1', 60 * 60 * 1000, async () => {
    try {
      const tracks = await deezerSearch(genre, limit);
      if (tracks.length > 0) return tracks;
    } catch (error) {
      console.error('Genre error:', error);
    }
    return getMockTracks(genre);
  });
}

// Radyo sayfası kaldırıldı; uyumluluk için boş liste döndürür.
export function getRadioStations() {
  return [];
}

export function getGenres(): { name: string; color: string; coverUrl: string }[] {
  return [
    { name: 'Pop', color: '#E13300', coverUrl: 'https://picsum.photos/seed/popgenre/300/300' },
    { name: 'Rock', color: '#1E3264', coverUrl: 'https://picsum.photos/seed/rockgenre/300/300' },
    { name: 'Electronic', color: '#E8115B', coverUrl: 'https://picsum.photos/seed/electronicgenre/300/300' },
    { name: 'Jazz', color: '#477D95', coverUrl: 'https://picsum.photos/seed/jazzgenre/300/300' },
    { name: 'Hip-Hop', color: '#BA5D07', coverUrl: 'https://picsum.photos/seed/hiphopgenre/300/300' },
    { name: 'Lo-Fi', color: '#E91429', coverUrl: 'https://picsum.photos/seed/lofigenre/300/300' },
    { name: 'Indie', color: '#148A08', coverUrl: 'https://picsum.photos/seed/indiegenre/300/300' },
  ];
}

function getMockTracks(query: string): Track[] {
  return [
    { id: 'mock-1', title: 'Summer Breeze', artist: 'Chill Masters', album: 'Relaxation', duration: 234, coverUrl: 'https://picsum.photos/seed/m1/300/300', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', source: 'internetarchive', genre: 'Ambient' },
    { id: 'mock-2', title: 'Rock Anthem', artist: 'Thunder Strike', album: 'Power', duration: 312, coverUrl: 'https://picsum.photos/seed/m2/300/300', audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', source: 'internetarchive', genre: 'Rock' },
  ];
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins + ':' + secs.toString().padStart(2, '0');
}