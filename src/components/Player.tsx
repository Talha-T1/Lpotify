import React, { useCallback, useState } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Volume1, Heart, ListMusic, PictureInPicture2, X,
} from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { usePlaylistStore } from '../store/playlistStore';
import { formatDuration } from '../utils/musicApi';
import { useT } from '../i18n';

export default function Player() {
  const t = useT();
  const {
    currentTrack, isPlaying, volume, progress, duration,
    shuffle, repeat, setIsPlaying, setVolume, setProgress,
    nextTrack, prevTrack, toggleShuffle, toggleRepeat,
  } = usePlayerStore();
  const { playlists, addToPlaylist } = usePlaylistStore();
  const likedPlaylist = playlists.find(p => p.id === 'liked-songs');
  const isLiked = likedPlaylist?.tracks.some(t => t.id === currentTrack?.id);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setProgress(time);
    window.dispatchEvent(new CustomEvent('player-seek', { detail: { time } }));
  }, [setProgress]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  }, [setVolume]);

  const toggleLike = () => {
    if (!currentTrack || isLiked) return;
    addToPlaylist('liked-songs', currentTrack);
  };

  const [showMiniPlayer, setShowMiniPlayer] = useState(false);

  React.useEffect(() => {
    const handleClose = () => setShowMiniPlayer(false);
    window.addEventListener('close-modals', handleClose);
    return () => window.removeEventListener('close-modals', handleClose);
  }, []);

  if (!currentTrack) {
    return (
      <div className="h-12 lg:h-[90px] bg-lpotify-dark border-t border-lpotify-gray/30 flex items-center justify-center shrink-0">
        <p className="text-lpotify-gray-light text-xs md:text-sm">{t('chooseSong')}</p>
      </div>
    );
  }

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <>
      {/* Spotify Tarzı Yüzen Mini Oynatıcı / Hover Widget */}
      {showMiniPlayer && (
        <div className="fixed bottom-24 right-6 z-50 bg-[#181818]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 w-72 animate-slide-up text-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-lpotify-gray-light uppercase tracking-wider">
              {t('miniPlayer')}
            </span>
            <button
              onClick={() => setShowMiniPlayer(false)}
              className="p-1 rounded-full text-lpotify-gray-light hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 group shadow-xl">
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/default/250/250'; }}
            />
            {/* Hover hızlı kontroller */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <button
                onClick={prevTrack}
                title={t('previous')}
                className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center hover:scale-110 transition-transform"
              >
                <SkipBack size={16} fill="white" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? t('pause') : t('play')}
                className="w-12 h-12 rounded-full bg-lpotify-green flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
              >
                {isPlaying ? <Pause size={20} className="text-black" fill="black" /> : <Play size={20} className="text-black ml-0.5" fill="black" />}
              </button>
              <button
                onClick={nextTrack}
                title={t('next')}
                className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center hover:scale-110 transition-transform"
              >
                <SkipForward size={16} fill="white" />
              </button>
            </div>
          </div>

          <div className="mb-3">
            <h4 className="font-bold text-sm truncate">{currentTrack.title}</h4>
            <p className="text-xs text-lpotify-gray-light truncate">{currentTrack.artist}</p>
          </div>

          {/* İlerleme Çubuğu */}
          <div className="mb-3">
            <div className="flex-1 progress-container relative h-1 group cursor-pointer mb-1">
              <div className="absolute inset-0 bg-lpotify-gray rounded-full">
                <div className="progress-filled rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={progress}
                onChange={handleSeek}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              />
            </div>
            <div className="flex justify-between text-[10px] text-lpotify-gray-light">
              <span>{formatDuration(progress)}</span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Mini Kontrol Butonları */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={toggleShuffle}
              className={`p-1 rounded-full transition-colors ${shuffle ? 'text-lpotify-green' : 'text-lpotify-gray-light hover:text-white'}`}
            >
              <Shuffle size={14} />
            </button>
            <button onClick={prevTrack} className="p-1 text-lpotify-gray-light hover:text-white transition-colors">
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause size={18} className="text-black" fill="black" /> : <Play size={18} className="text-black ml-0.5" fill="black" />}
            </button>
            <button onClick={nextTrack} className="p-1 text-lpotify-gray-light hover:text-white transition-colors">
              <SkipForward size={18} fill="currentColor" />
            </button>
            <button
              onClick={toggleRepeat}
              className={`p-1 rounded-full transition-colors ${repeat !== 'off' ? 'text-lpotify-green' : 'text-lpotify-gray-light hover:text-white'}`}
            >
              {repeat === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
            </button>
          </div>
        </div>
      )}

      <div className="h-16 lg:h-[90px] bg-lpotify-dark border-t border-lpotify-gray/30 px-3 md:px-4 flex items-center justify-between gap-2 shrink-0">
        {/* Track Info */}
        <div className="flex items-center gap-2 md:gap-3 w-[42%] md:w-[30%] min-w-0 md:min-w-[180px]">
          <div
            onClick={() => setShowMiniPlayer(!showMiniPlayer)}
            title={t('miniPlayer')}
            className="w-10 h-10 md:w-14 md:h-14 rounded-md overflow-hidden shrink-0 shadow-lg relative group cursor-pointer"
          >
            <img src={currentTrack.coverUrl} alt={currentTrack.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/default/56/56'; }} />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <PictureInPicture2 size={16} className="text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs md:text-sm text-white font-medium truncate">{currentTrack.title}</p>
            <p className="text-[10px] md:text-xs text-lpotify-gray-light truncate">{currentTrack.artist}</p>
          </div>
          <button onClick={toggleLike}
            className={`ml-1 p-1 rounded-full transition-colors ${isLiked ? 'text-lpotify-green' : 'text-lpotify-gray-light hover:text-white'}`}>
            <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Player Controls */}
        <div className="flex flex-col items-center w-[58%] md:w-[40%] max-w-[722px]">
          <div className="flex items-center gap-1.5 md:gap-4 mb-0.5 md:mb-1">
            <button onClick={toggleShuffle}
              className={`p-1 rounded-full transition-colors ${shuffle ? 'text-lpotify-green' : 'text-lpotify-gray-light hover:text-white'}`}>
              <Shuffle size={15} className="hidden md:block" />
            </button>
            <button onClick={prevTrack} className="p-1 text-lpotify-gray-light hover:text-white transition-colors">
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform">
              {isPlaying ? <Pause size={17} className="text-black" fill="black" /> : <Play size={17} className="text-black ml-0.5" fill="black" />}
            </button>
            <button onClick={nextTrack} className="p-1 text-lpotify-gray-light hover:text-white transition-colors">
              <SkipForward size={18} fill="currentColor" />
            </button>
            <button onClick={toggleRepeat}
              className={`p-1 rounded-full transition-colors ${repeat !== 'off' ? 'text-lpotify-green' : 'text-lpotify-gray-light hover:text-white'}`}>
              {repeat === 'one' ? <Repeat1 size={15} className="hidden md:block" /> : <Repeat size={15} className="hidden md:block" />}
            </button>
          </div>
          <div className="flex items-center gap-2 w-full">
            <span className="text-[10px] text-lpotify-gray-light w-8 md:w-10 text-right">{formatDuration(progress)}</span>
            <div className="flex-1 progress-container relative h-1 group cursor-pointer">
              <div className="absolute inset-0 bg-lpotify-gray rounded-full">
                <div className="progress-filled rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <input type="range" min="0" max={duration || 100} value={progress}
                onChange={handleSeek} className="absolute inset-0 w-full opacity-0 cursor-pointer z-10" />
            </div>
            <span className="text-[10px] text-lpotify-gray-light w-8 md:w-10">{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Volume & Extra Controls (yalnızca masaüstü) */}
        <div className="hidden md:flex items-center gap-3 w-[30%] justify-end min-w-[180px]">
          <button
            onClick={() => setShowMiniPlayer(!showMiniPlayer)}
            title={t('miniPlayer')}
            className={`p-1 transition-colors ${showMiniPlayer ? 'text-lpotify-green' : 'text-lpotify-gray-light hover:text-white'}`}
          >
            <PictureInPicture2 size={18} />
          </button>
          <button className="p-1 text-lpotify-gray-light hover:text-white transition-colors">
            <ListMusic size={18} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
              className="text-lpotify-gray-light hover:text-white transition-colors">
              <VolumeIcon size={18} />
            </button>
            <div className="w-24 progress-container relative h-1 group">
              <div className="absolute inset-0 bg-lpotify-gray rounded-full">
                <div className="progress-filled rounded-full" style={{ width: `${volume * 100}%` }} />
              </div>
              <input type="range" min="0" max="1" step="0.01" value={volume}
                onChange={handleVolumeChange} className="absolute inset-0 w-full opacity-0 cursor-pointer z-10" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
