import { Link } from 'react-router-dom';
import { Clock, Eye, Newspaper } from 'lucide-react';
import type { Tables } from '../../types/database.types';

type News = Tables<'news'>;

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  general: { label: 'Мэдээ', color: 'bg-blue-100 text-blue-700' },
  tips: { label: 'Зөвлөгөө', color: 'bg-green-100 text-green-700' },
  gear_review: { label: 'Шүүмж', color: 'bg-purple-100 text-purple-700' },
  race: { label: 'Уралдаан', color: 'bg-orange-100 text-orange-700' },
  announcement: { label: 'Зарлал', color: 'bg-red-100 text-red-700' },
};

export default function NewsCard({ article }: { article: News }) {
  const cat = CATEGORY_LABELS[article.category] ?? CATEGORY_LABELS.general;
  const date = article.published_at ? new Date(article.published_at) : new Date(article.created_at);

  return (
    <Link
      to={`/news/${article.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300"
    >
      <div className="h-44 bg-gradient-to-br from-primary-50 to-primary-100 relative overflow-hidden">
        {article.cover_image ? (
          <img src={article.cover_image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Newspaper className="w-10 h-10 text-primary-300" />
          </div>
        )}
        <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-md text-xs font-medium ${cat.color}`}>
          {cat.label}
        </span>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
          {article.title}
        </h3>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{article.excerpt}</p>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {date.toLocaleDateString('mn-MN')}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {article.view_count}
          </span>
        </div>
      </div>
    </Link>
  );
}
