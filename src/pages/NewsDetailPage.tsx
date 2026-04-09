import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Eye, User, Newspaper } from 'lucide-react';
import { supabasePublic as supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';
import { Loader } from '../components/common';

type News = Tables<'news'>;
type Profile = Tables<'profiles'>;

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  general: { label: 'Мэдээ', color: 'bg-blue-100 text-blue-700' },
  tips: { label: 'Зөвлөгөө', color: 'bg-green-100 text-green-700' },
  gear_review: { label: 'Шүүмж', color: 'bg-purple-100 text-purple-700' },
  race: { label: 'Уралдаан', color: 'bg-orange-100 text-orange-700' },
  announcement: { label: 'Зарлал', color: 'bg-red-100 text-red-700' },
};

export default function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<News | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('news')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()
      .then(({ data }) => {
        setArticle(data);
        if (data?.author_id) {
          supabase.from('profiles').select('*').eq('id', data.author_id).single().then(({ data: a }) => setAuthor(a));
        }
        setLoading(false);
      });
  }, [slug]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Нийтлэл олдсонгүй</h2>
        <Link to="/news" className="text-primary-600 font-medium">Бүх мэдээ</Link>
      </div>
    );
  }

  const cat = CATEGORY_LABELS[article.category] ?? CATEGORY_LABELS.general;
  const date = article.published_at ? new Date(article.published_at) : new Date(article.created_at);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/news" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Бүх мэдээ
      </Link>

      {/* Header */}
      <div className="mb-8">
        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium mb-3 ${cat.color}`}>{cat.label}</span>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4">{article.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {date.toLocaleDateString('mn-MN', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {article.view_count} үзсэн</span>
        </div>
      </div>

      {/* Cover image */}
      {article.cover_image && (
        <div className="rounded-2xl overflow-hidden mb-8">
          <img src={article.cover_image} alt={article.title} className="w-full h-64 md:h-80 object-cover" />
        </div>
      )}

      {/* Content */}
      <div className="prose prose-gray max-w-none mb-8">
        {article.content.split('\n').map((paragraph, i) => {
          if (!paragraph.trim()) return <br key={i} />;
          if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
            return <h3 key={i} className="text-lg font-semibold text-gray-900 mt-6 mb-2">{paragraph.replace(/\*\*/g, '')}</h3>;
          }
          if (paragraph.startsWith('- ')) {
            return <li key={i} className="text-gray-600 ml-4">{paragraph.slice(2)}</li>;
          }
          return <p key={i} className="text-gray-600 leading-relaxed mb-3">{paragraph}</p>;
        })}
      </div>

      {/* Author */}
      {author && (
        <div className="border-t border-gray-100 pt-6 mt-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
              {author.avatar_url ? (
                <img src={author.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-primary-600" />
              )}
            </div>
            <div>
              <div className="font-medium text-gray-900">{author.full_name}</div>
              <div className="text-xs text-gray-400">Зохиогч</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
