import { useEffect, useState } from 'react';
import { supabasePublic as supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';
import NewsList from '../components/news/NewsList';

type News = Tables<'news'>;
type CategoryFilter = 'all' | 'general' | 'tips' | 'gear_review' | 'race' | 'announcement';

const TABS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'Бүгд' },
  { value: 'announcement', label: 'Зарлал' },
  { value: 'general', label: 'Мэдээ' },
  { value: 'tips', label: 'Зөвлөгөө' },
  { value: 'gear_review', label: 'Шүүмж' },
  { value: 'race', label: 'Уралдаан' },
];

export default function NewsPage() {
  const [articles, setArticles] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>('all');

  useEffect(() => {
    setLoading(true);
    const query = supabase
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (category !== 'all') query.eq('category', category);

    query.then(({ data }) => {
      setArticles(data ?? []);
      setLoading(false);
    });
  }, [category]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Мэдээ & Нийтлэл</h1>
        <p className="text-gray-500 mt-1">Дугуйн ертөнцийн сүүлийн үеийн мэдээлэл</p>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button key={tab.value}
            onClick={() => setCategory(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${category === tab.value ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <NewsList articles={articles} loading={loading} />
    </div>
  );
}
