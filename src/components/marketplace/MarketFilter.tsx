import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';

export interface MarketFilterState {
  search: string;
  category: string | null;
  condition: string | null;
  sortBy: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

interface MarketFilterProps {
  onFilterChange: (filters: MarketFilterState) => void;
}

const CATEGORIES = [
  { value: 'bike', label: 'Дугуй' },
  { value: 'parts', label: 'Сэлбэг' },
  { value: 'clothing', label: 'Хувцас' },
  { value: 'accessories', label: 'Дагалдах' },
  { value: 'other', label: 'Бусад' },
];

const CONDITIONS = [
  { value: 'new', label: 'Шинэ' },
  { value: 'like_new', label: 'Бараг шинэ' },
  { value: 'used', label: 'Хэрэглэсэн' },
  { value: 'for_parts', label: 'Сэлбэгт' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Шинэ' },
  { value: 'price_asc', label: 'Үнэ ↑' },
  { value: 'price_desc', label: 'Үнэ ↓' },
  { value: 'popular', label: 'Их үзсэн' },
];

export default function MarketFilter({ onFilterChange }: MarketFilterProps) {
  const [filters, setFilters] = useState<MarketFilterState>({
    search: '', category: null, condition: null, sortBy: 'newest',
  });
  const [showFilters, setShowFilters] = useState(false);

  const update = (partial: Partial<MarketFilterState>) => {
    const next = { ...filters, ...partial };
    setFilters(next);
    onFilterChange(next);
  };

  const hasActive = filters.category !== null || filters.condition !== null;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Зар хайх..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
            showFilters || hasActive ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" /> Шүүлтүүр
          {hasActive && (
            <span className="w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
              {(filters.category ? 1 : 0) + (filters.condition ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Шүүлтүүр</h3>
            {hasActive && (
              <button onClick={() => update({ category: null, condition: null })} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" /> Арилгах
              </button>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Ангилал</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.value} onClick={() => update({ category: filters.category === c.value ? null : c.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filters.category === c.value ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Нөхцөл</label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button key={c.value} onClick={() => update({ condition: filters.condition === c.value ? null : c.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filters.condition === c.value ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Эрэмбэлэх</label>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((s) => (
                <button key={s.value} onClick={() => update({ sortBy: s.value as MarketFilterState['sortBy'] })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filters.sortBy === s.value ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
