import { create } from 'zustand';
import { Track } from '../types';

// İndirilenler artık KALICI: localStorage'da saklanır, uygulama kapanıp
// açılsa bile liste ve dosya yolları durur.
const STORAGE_KEY = 'lpotify-downloads-v1';

function loadSaved(): Track[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(tracks: Track[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks)); } catch { /* storage full */ }
}

interface DownloadsStore {
  downloads: Track[];
  downloading: string[];
  addDownload: (track: Track) => void;
  removeDownload: (trackId: string) => void;
  isDownloaded: (trackId: string) => boolean;
  setDownloading: (trackId: string, isDownloading: boolean) => void;
}

export const useDownloadsStore = create<DownloadsStore>((set, get) => ({
  downloads: loadSaved(),
  downloading: [],

  addDownload: (track) => {
    set((state) => {
      const downloads = state.downloads.some((t) => t.id === track.id)
        ? state.downloads
        : [...state.downloads, { ...track, isDownloaded: true }];
      saveAll(downloads);
      return { downloads, downloading: state.downloading.filter((id) => id !== track.id) };
    });
  },

  removeDownload: (trackId) => {
    set((state) => {
      const downloads = state.downloads.filter((t) => t.id !== trackId);
      saveAll(downloads);
      return { downloads };
    });
  },

  isDownloaded: (trackId) => {
    return get().downloads.some((t) => t.id === trackId);
  },

  setDownloading: (trackId, isDownloading) => {
    set((state) => ({
      downloading: isDownloading
        ? [...state.downloading, trackId]
        : state.downloading.filter((id) => id !== trackId),
    }));
  },
}));
