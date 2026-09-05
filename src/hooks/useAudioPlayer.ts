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
    repeat,
  } = usePlayerStore();

  const loadTrack = useCallback(async (track: Track) => {
    const token = ++loadTokenRef.current;
    hasPlayedRef.current = false;
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    // Prefer a locally cached copy (real offline playback) over the network URL.
    let src = track.audioUrl;
    let playTrack = track;
    try {
      if (track.filePath) {
        // "download mp" klasörüne indirilmiş gerçek dosya: internete hiç gerek yok.
        // Dahili yerel sunucu üzerinden çal — hem güvenilir hem Range destekli.
        src = await getLocalAudioUrl(track.filePath);
      } else if (isElectron()) {
        // Electron'da eski oturumdan kalma akış URL'leri (proxy token'lı) ölmüş
        // olur → her zaman taze çözümleme yap, bayat URL'ye güvenme.
        const cachedUrl = await getCachedTrackBlobUrl(track.id);
        if (cachedUrl) {
          src = cachedUrl;
        } else {
          // In Electron: yt-dlp resolves the full ad-free audio stream.
          // Süre kontrolüyle 30 sn önizlemeleri reddediyoruz; ilk tur bulunamazsa
          // alternatif sorgularla ikinci tur denenir (hız için yarışmalı).
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
        }
      }
    } catch {
      // stay online
    }

    // Çözümleme sürerken kullanıcı başka şarkıya geçtiyse bu yüklemeyi tamamen bırak.
    if (token !== loadTokenRef.current) return null;

    const howl: Howl = new Howl({
      src: [src],
      html5: true,
      volume: volume,
      format: ['mp3', 'ogg', 'wav', 'm4a', 'flac'],
      onload: () => {
        if (howlRef.current !== howl) return;
        setDuration(howl.duration());
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
      onloaderror: (_id, _err) => {
        if (howlRef.current !== howl) return;
        console.error('Error loading track:', track.title);
        // Sonsuz ilerlemeyi önle: hiç çalmamışsa listeyi ilerletme.
        if (hasPlayedRef.current) {
          hasPlayedRef.current = false;
          nextTrack();
        } else {
          setIsPlaying(false);
        }
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

  return { seekTo };
}