import { useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import { usePlayerStore } from '../store/playerStore';
import { Track } from '../types';
import { getCachedTrackBlobUrl } from '../utils/offlineCache';
import { resolveTrack } from '../utils/musicApi';
import { resolveAudioFull, filePathToUrl, getLocalAudioUrl, isElectron } from '../utils/electronBridge';
import { resolvedCache, raceResolveQueries, minDurationFor, prefetchTrack, prefetchMany } from '../utils/audioCache';

export function useAudioPlayer() {
  const howlRef = useRef<Howl | null>(null);
  // Yükleme sırası belirteci: yükleme sürerken başka şarkıya geçilirse
  // eski (bayat) yükleme tamamen iptal edilir → şarkılar birbirine karışmaz.
  const loadTokenRef = useRef(0);
  // Yükleme bitmeden yapılan sarma işlemleri yükleme sonrası uygulanır.
  const pendingSeekRef = useRef<number | null>(null);
  // Seek sonrası progress döngüsünün eski konumu geri yazmasını engelleyen mühür.
  const lastSeekAtRef = useRef(0);
  // Şarkı gerçekten çalmaya başladı mı? (hata durumunda sonsuz ilerlemeyi önler)
  const hasPlayedRef = useRef(false);
  const {
    currentTrack,
    isPlaying,
    volume,
    setProgress,
    setDuration,
    setIsPlaying,
    nextTrack,
    prevTrack,
    repeat,
  } = usePlayerStore();

  const loadTrack = useCallback(async (track: Track) => {
    const token = ++loadTokenRef.current;
    hasPlayedRef.current = false;
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    let src = track.audioUrl || '';
    let playTrack = track;

    // 1. ÖNCELİK: İndirilmiş gerçek dosya (Electron)
    if (track.filePath) {
      try {
        src = await getLocalAudioUrl(track.filePath);
      } catch { /* stay online */ }
    } else {
      // 2. ÖNCELİK: IndexedDB Çevrimdışı Önbellek Blobu (Web ve Masaüstü)
      // Bu sayede indirilen parçalar ağa gitmeden, sıfır gecikmeyle anında başlar.
      try {
        const cachedBlobUrl = await getCachedTrackBlobUrl(track.id);
        if (cachedBlobUrl) {
          src = cachedBlobUrl;
        }
      } catch { /* fallback to network */ }
    }

    // 3. ÖNCELİK: Eğer yerel veya çevrimdışı blob yoksa ağ akışını hazırla
    if (src === track.audioUrl || !src) {
      if (isElectron()) {
        try {
          const minDur = minDurationFor(track);
          const q1 = track.artist + ' ' + track.title;
          let full = await raceResolveQueries([
            q1,
            track.title + ' audio',
            track.artist + ' ' + track.title + ' full song',
          ], minDur);
          if (!full) {
            const q2 = track.title + ' song';
            const q3 = track.artist + ' ' + track.title + ' lyrics';
            full = await raceResolveQueries([q2, q3, track.title], minDur, 2000);
          }
          if (full) {
            playTrack = { ...track, audioUrl: full.url, duration: full.duration };
            src = full.url;
          } else {
            playTrack = await resolveTrack(track);
            src = playTrack.audioUrl;
          }
        } catch { /* stay with preview */ }
      } else {
        // Web tarayıcısı:
        // Eğer bellekte veya kalıcı önbellekte tam sürüm varsa hemen kullan
        const cacheKey = track.id || (track.artist + ' ' + track.title);
        const inMemory = resolvedCache.get(cacheKey) || resolvedCache.get(track.id);
        if (inMemory && inMemory.url) {
          src = inMemory.url;
        } else if (!src) {
          // Eğer audioUrl boşsa (örn. bazı listeler) tam parçayı çöz
          try {
            const resolved = await resolveTrack(track);
            if (resolved.audioUrl) {
              src = resolved.audioUrl;
              resolvedCache.set(cacheKey, { url: resolved.audioUrl, duration: resolved.duration });
            }
          } catch { /* ignore */ }
        }
      }
    }

    // Çözümleme sürerken kullanıcı başka şarkıya geçtiyse bu yüklemeyi tamamen bırak.
    if (token !== loadTokenRef.current) return null;

    if (!src) {
      console.warn('No playable audio source found for track:', track.title);
      setIsPlaying(false);
      return null;
    }

    const howl: Howl = new Howl({
      src: [src],
      html5: true,
      volume: volume,
      format: ['mp3', 'ogg', 'wav', 'm4a', 'flac', 'webm'],
      onload: () => {
        if (howlRef.current !== howl) return;
        setDuration(howl.duration() || track.duration || 0);
        // Yükleme bitmeden yapılmış bir sarma varsa şimdi uygula.
        if (pendingSeekRef.current != null) {
          try { howl.seek(pendingSeekRef.current); } catch { /* noop */ }
          pendingSeekRef.current = null;
          lastSeekAtRef.current = Date.now();
        }
      },
      onplay: () => {
        if (howlRef.current !== howl) return;
        hasPlayedRef.current = true;
        setIsPlaying(true);
      },
      onend: () => {
        if (howlRef.current !== howl) return;
        if (repeat === 'one') {
          // Tekrar modu: aynı şarkıyı baştan çal, listede ilerleme.
          try {
            howl.seek(0);
            howl.play();
          } catch {
            howl.play();
          }
        } else {
          nextTrack();
        }
      },
      onloaderror: async (_id, err) => {
        if (howlRef.current !== howl) return;
        console.error('Error loading audio track:', track.title, err);
        // Eğer mevcut URL yüklenemediyse alternatif bir çözüm dene,
        // fakat kontrolsüzce bir sonraki şarkıya ATLAMA (atlama döngüsünü engeller).
        if (!hasPlayedRef.current && token === loadTokenRef.current) {
          try {
            const alt = await resolveTrack(track);
            if (alt.audioUrl && alt.audioUrl !== src && token === loadTokenRef.current) {
              const retryHowl = new Howl({
                src: [alt.audioUrl],
                html5: true,
                volume: volume,
                format: ['mp3', 'ogg', 'wav', 'm4a', 'flac', 'webm'],
                onplay: () => {
                  hasPlayedRef.current = true;
                  setIsPlaying(true);
                },
                onend: () => nextTrack(),
                onloaderror: () => {
                  setIsPlaying(false);
                },
              });
              howlRef.current = retryHowl;
              retryHowl.play();
              return;
            }
          } catch { /* fallback failed */ }
        }
        setIsPlaying(false);
      },
      onplayerror: (_id, _err) => {
        if (howlRef.current !== howl) return;
        console.error('Error playing track:', track.title);
        howl.once('unlock', () => {
          howl.play();
        });
      },
    });

    howlRef.current = howl;
    return howl;
  }, [volume, setDuration, setIsPlaying, nextTrack, repeat]);

  useEffect(() => {
    if (currentTrack) {
      loadTrack(currentTrack).then((howl) => {
        if (howl && isPlaying) {
          howl.play();
        }
      });
    }

    return () => {
      if (howlRef.current) {
        howlRef.current.unload();
      }
    };
  }, [currentTrack?.id]);

  // PREFETCH: mevcut şarkı çalarken sıradaki 3 şarkıyı arka planda çözümle
  // (1'er sn arayla). Geçişler anında olur, bekleme olmaz.
  useEffect(() => {
    if (!currentTrack) return;
    const { queue, queueIndex } = usePlayerStore.getState();
    prefetchMany(queue.slice(queueIndex + 1, queueIndex + 4), 3);
  }, [currentTrack?.id]);

  useEffect(() => {
    if (howlRef.current) {
      if (isPlaying) {
        howlRef.current.play();
      } else {
        howlRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(volume);
    }
  }, [volume]);

  useEffect(() => {
    let animationFrame: number;

    const updateProgress = () => {
      if (howlRef.current && isPlaying) {
        // Yeni sarma işlemi yapıldıysa kısa bir süre konumu ezbere yazma;
        // aksi halde eski pozisyon ilerleme çubuğunu geri çeker.
        if (Date.now() - lastSeekAtRef.current < 600) {
          animationFrame = requestAnimationFrame(updateProgress);
          return;
        }
        const seek = howlRef.current.seek();
        if (typeof seek === 'number') {
          setProgress(seek);
        }
      }
      animationFrame = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      animationFrame = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isPlaying, setProgress]);

  const seekTo = useCallback((time: number) => {
    lastSeekAtRef.current = Date.now();
    setProgress(time);
    const howl = howlRef.current;
    if (howl && howl.state() === 'loaded') {
      howl.seek(time);
    } else {
      // Ses henüz yüklenmediyse sarma işlemini yükleme sonrasına sakla.
      pendingSeekRef.current = time;
    }
  }, [setProgress]);

  // Listen for seek events from Player component
  useEffect(() => {
    const handleSeekEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      seekTo(customEvent.detail.time);
    };

    window.addEventListener('player-seek', handleSeekEvent);
    return () => window.removeEventListener('player-seek', handleSeekEvent);
  }, [seekTo]);

  // Windows taskbar hover, tarayıcı medya kontrolleri, klavye medya tuşları ve kilit ekranı için MediaSession API
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (currentTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || 'Lpotify',
          artwork: [
            { src: currentTrack.coverUrl || '/icons/icon-192.png', sizes: '96x96', type: 'image/jpeg' },
            { src: currentTrack.coverUrl || '/icons/icon-192.png', sizes: '128x128', type: 'image/jpeg' },
            { src: currentTrack.coverUrl || '/icons/icon-192.png', sizes: '256x256', type: 'image/jpeg' },
            { src: currentTrack.coverUrl || '/icons/icon-512.png', sizes: '512x512', type: 'image/jpeg' },
          ],
        });
      } catch { /* ignore */ }

      // Pencere başlığını Spotify tarzı dinamik güncelle: "Şarkı Adı • Sanatçı"
      document.title = `${currentTrack.title} • ${currentTrack.artist}`;
    } else {
      document.title = 'Lpotify';
    }

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        prevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        nextTrack();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) {
          seekTo(details.seekTime);
        }
      });
    } catch { /* ignore */ }
  }, [currentTrack, setIsPlaying, prevTrack, nextTrack, seekTo]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  return { seekTo };
}