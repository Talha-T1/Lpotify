import { create } from 'zustand';
import { Playlist, Track } from '../types';

interface PlaylistStore {
  playlists: Playlist[];
  createPlaylist: (name: string, description?: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  renamePlaylist: (id: string, name: string) => void;
}

const defaultPlaylists: Playlist[] = [
  {
    id: 'liked-songs',
    name: 'Beğenilen Şarkılar',
    description: 'Beğendiğiniz tüm şarkılar',
    coverUrl: '',
    tracks: [],
    createdAt: new Date().toISOString(),
  }
];

// Çalma listeleri KALICI: localStorage'da saklanır, uygulama yeniden
// açıldığında tüm listeler ve beğenilen şarkılar yerinde durur.
const STORAGE_KEY = 'lpotify-playlists-v1';

function loadSaved(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPlaylists;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.some((p) => p.id === 'liked-songs')) {
      return defaultPlaylists;
    }
    return parsed;
  } catch {
    return defaultPlaylists;
  }
}

function saveAll(playlists: Playlist[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists)); } catch { /* storage full */ }
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  playlists: loadSaved(),

  createPlaylist: (name, description = '') => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      description,
      coverUrl: '',
      tracks: [],
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const playlists = [...state.playlists, newPlaylist];
      saveAll(playlists);
      return { playlists };
    });
  },

  deletePlaylist: (id) => {
    if (id === 'liked-songs') return;
    set((state) => {
      const playlists = state.playlists.filter((p) => p.id !== id);
      saveAll(playlists);
      return { playlists };
    });
  },

  addToPlaylist: (playlistId, track) => {
    set((state) => {
      const playlists = state.playlists.map((p) => {
        if (p.id === playlistId && !p.tracks.find((t) => t.id === track.id)) {
          return { ...p, tracks: [...p.tracks, track] };
        }
        return p;
      });
      saveAll(playlists);
      return { playlists };
    });
  },

  removeFromPlaylist: (playlistId, trackId) => {
    set((state) => {
      const playlists = state.playlists.map((p) => {
        if (p.id === playlistId) {
          return { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) };
        }
        return p;
      });
      saveAll(playlists);
      return { playlists };
    });
  },

  renamePlaylist: (id, name) => {
    set((state) => {
      const playlists = state.playlists.map((p) => (p.id === id ? { ...p, name } : p));
      saveAll(playlists);
      return { playlists };
    });
  },
}));
