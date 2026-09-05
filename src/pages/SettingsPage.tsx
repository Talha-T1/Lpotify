import React from 'react';
import { Settings as SettingsIcon, Globe, FolderOpen } from 'lucide-react';
import { useI18n, useT, Lang } from '../i18n';
import { openDownloadsFolder, getDownloadsDir } from '../utils/electronBridge';
import { useAppStore } from '../store/appStore';

export default function SettingsPage() {
  const t = useT();
  const { lang, setLang } = useI18n();
  const { setCurrentView } = useAppStore();
  const [dir, setDir] = React.useState<string | null>(null);

  React.useEffect(() => {
    getDownloadsDir().then(setDir);
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon size={32} className="text-lpotify-green" />
        <h1 className="text-3xl font-bold text-white">{t('settingsTitle')}</h1>
      </div>

      {/* Dil seçimi */}
      <div className="bg-lpotify-card p-6 rounded-xl mb-6 max-w-xl">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={20} className="text-lpotify-green" />
          <h2 className="text-lg font-bold text-white">{t('language')}</h2>
        </div>
        <p className="text-lpotify-gray-light text-sm mb-4">{t('languageHint')}</p>
        <div className="flex gap-3">
          {(['tr', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-5 py-2 rounded-full font-semibold transition-all ${
                lang === l
                  ? 'bg-lpotify-green text-black'
                  : 'bg-lpotify-gray text-white hover:bg-lpotify-hover'
              }`}
            >
              {l === 'tr' ? '🇹🇷 Türkçe' : '🇬🇧 English'}
            </button>
          ))}
        </div>
      </div>

      {/* İndirme klasörü */}
      <div className="bg-lpotify-card p-6 rounded-xl max-w-xl">
        <div className="flex items-center gap-2 mb-1">
          <FolderOpen size={20} className="text-lpotify-green" />
          <h2 className="text-lg font-bold text-white">{t('openDownloadsFolder')}</h2>
        </div>
        <p className="text-lpotify-gray-light text-sm mb-4">
          {t('folderHint')}
          {dir && <span className="block mt-1 font-mono text-xs text-white/60 break-all">{dir}</span>}
        </p>
        <button
          onClick={() => openDownloadsFolder()}
          className="px-5 py-2 bg-lpotify-green text-black font-bold rounded-full hover:scale-105 transition-transform"
        >
          {t('openDownloadsFolder')}
        </button>
      </div>
    </div>
  );
}