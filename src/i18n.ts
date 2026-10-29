/**
 * Lpotify çok dilli destek (TR / EN).
 * Dil seçimi Ayarlar sayfasından yapılır ve kalıcı saklanır.
 */
import { create } from 'zustand';

export type Lang = 'tr' | 'en';

const dict = {
  tr: {
    home: 'Ana Sayfa',
    search: 'Ara',
    library: 'Kitaplık',
    downloads: 'İndirilenler',
    settings: 'Ayarlar',
    playlists: 'Çalma Listeleri',
    likedSongs: 'Beğenilen Şarkılar',
    playlistLabel: 'Çalma Listesi',
    songs: 'şarkı',
    chooseSong: 'Müzik dinlemek için bir şarkı seçin',
    downloadsTitle: 'İndirilenler',
    downloadsDesc: 'Çevrimdışı dinlemek için indirdiğiniz şarkılar',
    noDownloads: 'Henüz indirme yok',
    noDownloadsHint: 'Şarkıların yanındaki indirme butonuna tıklayarak çevrimdışı dinleme için indirebilirsiniz. İndirilen şarkılar burada görünecektir.',
    downloaded: 'şarkı indirildi',
    yourLibrary: 'Kitaplığınız',
    importConfig: '.Lpfcfg İçe Aktar',
    settingsTitle: 'Ayarlar',
    language: 'Dil',
    languageHint: 'Uygulama dilini seçin. Seçim kalıcı olarak saklanır.',
    openDownloadsFolder: '"download mp" Klasörünü Aç',
    folderHint: 'İndirilen şarkılar Müzikler klasörü altındaki "download mp" klasörüne kaydedilir.',
    todayMix: "Bugünün Karışımı",
    todayMixDesc: 'Lpotify tarafından size özel hazırlanan karışım',
    featured: 'Öne Çıkanlar',
    newReleases: 'Yeni Çıkanlar',
    chillMode: 'Chill Modu',
    backToLibrary: 'Kitaplığa Dön',
    emptyPlaylist: 'Bu çalma listesi boş',
    emptyPlaylistHint: 'Arama yaparak şarkı ekleyebilirsiniz',
    playlistNotFound: 'Çalma listesi bulunamadı',
    createPlaylist: 'Yeni Çalma Listesi Oluştur',
    playlistName: 'Çalma listesi adı...',
    cancel: 'İptal',
    create: 'Oluştur',
    searchPlaceholder: 'Ne dinlemek istiyorsun?',
    browseAll: 'Tümüne Göz At',
    resultsFor: 'için sonuçlar',
    noResults: 'Sonuç bulunamadı',
    noResultsHint: 'Farklı bir arama terimi deneyin',
    trackTitle: 'Başlık',
    album: 'Albüm',
    duration: 'Süre',
    shareFileName: 'Paylaşma Dosyası Adı',
    shareFileHint: 'Dosya adını istediğin gibi yaz; uzantı otomatik olarak .Lpfcfg olur.',
    share: 'Paylaş',
    exportNotice: 'indirildi. Dosyayı istediğin kişiyle paylaşabilirsin — içe aktarmak için yukarıdaki butonu kullan.',
    invalidConfig: 'Geçersiz veya bozuk .Lpfcfg dosyası.',
    importNotice: 'çalma listesi içe aktarıldı',
    shareAs: '.Lpfcfg olarak paylaş',
    playlistsLabel: 'Çalma Listesi',
    likedSongsDesc: 'Beğendiğiniz tüm şarkılar',
    unknownArtist: 'Bilinmeyen Sanatçı',
    unknownTrack: 'Bilinmeyen Şarkı',
    singleAlbum: 'Tekli',
    sharedList: 'Paylaşılan Liste',
    audioLoadError: 'Ses yüklenemedi',
    audioPlayingFull: 'Tam şarkı çalınıyor',
    audioPlayingPreview: 'Önizleme çalınıyor (30 sn)',
    miniPlayer: 'Mini Oynatıcı',
    previous: 'Önceki Şarkı',
    next: 'Sıradaki Şarkı',
    play: 'Çal',
    pause: 'Durdur',
    addToPlaylist: 'Çalma listesine ekle',
    noPlaylists: 'Önce bir çalma listesi oluşturun',
    deletePlaylist: 'Çalma listesini sil',
  },
  en: {
    home: 'Home',
    search: 'Search',
    library: 'Your Library',
    downloads: 'Downloads',
    settings: 'Settings',
    playlists: 'Playlists',
    likedSongs: 'Liked Songs',
    playlistLabel: 'Playlist',
    songs: 'songs',
    chooseSong: 'Choose a song to listen to',
    downloadsTitle: 'Downloads',
    downloadsDesc: 'Songs you downloaded for offline listening',
    noDownloads: 'No downloads yet',
    noDownloadsHint: 'Click the download button next to songs to download them for offline listening. Downloaded songs will appear here.',
    downloaded: 'songs downloaded',
    yourLibrary: 'Your Library',
    importConfig: 'Import .Lpfcfg',
    settingsTitle: 'Settings',
    language: 'Language',
    languageHint: 'Select the app language. Your choice is saved permanently.',
    openDownloadsFolder: 'Open "download mp" Folder',
    folderHint: 'Downloaded songs are saved to the "download mp" folder under your Music folder.',
    todayMix: "Today's Mix",
    todayMixDesc: 'A mix prepared specially for you by Lpotify',
    featured: 'Featured',
    newReleases: 'New Releases',
    chillMode: 'Chill Mode',
    backToLibrary: 'Back to Library',
    emptyPlaylist: 'This playlist is empty',
    emptyPlaylistHint: 'You can add songs by searching',
    playlistNotFound: 'Playlist not found',
    createPlaylist: 'Create New Playlist',
    playlistName: 'Playlist name...',
    cancel: 'Cancel',
    create: 'Create',
    searchPlaceholder: 'What do you want to listen to?',
    browseAll: 'Browse All',
    resultsFor: 'results for',
    noResults: 'No results found',
    noResultsHint: 'Try a different search term',
    trackTitle: 'Title',
    album: 'Album',
    duration: 'Duration',
    shareFileName: 'Share File Name',
    shareFileHint: 'Type any name you like; the extension will automatically be .Lpfcfg.',
    share: 'Share',
    exportNotice: 'downloaded. Share the file with anyone — they can import it using the button above.',
    invalidConfig: 'Invalid or corrupted .Lpfcfg file.',
    importNotice: 'playlist imported',
    shareAs: 'Share as .Lpfcfg',
    playlistsLabel: 'Playlist',
    likedSongsDesc: 'All your favorite songs',
    unknownArtist: 'Unknown Artist',
    unknownTrack: 'Unknown Track',
    singleAlbum: 'Single',
    sharedList: 'Shared Playlist',
    audioLoadError: 'Failed to load audio',
    audioPlayingFull: 'Playing full track',
    audioPlayingPreview: 'Playing preview (30s)',
    miniPlayer: 'Mini Player',
    previous: 'Previous Track',
    next: 'Next Track',
    play: 'Play',
    pause: 'Pause',
    addToPlaylist: 'Add to playlist',
    noPlaylists: 'Create a playlist first',
    deletePlaylist: 'Delete playlist',
  },
} as const;

export type TranslationKey = keyof typeof dict.tr;

interface I18nStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

function loadLang(): Lang {
  try {
    const l = localStorage.getItem('lpotify-lang');
    if (l === 'en' || l === 'tr') return l;
  } catch { /* ignore */ }
  // Kurulumda ve ilk açılışta varsayılan olarak doğrudan Türkçe başlar.
  return 'tr';
}

export const useI18n = create<I18nStore>((set) => ({
  lang: loadLang(),
  setLang: (lang) => {
    try { localStorage.setItem('lpotify-lang', lang); } catch { /* ignore */ }
    document.title = 'Lpotify';
    set({ lang });
  },
}));

/** Çeviri fonksiyonu: const t = useT(); t('home') */
export function useT() {
  const lang = useI18n((s) => s.lang);
  return (key: TranslationKey): string => (dict[lang] as Record<string, string>)[key] ?? key;
}
