import React, { useState, useEffect } from 'react';
import { Play, TrendingUp, Clock, Sparkles } from 'lucide-react';
import { Track } from '../types';
import { getFeaturedTracks, getTracksByGenre } from '../utils/musicApi';
import { usePlayerStore } from '../store/playerStore';
import TrackList from '../components/TrackList';
import { useT } from '../i18n';

export default function HomePage() {
  const t = useT();
  const [featuredTracks, setFeaturedTracks] = useState<Track[]>([]);
  const [newReleases, setNewReleases] = useState<Track[]>([]);
  const [chillTracks, setChillTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const { setQueue, setCurrentTrack, setIsPlaying } = usePlayerStore();

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      // Önbellekteki veriler hemen gösterilir, arka planda tazelenir.
      const [featured, chill] = await Promise.all([
        getFeaturedTracks(10),
        getTracksByGenre('chill', 10),
      ]);
      if (cancelled) return;
      setFeaturedTracks(featured);
      setNewReleases(featured.slice().reverse());
      setChillTracks(chill);
      setLoading(false);
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  const playTrack = (track: Track, index: number, tracks: Track[]) => {
    setQueue(tracks, index);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-lpotify-gray rounded" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-lpotify-gray rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-8">
      {/* Hero Section */}
      <div className="mb-8">
        <div className="flex items-end gap-6 mb-6">
          {/* Lpotify logosu: 180 derece çevrilmiş Spotify logosu */}
          <div className="w-[200px] h-[200px] rounded-lg shadow-2xl overflow-hidden">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="48" fill="#1DB954" />
              <path d="M73 40 Q50 53 25 44" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" />
              <path d="M70 28 Q50 39 29 32" fill="none" stroke="#000" strokeWidth="7" strokeLinecap="round" />
              <path d="M66 17 Q50 26 33 20" fill="none" stroke="#000" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white uppercase tracking-wider">{t('playlistsLabel')}</p>
            <h1 className="text-6xl font-black text-white mt-2 mb-4">{t('todayMix')}</h1>
            <p className="text-lpotify-gray-light text-sm">{t('todayMixDesc')}</p>
          </div>
        </div>
        <button
          onClick={() => featuredTracks.length > 0 && playTrack(featuredTracks[0], 0, featuredTracks)}
          className="w-14 h-14 bg-lpotify-green rounded-full flex items-center justify-center hover:scale-105 hover:bg-lpotify-green-light transition-all shadow-lg shadow-lpotify-green/30"
        >
          <Play size={24} className="text-black ml-1" fill="black" />
        </button>
      </div>

      {/* Quick Play Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-10">
        {featuredTracks.slice(0, 6).map((track) => (
          <div key={track.id}
            onClick={() => playTrack(track, featuredTracks.indexOf(track), featuredTracks)}
            className="flex items-center bg-lpotify-gray/40 rounded-md overflow-hidden hover:bg-lpotify-gray/70 cursor-pointer group transition-colors">
            <img src={track.coverUrl} alt={track.title} className="w-12 h-12 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/default/48/48'; }} />
            <span className="text-sm font-semibold text-white px-3 truncate flex-1">{track.title}</span>
            <button className="w-8 h-8 bg-lpotify-green rounded-full flex items-center justify-center mr-3 opacity-0 group-hover:opacity-100 shadow-lg transition-all">
              <Play size={14} className="text-black ml-0.5" fill="black" />
            </button>
          </div>
        ))}
      </div>

      {/* Featured Tracks */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={24} className="text-lpotify-green" />
          <h2 className="text-2xl font-bold text-white">{t('featured')}</h2>
        </div>
        <TrackList tracks={featuredTracks} />
      </section>

      {/* New Releases */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={24} className="text-lpotify-green" />
          <h2 className="text-2xl font-bold text-white">{t('newReleases')}</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {newReleases.slice(0, 5).map((track) => (
            <div key={track.id}
              onClick={() => playTrack(track, newReleases.indexOf(track), newReleases)}
              className="bg-lpotify-card hover:bg-lpotify-hover p-4 rounded-lg cursor-pointer group transition-all">
              <div className="relative mb-4">
                <img src={track.coverUrl} alt={track.title}
                  className="w-full aspect-square object-cover rounded-md shadow-lg"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/default/300/300'; }} />
                <button className="absolute bottom-2 right-2 w-12 h-12 bg-lpotify-green rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 shadow-xl transition-all">
                  <Play size={20} className="text-black ml-0.5" fill="black" />
                </button>
              </div>
              <p className="text-sm font-semibold text-white truncate">{track.title}</p>
              <p className="text-xs text-lpotify-gray-light truncate mt-1">{track.artist}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Chill Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={24} className="text-lpotify-green" />
          <h2 className="text-2xl font-bold text-white">{t('chillMode')}</h2>
        </div>
        <TrackList tracks={chillTracks} />
      </section>
    </div>
  );
}
