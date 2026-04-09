import { useState } from 'react';
import { ArrowLeft, Loader2, Newspaper } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { ImageUpload } from '../common';
import NewsEditor from '../news/NewsEditor';
import type { NewsCategory } from '../../types/database.types';

interface AdminNewsFormProps {
  onCancel: () => void;
  onSaved: () => void;
}

const CATEGORIES: { value: NewsCategory; label: string }[] = [
  { value: 'general', label: 'Мэдээ' },
  { value: 'announcement', label: 'Зарлал' },
  { value: 'tips', label: 'Зөвлөгөө' },
  { value: 'gear_review', label: 'Шүүмж' },
  { value: 'race', label: 'Уралдаан' },
];

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() + '-' + Date.now().toString(36);
}

export default function AdminNewsForm({ onCancel, onSaved }: AdminNewsFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState<NewsCategory>('general');
  const [coverImage, setCoverImage] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('Гарчиг болон агуулга оруулна уу');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('news').insert({
      title: title.trim(),
      slug: generateSlug(title),
      content,
      excerpt: excerpt.trim() || title.trim().slice(0, 150),
      category,
      cover_image: coverImage || null,
      is_published: isPublished,
      published_at: isPublished ? new Date().toISOString() : null,
      author_id: user?.id || null,
    });

    if (error) {
      toast.error('Мэдээ хадгалахад алдаа гарлаа');
    } else {
      toast.success(isPublished ? 'Мэдээ нийтлэгдлээ!' : 'Ноорог хадгалагдлаа');
      onSaved();
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-3xl">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Буцах
      </button>

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Шинэ мэдээ</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Гарчиг *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Мэдээний гарчиг"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Товч тайлбар</label>
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Мэдээний товч тайлбар (жагсаалтад харагдана)"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ангилал</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === c.value ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Нүүр зураг</label>
            <ImageUpload bucket="routes" folder="news-covers" currentUrl={coverImage || null} onUpload={setCoverImage} size="lg" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Агуулга *</label>
            <NewsEditor content={content} onChange={setContent} />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
              <span className="text-sm text-gray-700">Шууд нийтлэх</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 text-center border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">
              Цуцлах
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isPublished ? 'Нийтлэх' : 'Ноорог хадгалах'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
