import React from 'react';
import { Play, Clock, Music, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { usePlayerStore } from '../store/playerStore';
import TrackList from '../components/TrackList';
import { formatDuration } from '../utils/musicApi';
import { useT } from '../i18n';

export default function PlaylistPage() {
  const t = useT();
  const { selectedPlaylist, setCurrentView } = useAppStore();
  const { setQueue, setCurrentTrack, setIsPlaying } = usePlayerStore();

  if (!selectedPlaylist) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <p className="text-lpotify-gray-light">{t('playlistNotFound')}</p>
        <button onClick={() => setCurrentView('library')} className="mt-4 text-lpotify-green hover:underline">
          {t('backToLibrary')}
        </button>
      </div>
    );
  }

  const totalDuration = selectedPlaylist.tracks.reduce((acc, t) => acc + t.duration, 0);

  const playAll = () => {
    if (selectedPlaylist.tracks.length > 0) {
      setQueue(selectedPlaylist.tracks, 0);
      setCurrentTrack(selectedPlaylist.tracks[0]);
      setIsPlaying(true);
    }
  };

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-gradient-to-b from-indigo-800/50 to-transparent p-6 pb-8">
        <button
          onClick={() => setCurrentView('library')}
          className="flex items-center gap-2 text-lpotify-gray-light hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-medium">{t('backToLibrary')}</span>
        </button>

        <div className="flex items-end gap-6">
          <div className="w-[200px] h-[200px] rounded-lg shadow-2xl overflow-hidden shrink-0">
            {selectedPlaylist.tracks.length > 0 ? (
              <div className="grid grid-cols-2 gap-0.5 w-full h-full">
                {selectedPlaylist.tracks.slice(0, 4).map((track, i) => (
                  <img key={i} src={track.coverUrl} alt="" className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/default/150/150'; }} />
                ))}
              </div>
            ) : (
              <div className="w-full h-full bg-lpotify-gray flex items-center justify-center">
                <Music size={48} className="text-lpotify-gray-light" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">{t('playlistLabel')}</p>
            <h1 className="text-5xl font-black text-white mt-2 mb-4">{selectedPlaylist.name}</h1>
            {selectedPlaylist.description && (
              <p className="text-lpotify-gray-light text-sm mb-2">{selectedPlaylist.description}</p>
            )}
            <div className="flex items-center gap-1 text-sm text-lpotify-gray-light">
          <span className="font-semibold text-white">{selectedPlaylist.tracks.length} {t('songs')}</span>
              <span>•</span>
              <Clock size={14} />
              <span>{formatDuration(totalDuration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Play Button */}
      <div className="px-6 py-4">
        <button
          onClick={playAll}
          className="w-14 h-14 bg-lpotify-green rounded-full flex items-center justify-center hover:scale-105 hover:bg-lpotify-green-light transition-all shadow-lg shadow-lpotify-green/30"
        >
          <Play size={24} className="text-black ml-1" fill="black" />
        </button>
      </div>

      {/* Track List */}
      <div className="px-2">
        {selectedPlaylist.tracks.length > 0 ? (
          <TrackList tracks={selectedPlaylist.tracks} />
        ) : (
          <div className="text-center py-16">
            <Music size={48} className="text-lpotify-gray mx-auto mb-4" />
            <p className="text-lpotify-gray-light">{t('emptyPlaylist')}</p>
            <p className="text-sm text-lpotify-gray-light mt-1">{t('emptyPlaylistHint')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
