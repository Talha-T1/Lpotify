export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  audioUrl: string;
  source: 'jamendo' | 'freemusicarchive' | 'internetarchive' | 'youtube' | 'itunes' | 'deezer';
  genre?: string;
  year?: number;
  isDownloaded?: boolean;
  offlineUrl?: string;
  /** "download mp" klasörüne indirilen gerçek dosyanın yolu. */
  filePath?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  tracks: Track[];
  createdAt: string;
  isOffline?: boolean;
}

export interface RadioStation {
  id: string;
  name: string;
  genre: string;
  coverUrl: string;
  streamUrl: string;
  description: string;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  queue: Track[];
  queueIndex: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
}

export interface AppView {
  currentView: 'home' | 'search' | 'library' | 'playlist' | 'radio' | 'downloads' | 'settings';
  selectedPlaylist: Playlist | null;
  selectedRadio: RadioStation | null;
}

export type SearchFilter = 'all' | 'tracks' | 'artists' | 'albums' | 'playlists';
