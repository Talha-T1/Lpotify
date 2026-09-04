import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import LibraryPage from './pages/LibraryPage';
import DownloadsPage from './pages/DownloadsPage';
import PlaylistPage from './pages/PlaylistPage';
import SettingsPage from './pages/SettingsPage';
import { useAppStore } from './store/appStore';
import { useAudioPlayer } from './hooks/useAudioPlayer';

export default function App() {
  useAudioPlayer();
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
    <div className="h-full w-full flex flex-col bg-black overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-lpotify-gray-dark to-lpotify-dark">
          {renderPage()}
        </main>
      </div>
      <Player />
    </div>
  );
}
