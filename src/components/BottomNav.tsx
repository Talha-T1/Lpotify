import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Download, Settings } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useT } from '../i18n';

/**
 * Mobil alt gezinme çubuğu (yalnızca küçük ekranlarda görünür).
 */
export default function BottomNav() {
  const t = useT();
  const { currentView, setCurrentView } = useAppStore();

  const items = [
    { icon: Home, label: t('home'), view: 'home', path: '/' },
    { icon: Search, label: t('search'), view: 'search', path: '/search' },
    { icon: Library, label: t('library'), view: 'library', path: '/library' },
    { icon: Download, label: t('downloads'), view: 'downloads', path: '/downloads' },
    { icon: Settings, label: t('settings'), view: 'settings', path: '/settings' },
  ];

  return (
    <nav className="lg:hidden flex items-center justify-around bg-black border-t border-lpotify-gray/50 shrink-0 z-40 pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => (
        <NavLink
          key={item.view}
          to={item.path}
          onClick={() => setCurrentView(item.view as any)}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] transition-colors ${
              isActive || currentView === item.view ? 'text-white' : 'text-lpotify-gray-light'
            }`
          }
        >
          <item.icon size={22} />
          <span className="text-[10px] font-semibold">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}