import type { Tables } from '../../types/database.types';
import NewsCard from './NewsCard';
import { Newspaper } from 'lucide-react';

type News = Tables<'news'>;

interface NewsListProps {
  articles: News[];
  loading: boolean;
}

export default function NewsList({ articles, loading }: NewsListProps) {
  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-80 animate-pulse" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-20">
        <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Мэдээ байхгүй</h3>
        <p className="text-gray-500 text-sm">Удахгүй шинэ мэдээ нийтлэгдэнэ</p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {articles.map((article) => (
        <NewsCard key={article.id} article={article} />
      ))}
    </div>
  );
}
