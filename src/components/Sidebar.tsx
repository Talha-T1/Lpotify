import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Download, Plus, Heart, Music, Settings } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { usePlaylistStore } from '../store/playlistStore';
import { useT } from '../i18n';

export default function Sidebar() {
  const { currentView, setCurrentView, setSelectedPlaylist } = useAppStore();
  const { playlists, createPlaylist } = usePlaylistStore();
  const t = useT();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const likedPlaylist = playlists.find((p) => p.id === 'liked-songs');

  const openLiked = () => {
    if (likedPlaylist) {
      setSelectedPlaylist(likedPlaylist);
      setCurrentView('playlist');
    }
  };

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreateModal(false);
    }
  };

  const navItems = [
    { icon: Home, label: t('home'), view: 'home' as const, path: '/' },
    { icon: Search, label: t('search'), view: 'search' as const, path: '/search' },
    { icon: Library, label: t('library'), view: 'library' as const, path: '/library' },
    { icon: Download, label: t('downloads'), view: 'downloads' as const, path: '/downloads' },
    { icon: Settings, label: t('settings'), view: 'settings' as const, path: '/settings' },
  ];

  return (
    <aside className="w-[280px] bg-black flex flex-col h-full shrink-0">
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          {/* 180 derece çevrilmiş Spotify logosu (Lpotify logosu) */}
          <svg viewBox="0 0 100 100" className="w-11 h-11 rounded-full shrink-0" aria-label="Lpotify">
            <circle cx="50" cy="50" r="48" fill="#1DB954" />
            <path d="M73 40 Q50 53 25 44" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" />
            <path d="M70 28 Q50 39 29 32" fill="none" stroke="#000" strokeWidth="7" strokeLinecap="round" />
            <path d="M66 17 Q50 26 33 20" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
          </svg>
          <h1 className="text-2xl font-bold text-white">Lpotify</h1>
        </div>
      </div>

      <nav className="px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.view}
            to={item.path}
            onClick={() => setCurrentView(item.view)}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive || currentView === item.view
                  ? 'bg-lpotify-gray text-white'
                  : 'text-lpotify-gray-light hover:text-white'
              }`
            }
          >
            <item.icon size={24} className="group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mx-6 my-4 border-t border-lpotify-gray" />

      <div className="flex-1 overflow-y-auto px-2">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-bold text-lpotify-gray-light uppercase tracking-wider">
            {t('playlists')}
          </span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 rounded-full hover:bg-lpotify-gray text-lpotify-gray-light hover:text-white transition-all"
          >
            <Plus size={18} />
          </button>
        </div>

        <NavLink
          to="/library"
          onClick={openLiked}
          className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-lpotify-gray transition-all group"
        >
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-700 to-blue-300 rounded flex items-center justify-center">
            <Heart size={14} className="text-white" fill="white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm text-white font-medium">{t('likedSongs')}</span>
            <span className="text-xs text-lpotify-gray-light">{t('playlistLabel')}</span>
          </div>
        </NavLink>

        {playlists.filter(p => p.id !== 'liked-songs').map((playlist) => (
          <NavLink
            key={playlist.id}
            to="/"
            onClick={() => setCurrentView('playlist')}
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-lpotify-gray transition-all"
          >
            <div className="w-8 h-8 bg-lpotify-gray rounded flex items-center justify-center">
              <Music size={14} className="text-lpotify-gray-light" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm text-white font-medium truncate">{playlist.name}</span>
              <span className="text-xs text-lpotify-gray-light">
                {playlist.tracks.length} şarkı
              </span>
            </div>
          </NavLink>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-lpotify-gray-dark rounded-xl p-6 w-[400px] animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4">{t('createPlaylist')}</h2>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder={t('playlistName')}
              className="w-full px-4 py-3 bg-lpotify-gray border border-lpotify-gray-light/20 rounded-lg text-white placeholder-lpotify-gray-light focus:outline-none focus:border-lpotify-green"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-lpotify-gray-light hover:text-white font-semibold transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreatePlaylist}
                className="px-6 py-2 bg-lpotify-green text-black font-bold rounded-full hover:scale-105 transition-transform"
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
