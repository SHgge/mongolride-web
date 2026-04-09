import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';

interface RouteFilterProps {
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  search: string;
  difficulty: number | null;
  surface: string | null;
  sortBy: 'newest' | 'distance' | 'rating' | 'elevation';
}

const DIFFICULTIES = [
  { value: 1, label: 'Хялбар' },
  { value: 2, label: 'Хөнгөн' },
  { value: 3, label: 'Дунд' },
  { value: 4, label: 'Хэцүү' },
  { value: 5, label: 'Маш хэцүү' },
];

const SURFACES = [
  { value: 'asphalt', label: 'Асфальт' },
  { value: 'dirt', label: 'Шороо' },
  { value: 'gravel', label: 'Хайрга' },
  { value: 'ice', label: 'Мөс' },
  { value: 'mixed', label: 'Холимог' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Шинэ' },
  { value: 'distance', label: 'Зай' },
  { value: 'rating', label: 'Үнэлгээ' },
  { value: 'elevation', label: 'Өндөршил' },
];

export default function RouteFilter({ onFilterChange }: RouteFilterProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    difficulty: null,
    surface: null,
    sortBy: 'newest',
  });
  const [showFilters, setShowFilters] = useState(false);

  const update = (partial: Partial<FilterState>) => {
    const next = { ...filters, ...partial };
    setFilters(next);
    onFilterChange(next);
  };

  const hasActiveFilters = filters.difficulty !== null || filters.surface !== null;

  const clearFilters = () => {
    update({ difficulty: null, surface: null });
  };

  return (
    <div className="space-y-4">
      {/* Search + Toggle */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Маршрут хайх..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
            showFilters || hasActiveFilters
              ? 'border-primary-200 bg-primary-50 text-primary-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Шүүлтүүр
          {hasActiveFilters && (
            <span className="w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
              {(filters.difficulty ? 1 : 0) + (filters.surface ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Шүүлтүүр</h3>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" /> Арилгах
              </button>
            )}
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Хэцүү байдал</label>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => update({ difficulty: filters.difficulty === d.value ? null : d.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filters.difficulty === d.value
                      ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Surface */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Гадаргуу</label>
            <div className="flex flex-wrap gap-2">
              {SURFACES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update({ surface: filters.surface === s.value ? null : s.value })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filters.surface === s.value
                      ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Эрэмбэлэх</label>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => update({ sortBy: s.value as FilterState['sortBy'] })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filters.sortBy === s.value
                      ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
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
