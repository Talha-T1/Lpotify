import { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';

export interface ShortcutNotification {
  message: string;
  id: number;
}

export function useKeyboardShortcuts() {
  const {
    isPlaying,
    setIsPlaying,
    nextTrack,
    prevTrack,
    volume,
    setVolume,
    currentTrack,
  } = usePlayerStore();

  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    const timer = setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 1500);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    let lastVolume = volume > 0 ? volume : 0.7;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      // Escape her zaman çalışır (input'tan çıkma, mini oynatıcıyı veya modalları kapatma)
      if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('close-modals'));
        showNotification('✕ Kapatıldı');
        return;
      }

      // Input içindeyse Space veya harf kısayollarını engelleme
      if (isInput) return;

      // F7 veya Fn+F7 (Önceki Şarkı veya Kapatma Kısayolu)
      if (e.key === 'F7' || e.code === 'F7' || e.key === 'MediaTrackPrevious') {
        e.preventDefault();
        // Açık olan mini oynatıcı veya modalları kapat/önceki şarkıya geç
        window.dispatchEvent(new CustomEvent('close-modals'));
        prevTrack();
        showNotification('⏮️ Önceki Şarkı');
        return;
      }

      // F8 veya Fn+F8 (Durdur / Başlat)
      if (e.key === 'F8' || e.code === 'F8' || e.key === 'MediaPlayPause') {
        e.preventDefault();
        const nextState = !isPlaying;
        setIsPlaying(nextState);
        showNotification(nextState ? '▶️ Oynatılıyor' : '⏸️ Duraklatıldı');
        return;
      }

      // F9 veya Fn+F9 (Sıradaki Şarkı)
      if (e.key === 'F9' || e.code === 'F9' || e.key === 'MediaTrackNext') {
        e.preventDefault();
        nextTrack();
        showNotification('⏭️ Sıradaki Şarkı');
        return;
      }

      // F10 veya M (Sessize Al / Aç)
      if (e.key === 'F10' || e.code === 'F10' || e.key === 'VolumeMute' || (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        if (volume > 0) {
          lastVolume = volume;
          setVolume(0);
          showNotification('🔇 Sessiz');
        } else {
          setVolume(lastVolume || 0.7);
          showNotification(`🔊 Ses: %${Math.round((lastVolume || 0.7) * 100)}`);
        }
        return;
      }

      // F11 (Ses Kıs - tam ekranı engellemek için e.preventDefault ile medya sesi olarak yakalanır)
      if (e.key === 'F11' || e.code === 'F11' || e.key === 'VolumeDown') {
        // Shift veya Alt ile değilse medya sesini kıs
        if (!e.altKey) {
          e.preventDefault();
          const newVol = Math.max(0, parseFloat((volume - 0.1).toFixed(2)));
          setVolume(newVol);
          showNotification(`🔉 Ses: %${Math.round(newVol * 100)}`);
          return;
        }
      }

      // F12 (Ses Aç)
      if (e.key === 'F12' || e.code === 'F12' || e.key === 'VolumeUp') {
        e.preventDefault();
        const newVol = Math.min(1, parseFloat((volume + 0.1).toFixed(2)));
        setVolume(newVol);
        showNotification(`🔊 Ses: %${Math.round(newVol * 100)}`);
        return;
      }

      // Space (Boşluk Tuşu - Oynat / Durdur)
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        const nextState = !isPlaying;
        setIsPlaying(nextState);
        showNotification(nextState ? '▶️ Oynatılıyor' : '⏸️ Duraklatıldı');
        return;
      }

      // Ctrl + Sağ Ok / Alt + Sağ Ok -> Sıradaki Şarkı
      if ((e.ctrlKey || e.altKey) && (e.key === 'ArrowRight' || e.code === 'ArrowRight')) {
        e.preventDefault();
        nextTrack();
        showNotification('⏭️ Sıradaki Şarkı');
        return;
      }

      // Ctrl + Sol Ok / Alt + Sol Ok -> Önceki Şarkı
      if ((e.ctrlKey || e.altKey) && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft')) {
        e.preventDefault();
        prevTrack();
        showNotification('⏮️ Önceki Şarkı');
        return;
      }

      // Ctrl + Yukarı Ok -> Ses Aç
      if ((e.ctrlKey || e.altKey) && (e.key === 'ArrowUp' || e.code === 'ArrowUp')) {
        e.preventDefault();
        const newVol = Math.min(1, parseFloat((volume + 0.05).toFixed(2)));
        setVolume(newVol);
        showNotification(`🔊 Ses: %${Math.round(newVol * 100)}`);
        return;
      }

      // Ctrl + Aşağı Ok -> Ses Kıs
      if ((e.ctrlKey || e.altKey) && (e.key === 'ArrowDown' || e.code === 'ArrowDown')) {
        e.preventDefault();
        const newVol = Math.max(0, parseFloat((volume - 0.05).toFixed(2)));
        setVolume(newVol);
        showNotification(`🔉 Ses: %${Math.round(newVol * 100)}`);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, setIsPlaying, nextTrack, prevTrack, volume, setVolume, currentTrack]);

  return { notification };
}
