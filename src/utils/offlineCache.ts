// Real offline audio cache using IndexedDB.
// Internet Archive serves CORS=* so full audio can be downloaded and stored locally
// for true offline playback.

const DB_NAME = 'lpotify-offline';
const STORE = 'tracks';
const VERSION = 1;

interface CachedAudio {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  duration: number;
  audioBlob: Blob;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function withStore(mode: IDBTransactionMode, op: (store: IDBObjectStore) => void): Promise<void> {
  return openDb().then((db) => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    op(store);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

export async function cacheTrack(track: { id: string; title: string; artist: string; coverUrl: string; duration: number; audioUrl: string }): Promise<CachedAudio> {
  const response = await fetch(track.audioUrl);
  if (!response.ok) {
    throw new Error('İndirme başarısız (' + response.status + ')');
  }
  const audioBlob = await response.blob();
  const record: CachedAudio = {
    id: track.id,
    title: track.title,
    artist: track.artist,
    coverUrl: track.coverUrl,
    duration: track.duration,
    audioBlob,
    savedAt: Date.now(),
  };
  await withStore('readwrite', (store) => store.put(record));
  return record;
}

export async function getCachedTrack(id: string): Promise<CachedAudio | undefined> {
  return openDb().then((db) => new Promise<CachedAudio | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as CachedAudio | undefined);
    request.onerror = () => reject(request.error);
  }));
}

export async function getCachedTrackBlobUrl(id: string): Promise<string | null> {
  const record = await getCachedTrack(id);
  if (!record || !record.audioBlob) {
    return null;
  }
  return URL.createObjectURL(record.audioBlob);
}

export async function hasCachedTrack(id: string): Promise<boolean> {
  const record = await getCachedTrack(id);
  return !!record;
}

export async function removeCachedTrack(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clearOfflineCache(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}