/**
 * Lpotify müzik paylaşma config'i (.Lpfcfg).
 * İsteyen dosyaya istediği adı verebilir; önemli olan uzantının .Lpfcfg olması.
 * Dosya içeriği: JSON — çalma listesi adı + şarkı bilgileri.
 */
import { Track } from '../types';

export interface LpfShareConfig {
  app: 'Lpotify';
  type: 'lpf-share-config';
  version: 1;
  name: string;
  description: string;
  createdAt: string;
  tracks: Track[];
}

export function createShareConfig(name: string, description: string, tracks: Track[]): LpfShareConfig {
  return {
    app: 'Lpotify',
    type: 'lpf-share-config',
    version: 1,
    name,
    description,
    createdAt: new Date().toISOString(),
    tracks,
  };
}

/** Config dosyasını <istediğin-ad>.Lpfcfg olarak indirir. */
export function saveShareConfigFile(config: LpfShareConfig, fileName?: string): void {
  const base = (fileName || config.name || 'lpotify-paylasim').replace(/[<>:"/\\|?*]+/g, '').trim() || 'lpotify-paylasim';
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = base + '.Lpfcfg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** .Lpfcfg dosyasını okuyup doğrular; geçersizse null döner. */
export async function readShareConfigFile(): Promise<LpfShareConfig | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.Lpfcfg,.lpfcfg';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data?.app !== 'Lpotify' || data?.type !== 'lpf-share-config' || !Array.isArray(data.tracks)) {
          return resolve(null);
        }
        resolve(data as LpfShareConfig);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}