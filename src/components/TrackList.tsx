import React from 'react';
import { Play, Pause, Heart, Download, MoreHorizontal } from 'lucide-react';
import { Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { usePlaylistStore } from '../store/playlistStore';
import { useDownloadsStore } from '../store/downloadsStore';
import { formatDuration } from '../utils/musicApi';
import { cacheTrack } from '../utils/offlineCache';
import { isElectron, downloadAudioFile } from '../utils/electronBridge';
import { prefetchTrack } from '../utils/audioCache';
import { useT } from '../i18n';

interface TrackListProps {
  tracks: Track[];
  showHeader?: boolean;
  showCover?: boolean;
}

export default function TrackList({ tracks, showHeader = true, showCover = true }: TrackListProps) {
  const t = useT();
  const { currentTrack, isPlaying, setQueue, setIsPlaying, setCurrentTrack } = usePlayerStore();
  const { playlists, addToPlaylist } = usePlaylistStore();
  const { downloads, addDownload, setDownloading, downloading, removeDownload } = useDownloadsStore();
  const likedPlaylist = playlists.find(p => p.id === 'liked-songs');

  const handlePlay = (track: Track, index: number) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying);
    } else {
      setQueue(tracks, index);
      setCurrentTrack(track);
      setIsPlaying(true);
    }
  };

  const handleDownload = async (track: Track) => {
    if (downloading.includes(track.id)) return;
    if (downloads.some((t) => t.id === track.id)) {
      removeDownload(track.id);
      return;
    }
    setDownloading(track.id, true);
    try {
      // Electron: şarkıyı "download mp" klasörüne gerçek ses dosyası olarak indir
      // (isteyen dosya yöneticisinden de dinleyebilir).
      if (isElectron()) {
        const res = await downloadAudioFile(
          track.artist + ' ' + track.title,
          track.artist + ' - ' + track.title
        );
        if (!res.ok || !res.filePath) throw new Error(res.error || 'İndirme başarısız');
        addDownload({ ...track, isDownloaded: true, filePath: res.filePath, audioUrl: res.filePath });
      } else {
        // Tarayıcı: IndexedDB çevrimdışı önbelleğine indir.
        await cacheTrack({
          id: track.id,
          title: track.title,
          artist: track.artist,
          coverUrl: track.coverUrl,
          duration: track.duration,
          audioUrl: track.audioUrl,
        });
        addDownload(track);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
    setDownloading(track.id, false);
  };

  const isTrackLiked = (trackId: string) => likedPlaylist?.tracks.some(t => t.id === trackId);
  const isTrackDownloaded = (trackId: string) => downloads.some(t => t.id === trackId);
  const isTrackDownloading = (trackId: string) => downloading.includes(trackId);

  return (
    <div className="w-full">
      {showHeader && (
        <div className="grid grid-cols-[40px_1fr_1fr_100px_60px] gap-4 px-4 py-2 text-xs text-lpotify-gray-light uppercase tracking-wider border-b border-lpotify-gray/30 mb-2">
          <span>#</span>
          <span>{t('trackTitle')}</span>
          <span>{t('album')}</span>
          <span className="text-right">{t('duration')}</span>
          <span></span>
        </div>
      )}
      <div className="space-y-0.5">
        {tracks.map((track, index) => {
          const isActive = currentTrack?.id === track.id;
          const liked = isTrackLiked(track.id);
          const downloaded = isTrackDownloaded(track.id);
          const dlInProgress = isTrackDownloading(track.id);

          return (
            <div key={track.id}
              className={`grid grid-cols-[40px_1fr_1fr_100px_60px] gap-4 px-4 py-2 rounded-md group cursor-pointer transition-colors ${isActive ? 'bg-lpotify-gray/50' : 'hover:bg-lpotify-gray/30'}`}
              onClick={() => handlePlay(track, index)}
              onMouseEnter={() => { /* üzerine gelince arka planda çözümlemeye başla → tıklayınca anında çalar */ prefetchTrack(track); }}>
              <div className="flex items-center justify-center">
                {isActive && isPlaying ? (
                  <div className="flex items-end gap-[2px] h-4">
                    <div className="playing-bar" /><div className="playing-bar" /><div className="playing-bar" />
                  </div>
                ) : (
                  <>
                    <span className={`text-sm group-hover:hidden ${isActive ? 'text-lpotify-green' : 'text-lpotify-gray-light'}`}>{index + 1}</span>
                    <Play size={14} className="hidden group-hover:block text-white" fill="white" />
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 min-w-0">
                {showCover && (
                  <div className="w-10 h-10 rounded overflow-hidden shrink-0">
                    <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/default/40/40'; }} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${isActive ? 'text-lpotify-green' : 'text-white'}`}>{track.title}</p>
                  <p className="text-xs text-lpotify-gray-light truncate">{track.artist}</p>
                </div>
              </div>
              <div className="flex items-center min-w-0">
                <span className="text-sm text-lpotify-gray-light truncate">{track.album}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={(e) => { e.stopPropagation(); handleDownload(track); }}
                  className={`p-1 rounded-full transition-colors ${downloaded ? 'text-lpotify-green' : dlInProgress ? 'text-lpotify-green animate-pulse' : 'text-lpotify-gray-light opacity-0 group-hover:opacity-100'}`}
                  disabled={dlInProgress}>
                  <Download size={14} />
                </button>
                <span className="text-sm text-lpotify-gray-light">{formatDuration(track.duration)}</span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <button onClick={(e) => { e.stopPropagation(); if (!liked) addToPlaylist('liked-songs', track); }}
                  className={`p-1 rounded-full transition-colors ${liked ? 'text-lpotify-green' : 'text-lpotify-gray-light opacity-0 group-hover:opacity-100'}`}>
                  <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
                </button>
                <button onClick={(e) => e.stopPropagation()}
                  className="p-1 text-lpotify-gray-light opacity-0 group-hover:opacity-100 hover:text-white transition-all">
                  <MoreHorizontal size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
