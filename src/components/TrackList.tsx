import React from 'react';
import { Play, Pause, Heart, Download, MoreHorizontal, Check, ListPlus } from 'lucide-react';
import { Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { usePlaylistStore } from '../store/playlistStore';
import { useDownloadsStore } from '../store/downloadsStore';
import { formatDuration } from '../utils/musicApi';
import { cacheTrack, removeCachedTrack } from '../utils/offlineCache';
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
  const { downloads, addDownload, setDownloading, downloading, downloadProgress, setDownloadProgress, removeDownload } = useDownloadsStore();
  const likedPlaylist = playlists.find(p => p.id === 'liked-songs');
  const userPlaylists = playlists.filter((playlist) => playlist.id !== 'liked-songs');
  const [openMenuTrackId, setOpenMenuTrackId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const closeMenu = () => setOpenMenuTrackId(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('close-modals', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('close-modals', closeMenu);
    };
  }, []);

  const handlePlay = (track: Track, index: number) => {
    const samePlayableSource = currentTrack?.id === track.id &&
      (currentTrack.filePath || '') === (track.filePath || '');
    if (samePlayableSource) {
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
      removeCachedTrack(track.id).catch(() => {});
      return;
    }
    setDownloading(track.id, true);
    setDownloadProgress(track.id, 0);
    try {
      // Electron: şarkıyı "download mp" klasörüne gerçek ses dosyası olarak indir
      // (isteyen dosya yöneticisinden de dinleyebilir).
      if (isElectron()) {
        const res = await downloadAudioFile(
          track.artist + ' ' + track.title,
          track.artist + ' - ' + track.title,
          track.id,
          track.duration
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
      setDownloadProgress(track.id, null);
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
                <span className={`text-sm ${dlInProgress ? 'text-lpotify-green font-semibold tabular-nums' : 'text-lpotify-gray-light'}`}>
                  {dlInProgress ? `%${downloadProgress[track.id] ?? 0}` : formatDuration(track.duration)}
                </span>
              </div>
              <div className="relative flex items-center justify-end gap-1">
                <button onClick={(e) => { e.stopPropagation(); if (!liked) addToPlaylist('liked-songs', track); }}
                  className={`p-1 rounded-full transition-colors ${liked ? 'text-lpotify-green' : 'text-lpotify-gray-light opacity-0 group-hover:opacity-100'}`}>
                  <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
                </button>
                <button onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuTrackId((id) => id === track.id ? null : track.id);
                }}
                  aria-label={t('addToPlaylist')}
                  className="p-1 text-lpotify-gray-light opacity-0 group-hover:opacity-100 hover:text-white transition-all">
                  <MoreHorizontal size={14} />
                </button>
                {openMenuTrackId === track.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-8 z-50 w-56 rounded-lg border border-white/10 bg-[#282828] p-1.5 shadow-2xl"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white border-b border-white/10 mb-1">
                      <ListPlus size={15} />
                      <span>{t('addToPlaylist')}</span>
                    </div>
                    {userPlaylists.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-lpotify-gray-light">{t('noPlaylists')}</p>
                    ) : userPlaylists.map((playlist) => {
                      const alreadyAdded = playlist.tracks.some((item) => item.id === track.id);
                      return (
                        <button
                          key={playlist.id}
                          disabled={alreadyAdded}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!alreadyAdded) addToPlaylist(playlist.id, track);
                            setOpenMenuTrackId(null);
                          }}
                          className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm text-white hover:bg-white/10 disabled:cursor-default disabled:text-lpotify-gray-light"
                        >
                          <span className="truncate">{playlist.name}</span>
                          {alreadyAdded && <Check size={15} className="shrink-0 text-lpotify-green" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
