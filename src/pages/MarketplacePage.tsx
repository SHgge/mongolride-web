import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { supabasePublic as supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables } from '../types/database.types';
import MarketFilter, { type MarketFilterState } from '../components/marketplace/MarketFilter';
import ListingGrid from '../components/marketplace/ListingGrid';
import GroupBuy from '../components/marketplace/GroupBuy';

type Listing = Tables<'listings'>;

export default function MarketplacePage() {
  const { isAuthenticated } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [filtered, setFiltered] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'listings' | 'groupbuy'>('listings');

  useEffect(() => {
    supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Listings fetch error:', error.message);
        const d = data ?? [];
        setListings(d);
        setFiltered(d.filter((l) => l.status === 'active'));
        setLoading(false);
      });
  }, []);

  const handleFilterChange = useCallback(
    (filters: MarketFilterState) => {
      let result = listings.filter((l) => l.status === 'active');

      if (filters.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(
          (l) => l.title.toLowerCase().includes(q) || (l.description?.toLowerCase().includes(q) ?? false),
        );
      }
      if (filters.category) {
        result = result.filter((l) => l.category === filters.category);
      }
      if (filters.condition) {
        result = result.filter((l) => l.condition === filters.condition);
      }
      switch (filters.sortBy) {
        case 'price_asc': result.sort((a, b) => a.price - b.price); break;
        case 'price_desc': result.sort((a, b) => b.price - a.price); break;
        case 'popular': result.sort((a, b) => b.view_count - a.view_count); break;
        default: break;
      }
      setFiltered(result);
    },
    [listings],
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Зах зээл</h1>
          <p className="text-gray-500 mt-1">{filtered.length} зар</p>
        </div>
        {isAuthenticated && (
          <Link to="/marketplace/new" className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
            <Plus className="w-4 h-4" /> Зар нэмэх
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('listings')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'listings' ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
          Зарууд
        </button>
        <button onClick={() => setTab('groupbuy')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'groupbuy' ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
          Хамтын захиалга
        </button>
      </div>

      {tab === 'listings' ? (
        <>
          <div className="mb-8">
            <MarketFilter onFilterChange={handleFilterChange} />
          </div>
          <ListingGrid listings={filtered} loading={loading} />
        </>
      ) : (
        <GroupBuy />
      )}
    </div>
  );
}
