import { resolveAudioFull, isElectron } from './electronBridge';
import { Track } from '../types';

/**
 * Merkezi ses çözümleme önbelleği:
 * - Bellek içi (anında) + localStorage'da KALICI (uygulama yeniden açılsa da).
 * - googlevideo akış URL'leri ~6 saat geçerli olduğu için TTL 4 saat.
 * Böylece daha önce dinlenen/dinlenilen şarkılar uygulama her açılışında
 * ağa gitmeden, ULTRA HIZLI başlar.
 */
export const resolvedCache = new Map<string, { url: string; duration: number }>();

const CACHE_KEY = 'lpotify-resolved-v1';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 saat

function persistCache() {
  try {
    const entries: [string, { url: string; duration: number; at: number }][] = [];
    const now = Date.now();
    resolvedCache.forEach((v, k) => {
      const at = (v as any).at || now;
      if (now - at < CACHE_TTL) entries.push([k, { ...(v as any), at }]);
    });
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch { /* storage full */ }
}

// Açılışta kalıcı önbelleği yükle (bayat URL'ler atılır).
try {
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) {
    const entries = JSON.parse(raw);
    const now = Date.now();
    if (Array.isArray(entries)) {
      entries.forEach(([k, v]: [string, any]) => {
        if (v && v.url && now - (v.at || 0) < CACHE_TTL) {
          resolvedCache.set(k, { url: v.url, duration: v.duration, at: v.at } as any);
        }
      });
    }
  }
} catch { /* ignore */ }

/** Sonucun "gerçek şarkı" olduğuna karar ver: 30 sn'lik önizlemeleri ele. */
function isAcceptable(duration: number, minDuration: number): boolean {
  if (duration === 0) return true; // süre bilinmiyorsa kabul et
  return duration >= minDuration;
}

export function minDurationFor(track: Track): number {
  if (!track.duration || track.duration < 45) return 20;
  // Liste süresinin %60'ından kısa veya 90 sn'den kısa ise önizleme say.
  return Math.min(track.duration * 0.6, 90);
}

/**
 * Birden fazla sorguyu "yarıştır": sorgular kademeli paralel başlar,
 * en hızlı KABUL EDİLEBİLİR sonucu döndürür. Tümü başarısız olursa
 * sonsuza kadar askıda kalmaz — toplam süre sonunda null döner.
 */
export function raceResolveQueries(
  queries: string[],
  minDuration = 60,
  staggerMs = 2500
): Promise<{ url: string; duration: number } | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: { url: string; duration: number } | null) => {
      if (!settled) { settled = true; resolve(r); }
    };
    queries.forEach((query, i) => {
      setTimeout(async () => {
        if (settled) return;
        try {
          const cached = resolvedCache.get(query);
          if (cached) {
            if (isAcceptable(cached.duration, minDuration)) return done(cached);
            return;
          }
          const r = await resolveAudioFull(query);
          if (r && r.url && !settled && isAcceptable(Math.round(r.duration), minDuration)) {
            const full = { url: r.url, duration: Math.round(r.duration), at: Date.now() } as any;
            resolvedCache.set(query, full);
            persistCache();
            done(full);
          }
        } catch { /* diğer denemeler sürüyor */ }
      }, i * staggerMs);
    });
    // Tüm denemeler bittiğinde askıda kalma — null ile sonuçlan.
    setTimeout(() => done(null), queries.length * staggerMs + 7000);
  });
}

/** Şarkıyı (varsa) çözümlenmiş akışıyla önceden yükle — hover/prefetch için. */
export async function prefetchTrack(track: Track): Promise<void> {
  if (!track || track.filePath || !isElectron()) return;
  const minDur = minDurationFor(track);
  const queries = [
    track.artist + ' ' + track.title,
    track.title + ' audio',
  ];
  if (queries.some((q) => {
    const c = resolvedCache.get(q);
    return c && isAcceptable(c.duration, minDur);
  })) return;
  try {
    const r = await raceResolveQueries(queries, minDur);
    if (r) resolvedCache.set(queries[0], r);
  } catch { /* sessizce geç */ }
}

/** Bir şarkı listesini sırayla (1 sn arayla) önceden yükler — kuyruk kurulunca çağrılır. */
export function prefetchMany(tracks: Track[], count = 4): void {
  tracks.slice(0, count).forEach((track, i) => {
    setTimeout(() => { prefetchTrack(track); }, i * 1000);
  });
}