<div align="center">

<img src="public/favicon.svg" width="120" alt="Lpotify logo" />

# 🎵 Lpotify

**Free, open-source music app.** Built entirely on top of open-source software.

`Electron` · `React` · `TypeScript` · `Tailwind` · `Howler.js` · `yt-dlp`

**License:** [MIT](./LICENSE)

[![License: MIT](https://img.shields.io/badge/License-MIT-1DB954.svg)](./LICENSE)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Talha--T1%2FLpotify-181717?logo=github)](https://github.com/Talha-T1/Lpotify)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows)](https://github.com/Talha-T1/Lpotify/releases)

</div>

---

## ✨ Features

- 🔍 **Search & discover** — music search via the Deezer catalog, featured tracks, genres
- ▶️ **Full-track playback** — ad-free, full-length audio streams via yt-dlp (not 30s previews!)
- 💾 **Real downloads** — songs are saved as actual audio files into `Music\download mp`; play them with any player you like
- 🔄 **Repeat & shuffle** — repeat one/playlist, shuffle mode
- ⏩ **Seeking** — forward/backward seeking works properly
- ⚡ **Ultra fast** — upcoming tracks are preloaded in the background; resolved streams are kept in a persistent cache (4h)
- 📴 **Offline** — downloaded songs play without internet
- 📋 **Playlists** — create, edit, like — everything is persisted
- 🔗 **Music sharing (.Lpfcfg)** — share playlists as `.Lpfcfg` config files and import them; the file name is fully up to you, the extension is `.Lpfcfg`
- 🌍 **Multilingual** — English / Turkish (system language is auto-detected, changeable in Settings)

## 🚀 Installation (Users)

1. Download `Lpotify Setup x.x.x.exe` from the [Releases](../../releases) page
2. Install & run — that's it

## 🛠️ Development

```bash
git clone https://github.com/Talha-T1/Lpotify.git
cd Lpotify
npm install

npm run app      # run in development mode
npm run dist     # build the Windows setup (.exe)
```

> **Note:** Windows is the target platform; `yt-dlp.exe` is bundled automatically during packaging (`youtube-dl-exec`).

## 🧱 Tech Stack & Licenses

| Component | Purpose | License |
|---|---|---|
| [Electron](https://www.electronjs.org/) | Desktop shell | MIT |
| [React](https://react.dev/) + TypeScript | UI | MIT |
| [Tailwind CSS](https://tailwindcss.com/) | Styling | MIT |
| [Howler.js](https://howlerjs.com/) | Audio playback | MIT |
| [Zustand](https://github.com/pmndrs/zustand) | State management | MIT |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Audio stream resolving | Unlicense (public domain) |
| Deezer public API / Internet Archive | Metadata & archives | — |

All dependencies are permissively licensed.

## ⚠️ Disclaimer

Lpotify is **not affiliated with, endorsed by, or connected to** Spotify or any other company, streaming platform, or brand. The app only uses third-party open-source tools and publicly available resources. Compliance with the copyright laws of your country regarding content access and usage is **the user's responsibility**. This project is intended for educational and personal use.

## 📄 License

This project is licensed under the [MIT License](./LICENSE) — anyone may use it for any purpose; the only requirement is to keep the license notice.

---

<div align="center">

# 🇹🇷 Türkçe

## 🎵 Lpotify — Bedava, Açık Kaynak Müzik Uygulaması

Tamamı açık kaynak programların üzerine inşa edilmiştir.

</div>

## ✨ Özellikler

- 🔍 **Müzik arama ve keşfet** — Deezer kataloğuyla arama, öne çıkanlar, türler
- ▶️ **Tam şarkı çalma** — yt-dlp ile reklamsız, tam uzunlukta ses akışı (30 sn önizleme değil!)
- 💾 **Gerçek indirme** — Şarkılar `Müzikler\download mp` klasörüne gerçek ses dosyası olarak iner; isteyen herhangi bir oynatıcıdan dinleyebilir
- 🔄 **Tekrar & karıştır** — Tek şarkı / liste tekrarı, karıştırma
- ⏩ **Sarma (seek)** — İleri/geri sarma tam çalışır
- ⚡ **Ultra hızlı** — Sıradaki şarkılar arka planda önceden yüklenir; çözümlenen akışlar kalıcı önbellekte tutulur (4 saat)
- 📴 **Çevrimdışı** — İndirilen şarkılar internet olmadan çalar
- 📋 **Çalma listeleri** — Oluştur, düzenle, beğenilenlere ekle — hepsi kalıcı
- 🔗 **Müzik paylaşma (.Lpfcfg)** — Çalma listelerini `.Lpfcfg` config dosyası olarak paylaş ve içe aktar; dosya adı tamamen sana ait, uzantı `.Lpfcfg`
- 🌍 **Çok dilli** — Uygulama içinde Türkçe / İngilizce (sistem dili otomatik algılanır, Ayarlar'dan değiştirilebilir)

## 🚀 Kurulum (Kullanıcılar)

1. [Releases](../../releases) sayfasından `Lpotify Setup x.x.x.exe` indir
2. Kur ve çalıştır — hepsi bu

## 🛠️ Geliştirme

```bash
git clone https://github.com/Talha-T1/Lpotify.git
cd Lpotify
npm install

npm run app      # geliştirme modunda çalıştır
npm run dist     # Windows setup (.exe) üret
```

> **Not:** Windows hedeflenir; `yt-dlp.exe` paketlemede otomatik dahil edilir (`youtube-dl-exec`).

## ⚠️ Sorumluluk Reddi

Lpotify; Spotify ya da başka herhangi bir şirket, yayın platformu veya markayla **bağlantılı, desteklenen veya ortak değildir**. Uygulama yalnızca üçüncü taraf açık kaynak araçlarını ve halka açık kaynakları kullanır. İçeriklere erişim ve kullanımın bulunduğunuz ülkenin telif mevzuatına uygunluğu **kullanıcının sorumluluğundadır**. Proje eğitim ve kişisel kullanım amaçlıdır.

## 📄 Lisans

Bu proje [MIT Lisansı](./LICENSE) ile lisanslanmıştır — kim, ne için, nasıl isterse kullanabilir; tek şart lisans metnini korumaktır.