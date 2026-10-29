import { useEffect, useMemo, useState } from 'react';
import { Track } from '../types';

export interface LyricLine {
  time: number;
  text: string;
}

type LyricsState = {
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error';
  lines: LyricLine[];
};

const lyricsCache = new Map<string, LyricLine[]>();
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

async function fetchLyrics(track: Track): Promise<LyricLine[]> {
  const params = new URLSearchParams({
    track_name: track.title,
    artist_name: track.artist,
  });
  if (track.album) params.set('album_name', track.album);
  if (track.duration > 0) params.set('duration', String(Math.round(track.duration)));

  const response = await fetch('https://lrclib.net/api/get?' + params.toString(), {
    headers: { 'Lrclib-Client': 'Lpotify v1.0 (https://github.com/Talha-T1/Lpotify)' },
  });
  if (response.status === 404) return [];
  if (response.status === 429) throw new Error('rate-limited');
  if (!response.ok) throw new Error('lyrics-request-failed');
  const record = await response.json();
  return parseSyncedLyrics(record?.syncedLyrics);
}

export function useLyrics(track: Track | null, enabled: boolean, progress: number) {
  const [state, setState] = useState<LyricsState>({ status: 'idle', lines: [] });
  const key = track ? `${track.artist}\n${track.title}\n${Math.round(track.duration || 0)}` : '';

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !track) {
      setState({ status: 'idle', lines: [] });
      return () => { cancelled = true; };
    }
    const cached = lyricsCache.get(key);
    if (cached) {
      setState({ status: cached.length ? 'ready' : 'missing', lines: cached });
      return () => { cancelled = true; };
    }

    setState({ status: 'loading', lines: [] });
    queueLyricsRequest(() => fetchLyrics(track)).then((lines) => {
      if (cancelled) return;
      lyricsCache.set(key, lines);
      setState({ status: lines.length ? 'ready' : 'missing', lines });
    }).catch(() => {
      if (!cancelled) setState({ status: 'error', lines: [] });
    });
    return () => { cancelled = true; };
  }, [key, enabled]);

  const activeIndex = useMemo(() => {
    let index = -1;
    for (let i = 0; i < state.lines.length; i += 1) {
      if (state.lines[i].time <= progress + 0.15) index = i;
      else break;
    }
    return index;
  }, [state.lines, progress]);

  return {
    status: state.status,
    currentLine: activeIndex >= 0 ? state.lines[activeIndex]?.text || '' : '',
    nextLine: state.lines[activeIndex + 1]?.text || '',
  };
}
