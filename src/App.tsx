import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Player from './components/Player';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import LibraryPage from './pages/LibraryPage';
import DownloadsPage from './pages/DownloadsPage';
import PlaylistPage from './pages/PlaylistPage';
import SettingsPage from './pages/SettingsPage';
import { useAppStore } from './store/appStore';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  useAudioPlayer();
  const { notification } = useKeyboardShortcuts();
  const { currentView } = useAppStore();
  const navigate = useNavigate();

  const renderPage = () => {
    switch (currentView) {
      case 'home':
        return <HomePage />;
      case 'search':
        return <SearchPage />;
      case 'library':
        return <LibraryPage />;
      case 'downloads':
        return <DownloadsPage />;
      case 'playlist':
        return <PlaylistPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-black overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Masaüstü kenar çubuğu: lg ve üzeri */}
        <div className="hidden lg:flex h-full">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-lpotify-gray-dark to-lpotify-dark" style={{ WebkitOverflowScrolling: 'touch' }}>
          {renderPage()}
        </main>
      </div>
      {/* Mobil alt gezinme çubuğu (lg altı) */}
      <BottomNav />
      <Player />

      {/* Kısayol Bildirim Rozeti (Fn / F7 / F8 / Space vb.) */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-slide-up">
          <div className="bg-[#181818]/95 backdrop-blur-md border border-white/10 text-white font-semibold text-sm px-4 py-2 rounded-full shadow-2xl flex items-center gap-2">
            <span>{notification}</span>
          </div>
        </div>
      )}
    </div>
  );
}
