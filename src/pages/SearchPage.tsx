import React, { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Track } from '../types';
import { searchTracks, getTracksByGenre } from '../utils/musicApi';
import { usePlayerStore } from '../store/playerStore';
import TrackList from '../components/TrackList';
import { useT } from '../i18n';

const GENRES = ['Pop', 'Rock', 'Jazz', 'Electronic', 'Classical', 'Hip-Hop', 'Ambient', 'Lo-Fi', 'R&B', 'Country'];

const GENRE_COLORS = [
  'from-pink-600 to-purple-800',
  'from-red-600 to-orange-800',
  'from-blue-600 to-indigo-800',
  'from-cyan-600 to-teal-800',
  'from-amber-600 to-yellow-800',
  'from-green-600 to-emerald-800',
  'from-violet-600 to-purple-800',
  'from-rose-600 to-pink-800',
  'from-sky-600 to-blue-800',
  'from-lime-600 to-green-800',
];

export default function SearchPage() {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { setQueue, setCurrentTrack, setIsPlaying } = usePlayerStore();

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const tracks = await searchTracks(query);
    setResults(tracks);
    setLoading(false);
  }, [query]);

  const handleGenreClick = async (genre: string) => {
    setLoading(true);
    setSearched(true);
    setQuery(genre);
    const tracks = await getTracksByGenre(genre.toLowerCase());
    setResults(tracks);
    setLoading(false);
  };

  const playTrack = (track: Track, index: number) => {
    setQueue(results, index);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  return (
    <div className="p-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative max-w-lg">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-lpotify-gray-light" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-12 pr-10 py-3 bg-lpotify-gray rounded-full text-white placeholder-lpotify-gray-light focus:outline-none focus:ring-2 focus:ring-white text-sm"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-lpotify-gray-light hover:text-white">
              <X size={18} />
            </button>
          )}
        </div>
      </form>

      {/* Results or Browse */}
      {!searched ? (
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">{t('browseAll')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {GENRES.map((genre, i) => (
              <div key={genre}
                onClick={() => handleGenreClick(genre)}
                className={`h-[180px] rounded-lg bg-gradient-to-br ${GENRE_COLORS[i % GENRE_COLORS.length]} p-4 cursor-pointer hover:scale-105 transition-transform relative overflow-hidden`}>
                <h3 className="text-xl font-bold text-white">{genre}</h3>
                <div className="absolute bottom-[-10px] right-[-10px] w-24 h-24 rotate-25 opacity-70">
                  <img src={`https://picsum.photos/seed/${genre}/100/100`} alt=""
                    className="w-full h-full object-cover rounded shadow-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-lpotify-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : results.length > 0 ? (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">
            "{query}" {t('resultsFor')}
          </h2>
          <TrackList tracks={results} />
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-xl text-white font-bold">{t('noResults')}</p>
          <p className="text-lpotify-gray-light mt-2">{t('noResultsHint')}</p>
        </div>
      )}
    </div>
  );
}
