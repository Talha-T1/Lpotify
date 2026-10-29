import { useEffect, useMemo, useState } from 'react';
import { Track } from '../types';

export interface LyricLine {
  time: number;
  text: string;
}

type LyricsState = {
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error';
  lines: LyricLine[];
  referenceDuration: number;
};

type CachedLyrics = { lines: LyricLine[]; referenceDuration: number };
const lyricsCache = new Map<string, CachedLyrics>();
let requestQueue = Promise.resolve();

function parseSyncedLyrics(value: string | null | undefined): LyricLine[] {
  if (!value) return [];
  const lines: LyricLine[] = [];
  for (const row of value.split(/\r?\n/)) {
    const matches = [...row.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g)];
    const text = row.replace(/\[[^\]]+\]/g, '').trim();
    if (!text) continue;
    for (const match of matches) {
      lines.push({ time: Number(match[1]) * 60 + Number(match[2]), text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function queueLyricsRequest<T>(task: () => Promise<T>): Promise<T> {
  const result = requestQueue.then(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return task();
  });
  requestQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function fetchLyrics(track: Track): Promise<CachedLyrics> {
  const params = new URLSearchParams({
    track_name: track.title,
    artist_name: track.artist,
  });
  if (track.album) params.set('album_name', track.album);
  if (track.duration > 0) params.set('duration', String(Math.round(track.duration)));

  const response = await fetch('https://lrclib.net/api/get?' + params.toString(), {
    headers: { 'Lrclib-Client': 'Lpotify v1.0 (https://github.com/Talha-T1/Lpotify)' },
  });
  if (response.status === 404) return { lines: [], referenceDuration: track.duration || 0 };
  if (response.status === 429) throw new Error('rate-limited');
  if (!response.ok) throw new Error('lyrics-request-failed');
  const record = await response.json();
  return {
    lines: parseSyncedLyrics(record?.syncedLyrics),
    referenceDuration: Number(record?.duration || track.duration || 0),
  };
}

export function useLyrics(track: Track | null, enabled: boolean, progress: number, playbackDuration = 0) {
  const [state, setState] = useState<LyricsState>({ status: 'idle', lines: [], referenceDuration: 0 });
  const key = track ? `${track.artist}\n${track.title}\n${Math.round(track.duration || 0)}` : '';

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !track) {
      setState({ status: 'idle', lines: [], referenceDuration: 0 });
      return () => { cancelled = true; };
    }
    const cached = lyricsCache.get(key);
    if (cached) {
      setState({ status: cached.lines.length ? 'ready' : 'missing', ...cached });
      return () => { cancelled = true; };
    }

    setState({ status: 'loading', lines: [], referenceDuration: 0 });
    queueLyricsRequest(() => fetchLyrics(track)).then((result) => {
      if (cancelled) return;
      lyricsCache.set(key, result);
      setState({ status: result.lines.length ? 'ready' : 'missing', ...result });
    }).catch(() => {
      if (!cancelled) setState({ status: 'error', lines: [], referenceDuration: 0 });
    });
    return () => { cancelled = true; };
  }, [key, enabled]);

  const activeIndex = useMemo(() => {
    const scale = state.referenceDuration > 0 && playbackDuration > 0
      ? playbackDuration / state.referenceDuration
      : 1;
    // Görsel satırı, duyulan kelimeden az önce hazırlamak algılanan gecikmeyi
    // giderir ve 50 ms'lik oynatıcı güncellemesiyle birlikte daha doğal görünür.
    const synchronizedProgress = progress + 0.5;
    let index = -1;
    for (let i = 0; i < state.lines.length; i += 1) {
      if (state.lines[i].time * scale <= synchronizedProgress) index = i;
      else break;
    }
    return index;
  }, [state.lines, state.referenceDuration, progress, playbackDuration]);

  const visibleLines = useMemo(() => {
    const start = Math.max(0, activeIndex);
    return state.lines.slice(start, start + 5).map((line, index) => ({
      time: line.time,
      text: line.text,
      active: activeIndex >= 0 && index === 0,
    }));
  }, [state.lines, activeIndex]);

  return {
    status: state.status,
    currentLine: activeIndex >= 0 ? state.lines[activeIndex]?.text || '' : '',
    nextLine: state.lines[activeIndex + 1]?.text || '',
    visibleLines,
  };
}
