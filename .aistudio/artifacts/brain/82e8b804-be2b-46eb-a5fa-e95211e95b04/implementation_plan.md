# Lpotify: Ses Oynatma Gecikmesi, Şarkı Atlama ve Dil Tutarsızlığı Düzeltme Planı

Bu plan, kullanıcının bildirdiği iki temel sorunu çözmeyi amaçlar:
1. **Ses Oynatma ve İndirme Sorunları**: Beğenilen şarkılar ve indirilen parçalar dinlenirken yaşanan başlatma gecikmeleri ("geç açılma"), 30 saniyelik Deezer önizlemeleri sonrası veya ağ hatasında şarkının aniden sıradakine atlaması ve tarayıcıda indirilen şarkıların IndexedDB önbelleğinden çalınamaması.
2. **Çok Dilli (i18n) Tutarsızlıkları**: Ayarlardan İngilizce seçilse bile arayüzde (Sidebar, Kitaplık, Çalma Listesi başlığı, şarkı sayıları) kalan sabit Türkçe ifadelerin ve yerel depolamadaki ("Beğenilen Şarkılar") sabit metinlerin dinamik çeviriye bağlanması.

---

### Kullanıcı Onayı ve Kritik Kararlar

> [!IMPORTANT]
> Kullanıcı tarafından bildirilen geri bildirimler doğrultusunda şu kararlar netleştirilmiştir:

- **Karar 1 (Çevrimdışı İndirme ve Ses Kaynağı)**: Tarayıcı ortamında indirilen şarkılar (`IndexedDB` içindeki `CachedAudio` blob verisi) `useAudioPlayer` içinde öncelikli olarak kontrol edilecek. Böylece indirilen şarkılar internete veya süresi dolmuş CDN linklerine ihtiyaç duymadan anında çalacak.
- **Karar 2 (30 Saniye Sınırı ve Şarkı Atlama)**: Deezer önizlemeleri doğası gereği 30 saniyedir. Tarayıcıda da Internet Archive ve tam parça çözümlemesi devreye sokulacak; parça süresi ve yükleme hatalarında kontrolsüz sonraki şarkıya atlama engellenip kullanıcıya net durum gösterilecek.
- **Karar 3 (Dinamik Yerelleştirme)**: Sistem dili ne olursa olsun kullanıcının `Ayarlar` üzerinden seçtiği dil tercihi mutlak otorite olacak. Sabit `Beğenilen Şarkılar`, `şarkı` gibi gömülü Türkçe ifadeler `useT()` sözlüğüne bağlanacak; `liked-songs` ID'sine sahip çalma listesinin adı ve açıklaması anlık seçili dilde render edilecek.

---

### 1. Genel Bakış ve Kapsam

- **Oynatma Kararlılığı**:
  - `src/hooks/useAudioPlayer.ts` dosyasında `getCachedTrackBlobUrl` kontrolünü `isElectron()` koşulundan çıkarıp hem web hem masaüstü için birinci öncelikli ses kaynağı haline getirmek.
  - Web modunda tam parça arama ve önbellekleme (`resolveTrack`) akışını etkinleştirerek sadece 30 saniyelik önizlemeyle sınırlı kalmayı ve ansızın şarkı sonuna gelip atlamayı önlemek.
  - Ağ kopması veya ses formatı hatasında kullanıcıya görsel bildirim sağlamak, arka arkaya şarkı atlama döngüsünü (skipping loop) önlemek.
- **Dil ve Metin Bütünlüğü**:
  - `src/i18n.ts` sözlüğünü genişleterek eksik anahtarları eklemek (`likedSongsDesc`, `unknownArtist`, `unknownTitle`, `singleTrack`, `loadingAudio`, `audioError`).
  - `Sidebar.tsx`, `LibraryPage.tsx`, `PlaylistPage.tsx`, `TrackList.tsx` ve `musicApi.ts` içerisindeki tüm sabit Türkçe stringleri `t(...)` fonksiyonu ile dinamik hale getirmek.
  - `liked-songs` listesinin adını depolanan statik metinden değil, o anki dilden dinamik okumak (`playlist.id === 'liked-songs' ? t('likedSongs') : playlist.name`).

---

### 2. Kullanıcı Deneyimi ve Arayüz Akışı

- **Ses Çalma Deneyimi**:
  - Bir şarkıya tıklandığında ses kaynağı hazırlanırken (IndexedDB blob veya ağ akışı) oynatıcı butonunda akıcı bir yükleniyor durumu belirecek.
  - İndirilenler sayfasından veya Kitaplıktan bir şarkı seçildiğinde çevrimdışı blob anında devreye girerek sıfır gecikmeyle müzik başlayacak.
- **Dil Geçişi Deneyimi**:
  - Ayarlar sayfasında "English" seçildiğinde sayfa yenilenmesine gerek kalmadan sol menü ("Liked Songs", "X songs"), Kitaplık kartları ("Liked Songs"), Çalma Listesi başlıkları ve şarkı listesi sütunları tek bir Türkçe kelime sızıntısı olmadan eksiksiz İngilizceye dönecek.
  - "Türkçe" seçildiğinde aynı şekilde kusursuz Türkçe terminoloji görüntülenecek.

---

### 3. Teknik Kararlar ve Mimari Yaklaşım

- **Karar 1: Ses Kaynağı Çözümleme Sıralaması (Priority Pipeline)**:
  - *1. Öncelik*: Yerel dosya yolu (`track.filePath` - Electron).
  - *2. Öncelik*: IndexedDB Çevrimdışı Önbelleği (`getCachedTrackBlobUrl(track.id)` - Web & Masaüstü).
  - *3. Öncelik*: Bellekteki taze akış URL'si / Tam parça çözümü (`resolveTrack`).
  - *4. Öncelik*: Orijinal önizleme akışı (`track.audioUrl`).
  - *Gerekçe*: İndirilen şarkılar ve beğenilen parçalarda ağ beklemesini ve 30 saniyede kesilip sonraki parçaya atlamayı tamamen ortadan kaldırır.
- **Karar 2: Güvenli Hata Yönetimi (Playback Resilience)**:
  - Bir ses URL'si 404/403 veya CORS hatası verirse, sessizce sonsuz şarkı atlama döngüsüne girmek yerine en fazla 1 alternatif kaynak denenip, başarısız olursa oynatıcı durdurulacak ve kullanıcıya açıkça bilgi verilecek.
- **Karar 3: Saklanan Veri ile Dinamik Dilin Ayrıştırılması**:
  - Özel kullanıcı listeleri kullanıcı tarafından adlandırıldığı için girilen ismi korur; ancak sistem listesi olan `liked-songs`, UI tarafında her zaman `t('likedSongs')` olarak çözümlenir.

---

### 4. Teknik Mimari ve Bileşen Haritası

```
┌─────────────────────────────────────────────────────────────┐
│                       useI18n Store                         │
│  - lang: 'tr' | 'en' (localStorage 'lpotify-lang' kalıcı)   │
│  - t(key): Anında dil güncellemesi & re-render              │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       ┌───────▼────────┐             ┌───────▼────────┐
       │ Sidebar/Pages  │             │  Player / List │
       │ Dinamik t(...) │             │  Dinamik t(...)│
       └────────────────┘             └───────┬────────┘
                                              │
┌─────────────────────────────────────────────▼───────────────┐
│                    useAudioPlayer Hook                      │
│                                                             │
│ 1. Check IDB Blob: getCachedTrackBlobUrl(track.id) [WEB/APP]│
│ 2. Check File Path: getLocalAudioUrl(track.filePath)        │
│ 3. Resolve Full Track: resolveTrack(track)                  │
│ 4. Fallback Audio URL: track.audioUrl                       │
│                                                             │
│ Howler Instance:                                            │
│ - onload: Duration update, seek sync                        │
│ - onend: Handle repeat mode & controlled advance            │
│ - onloaderror: Safe fallback without abrupt track skipping  │
└─────────────────────────────────────────────────────────────┘
```

---

### Doğrulama ve Test Adımları

1. **Dil Değişimi Doğrulaması**:
   - Ayarlar sayfasına gidip dili İngilizceye almak.
   - Sidebar'da "Liked Songs", "X songs" yazısını teyit etmek.
   - Kitaplıkta "Liked Songs" başlığını, kart altındaki "X songs" yazısını kontrol etmek.
   - Beğenilen Şarkılar detay sayfasına girildiğinde başlığın "Liked Songs" olarak göründüğünü teyit etmek.
   - Türkçe bilgisayar ortamında bile İngilizce seçiminin kesinlikle korunup hiçbir Türkçe kelimenin kalmadığını doğrulamak.
2. **Ses Çalma ve İndirme Doğrulaması**:
   - Bir şarkıyı indirmek (Download butonu) ve İndirilenler sayfasında çalmak; ağ sekmesinde uzaktan istek atmadan IndexedDB blob üzerinden anında çaldığını doğrulamak.
   - Beğenilen şarkılardan parça başlatmak; şarkının gecikmesiz başladığını ve kontrolsüz sonraki şarkıya atlamadığını test etmek.
   - TypeScript derleme kontrolü (`npm run lint` ve `compile_applet`) ile tam derleme başarısını sağlamak.
