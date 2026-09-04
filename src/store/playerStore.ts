import { create } from 'zustand';
import { Track, PlayerState } from '../types';

interface PlayerStore extends PlayerState {
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  volume: (() => {
    try {
      const v = parseFloat(localStorage.getItem('lpotify-volume') || '');
      if (!isNaN(v) && v >= 0 && v <= 1) return v;
    } catch { /* ignore */ }
    return 0.7;
  })(),
  progress: 0,
  duration: 0,
  queue: [],
  queueIndex: 0,
  shuffle: false,
  repeat: 'off',

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    try { localStorage.setItem('lpotify-volume', String(clamped)); } catch { /* ignore */ }
    set({ volume: clamped });
  },
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),

  setQueue: (tracks, startIndex = 0) => {
    set({ 
      queue: tracks, 
      queueIndex: startIndex, 
      currentTrack: tracks[startIndex] || null 
    });
  },

  nextTrack: () => {
    const { queue, queueIndex, shuffle, repeat } = get();
    if (queue.length === 0) return;

    let nextIndex: number;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (queueIndex < queue.length - 1) {
      nextIndex = queueIndex + 1;
    } else if (repeat === 'all') {
      nextIndex = 0;
    } else {
      return;
    }

    set({ queueIndex: nextIndex, currentTrack: queue[nextIndex] });
  },

  prevTrack: () => {
    const { queue, queueIndex } = get();
    if (queue.length === 0) return;

    if (get().progress > 3) {
      set({ progress: 0 });
    } else {
      const prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
      set({ queueIndex: prevIndex, currentTrack: queue[prevIndex] });
    }
  },

  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  toggleRepeat: () => set((state) => ({
    repeat: state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off'
  })),

  addToQueue: (track) => set((state) => ({ queue: [...state.queue, track] })),

  removeFromQueue: (index) => set((state) => ({
    queue: state.queue.filter((_, i) => i !== index)
  })),
}));
