import { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Calendar, ShoppingBag, Newspaper, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabasePublic as supabase } from '../../lib/supabase';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'route' | 'event' | 'listing' | 'news';
  url: string;
}

const TYPE_CONFIG = {
  route: { icon: MapPin, label: 'Маршрут', color: 'text-green-600 bg-green-50' },
  event: { icon: Calendar, label: 'Арга хэмжээ', color: 'text-blue-600 bg-blue-50' },
  listing: { icon: ShoppingBag, label: 'Зар', color: 'text-orange-600 bg-orange-50' },
  news: { icon: Newspaper, label: 'Мэдээ', color: 'text-purple-600 bg-purple-50' },
};

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click outside close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }

    const timer = setTimeout(async () => {
      setLoading(true);
      const q = `%${query}%`;

      const [routesRes, eventsRes, listingsRes, newsRes] = await Promise.all([
        supabase.from('routes').select('id, title, description').eq('status', 'approved').ilike('title', q).limit(3),
        supabase.from('events').select('id, title, description').ilike('title', q).limit(3),
        supabase.from('listings').select('id, title, description').eq('status', 'active').ilike('title', q).limit(3),
        supabase.from('news').select('id, title, excerpt, slug').eq('is_published', true).ilike('title', q).limit(3),
      ]);

      const all: SearchResult[] = [
        ...(routesRes.data ?? []).map((r) => ({ id: r.id, title: r.title, subtitle: r.description?.slice(0, 60) ?? '', type: 'route' as const, url: `/routes/${r.id}` })),
        ...(eventsRes.data ?? []).map((e) => ({ id: e.id, title: e.title, subtitle: e.description?.slice(0, 60) ?? '', type: 'event' as const, url: `/events/${e.id}` })),
        ...(listingsRes.data ?? []).map((l) => ({ id: l.id, title: l.title, subtitle: l.description?.slice(0, 60) ?? '', type: 'listing' as const, url: `/marketplace/${l.id}` })),
        ...(newsRes.data ?? []).map((n) => ({ id: n.id, title: n.title, subtitle: n.excerpt?.slice(0, 60) ?? '', type: 'news' as const, url: `/news/${n.slug}` })),
      ];

      setResults(all);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (url: string) => {
    navigate(url);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={ref}>
      {/* Search trigger */}
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-500 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Хайх...</span>
        <kbd className="hidden md:inline text-[10px] bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 font-mono">Ctrl+K</kbd>
      </button>

      {/* Search modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Маршрут, арга хэмжээ, зар, мэдээ хайх..."
                className="flex-1 text-sm bg-transparent outline-none placeholder-gray-400"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                ESC
              </button>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                </div>
              ) : query.length < 2 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  2+ тэмдэгт бичнэ үү
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  "{query}" хайлтаар үр дүн олдсонгүй
                </div>
              ) : (
                <div className="py-2">
                  {results.map((result) => {
                    const config = TYPE_CONFIG[result.type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelect(result.url)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{result.title}</div>
                          {result.subtitle && <div className="text-xs text-gray-400 truncate">{result.subtitle}</div>}
                        </div>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
