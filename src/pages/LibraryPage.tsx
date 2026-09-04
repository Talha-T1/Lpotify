import React, { useState } from 'react';
import { Music, Heart, Plus, Trash2, Share2, FileUp, AlertCircle } from 'lucide-react';
import { usePlaylistStore } from '../store/playlistStore';
import { useAppStore } from '../store/appStore';
import {
  createShareConfig, saveShareConfigFile, readShareConfigFile,
} from '../utils/shareConfig';
import { useT } from '../i18n';

export default function LibraryPage() {
  const { playlists, deletePlaylist, createPlaylist } = usePlaylistStore();
  const { setCurrentView, setSelectedPlaylist } = useAppStore();
  const t = useT();
  const [notice, setNotice] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ id: string; name: string } | null>(null);
  const [customName, setCustomName] = useState('');

  const likedPlaylist = playlists.find((p) => p.id === 'liked-songs');

  const handlePlaylistClick = (playlist: typeof playlists[0]) => {
    setSelectedPlaylist(playlist);
    setCurrentView('playlist');
  };

  // Çalma listesini .Lpfcfg paylaşma dosyası olarak indir.
  const handleExportConfig = () => {
    if (!naming) return;
    const playlist = playlists.find((p) => p.id === naming.id);
    if (!playlist) return;
    const config = createShareConfig(playlist.name, playlist.description, playlist.tracks);
    saveShareConfigFile(config, customName);
    setNaming(null);
    setNotice(`"${customName}.Lpfcfg" ${t('exportNotice')}`);
  };

  // .Lpfcfg dosyasını seç ve içeri aktar.
  const handleImportConfig = async () => {
    const config = await readShareConfigFile();
    if (!config) {
      setNotice(t('invalidConfig'));
      return;
    }
    createPlaylist(config.name || 'Paylaşılan Liste', config.description || '');
    // En son oluşturulan listeye şarkıları ekle.
    const all = usePlaylistStore.getState().playlists;
    const target = all[all.length - 1];
    config.tracks.forEach((t) => usePlaylistStore.getState().addToPlaylist(target.id, {
      id: t.id || 'shared-' + Math.random().toString(36).slice(2),
      title: t.title || 'Bilinmeyen',
      artist: t.artist || 'Bilinmeyen Sanatçı',
      album: t.album || 'Tekli',
      duration: t.duration || 0,
      coverUrl: t.coverUrl || '',
      audioUrl: t.audioUrl || '',
      source: t.source || 'deezer',
    }));
    setNotice(`"${config.name}" ${t('importNotice')} (${config.tracks.length} ${t('songs')}).`);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <LibraryIcon />
          <h1 className="text-3xl font-bold text-white">{t('yourLibrary')}</h1>
        </div>
        <button
          onClick={handleImportConfig}
          className="flex items-center gap-2 px-4 py-2 bg-lpotify-card hover:bg-lpotify-hover text-white font-semibold rounded-full transition-colors"
        >
          <FileUp size={16} />
          {t('importConfig')}
        </button>
      </div>

      {notice && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-lg bg-lpotify-card border border-lpotify-gray/40 text-sm text-white">
          <AlertCircle size={16} className="text-lpotify-green shrink-0" />
          {notice}
          <button onClick={() => setNotice(null)} className="ml-auto text-lpotify-gray-light hover:text-white">✕</button>
        </div>
      )}

      {/* Liked Songs Card */}
      <div
        onClick={() => likedPlaylist && handlePlaylistClick(likedPlaylist)}
        className="mb-8 bg-gradient-to-br from-indigo-800 to-blue-400 p-6 rounded-xl cursor-pointer hover:scale-[1.02] transition-transform"
      >
        <div className="flex items-center gap-3 mb-3">
          <Heart size={24} className="text-white" fill="white" />
          <h2 className="text-2xl font-bold text-white">Beğenilen Şarkılar</h2>
        </div>
        <p className="text-white/70 text-sm">{playlists[0]?.tracks.length || 0} şarkı</p>
      </div>

      {/* Playlists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {playlists.filter(p => p.id !== 'liked-songs').map((playlist) => (
          <div
            key={playlist.id}
            onClick={() => handlePlaylistClick(playlist)}
            className="bg-lpotify-card hover:bg-lpotify-hover p-4 rounded-lg cursor-pointer group transition-all"
          >
            <div className="relative mb-4">
              {playlist.tracks.length > 0 ? (
                <div className="grid grid-cols-2 gap-0.5 rounded-md overflow-hidden aspect-square">
                  {playlist.tracks.slice(0, 4).map((track, i) => (
                    <img key={i} src={track.coverUrl} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/default/150/150'; }} />
                  ))}
                  {playlist.tracks.length < 4 && (
                    <div className="bg-lpotify-gray flex items-center justify-center aspect-square">
                      <Music size={24} className="text-lpotify-gray-light" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-square bg-lpotify-gray rounded-md flex items-center justify-center">
                  <Music size={48} className="text-lpotify-gray-light" />
                </div>
              )}
            </div>
            <p className="text-sm font-semibold text-white truncate">{playlist.name}</p>
            <p className="text-xs text-lpotify-gray-light mt-1">{playlist.tracks.length} şarkı</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setNaming({ id: playlist.id, name: playlist.name });
                  setCustomName(playlist.name);
                }}
                title={t('shareAs')}
                className="p-1 text-lpotify-gray-light hover:text-lpotify-green opacity-0 group-hover:opacity-100 transition-all"
              >
                <Share2 size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id); }}
                className="p-1 text-lpotify-gray-light hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {naming && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-lpotify-gray-dark rounded-xl p-6 w-[420px] animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-2">{t('shareFileName')}</h2>
            <p className="text-xs text-lpotify-gray-light mb-4">
              {t('shareFileHint')}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleExportConfig()}
                className="flex-1 px-4 py-3 bg-lpotify-gray border border-lpotify-gray-light/20 rounded-lg text-white placeholder-lpotify-gray-light focus:outline-none focus:border-lpotify-green"
              />
              <span className="text-lpotify-green font-bold">.Lpfcfg</span>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setNaming(null)}
                className="px-4 py-2 text-lpotify-gray-light hover:text-white font-semibold transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleExportConfig}
                className="px-6 py-2 bg-lpotify-green text-black font-bold rounded-full hover:scale-105 transition-transform"
              >
                {t('share')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LibraryIcon() {
  return (
    <div className="flex items-end gap-[3px] h-8">
      <div className="w-[3px] h-full bg-lpotify-green rounded-full" />
      <div className="w-[3px] h-[70%] bg-lpotify-green rounded-full" />
      <div className="w-[3px] h-[50%] bg-lpotify-green rounded-full" />
      <div className="w-[3px] h-[85%] bg-lpotify-green rounded-full" />
    </div>
  );
}
