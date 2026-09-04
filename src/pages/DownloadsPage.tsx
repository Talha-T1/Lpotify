import React from 'react';
import { Download, Trash2, HardDrive } from 'lucide-react';
import { useDownloadsStore } from '../store/downloadsStore';
import TrackList from '../components/TrackList';
import { useT } from '../i18n';

export default function DownloadsPage() {
  const { downloads, removeDownload } = useDownloadsStore();
  const t = useT();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <Download size={32} className="text-lpotify-green" />
        <div>
          <h1 className="text-3xl font-bold text-white">{t('downloadsTitle')}</h1>
          <p className="text-lpotify-gray-light text-sm mt-1">
            {t('downloadsDesc')}
          </p>
        </div>
      </div>

      {downloads.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-lpotify-gray-light">{downloads.length} {t('downloaded')}</span>
          </div>
          <TrackList tracks={downloads} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <HardDrive size={64} className="text-lpotify-gray mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{t('noDownloads')}</h2>
          <p className="text-lpotify-gray-light text-center max-w-md">
            {t('noDownloadsHint')}
          </p>
        </div>
      )}
    </div>
  );
}
