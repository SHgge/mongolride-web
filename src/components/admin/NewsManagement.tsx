import { useEffect, useState } from 'react';
import { Eye, EyeOff, Trash2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Tables } from '../../types/database.types';

type News = Tables<'news'>;

const CATEGORY_LABELS: Record<string, string> = {
  general: 'Мэдээ', tips: 'Зөвлөгөө', gear_review: 'Шүүмж', race: 'Уралдаан', announcement: 'Зарлал',
};

export default function NewsManagement() {
  const [articles, setArticles] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('news').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setArticles(data ?? []); setLoading(false); });
  }, []);

  const togglePublish = async (id: string, isPublished: boolean) => {
    const updates = isPublished
      ? { is_published: false }
      : { is_published: true, published_at: new Date().toISOString() };
    const { error } = await supabase.from('news').update(updates).eq('id', id);
    if (!error) {
      setArticles((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a));
    }
  };

  const deleteArticle = async (id: string) => {
    const { error } = await supabase.from('news').delete().eq('id', id);
    if (!error) setArticles((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мэдээ & Нийтлэл</h1>
          <p className="text-gray-500 text-sm mt-1">{articles.length} нийтлэл</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Гарчиг</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ангилал</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Төлөв</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Үзсэн</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td colSpan={5} className="px-4 py-4"><div className="h-6 bg-gray-100 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : articles.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Нийтлэл байхгүй</td></tr>
            ) : (
              articles.map((article) => (
                <tr key={article.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 line-clamp-1">{article.title}</div>
                    <div className="text-xs text-gray-400">{new Date(article.created_at).toLocaleDateString('mn-MN')}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{CATEGORY_LABELS[article.category]}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${article.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {article.is_published ? 'Нийтлэгдсэн' : 'Ноорог'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{article.view_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => togglePublish(article.id, article.is_published)}
                        className={`p-1.5 rounded-lg transition-colors ${article.is_published ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                        title={article.is_published ? 'Нуух' : 'Нийтлэх'}>
                        {article.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <a href={`/news/${article.slug}`} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg" title="Харах">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button onClick={() => deleteArticle(article.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Устгах">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
