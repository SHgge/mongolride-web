import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ImageUpload } from '../components/common';
import { useAuth } from '../hooks/useAuth';
import type { ListingCategory, ListingCondition } from '../types/database.types';

interface ListingInput {
  title: string;
  description?: string;
  price: number;
}

const listingSchema = z.object({
  title: z.string().min(3, 'Гарчиг хамгийн багадаа 3 тэмдэгт'),
  description: z.string().optional(),
  price: z.number().positive('Үнэ эерэг тоо байх ёстой'),
}) satisfies z.ZodType<ListingInput>;

const CATEGORIES: { value: ListingCategory; label: string }[] = [
  { value: 'bike', label: 'Дугуй' },
  { value: 'parts', label: 'Сэлбэг' },
  { value: 'clothing', label: 'Хувцас' },
  { value: 'accessories', label: 'Дагалдах' },
  { value: 'other', label: 'Бусад' },
];

const CONDITIONS: { value: ListingCondition; label: string }[] = [
  { value: 'new', label: 'Шинэ' },
  { value: 'like_new', label: 'Бараг шинэ' },
  { value: 'used', label: 'Хэрэглэсэн' },
  { value: 'for_parts', label: 'Сэлбэгт' },
];

export default function AddListingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<ListingCategory>('bike');
  const [condition, setCondition] = useState<ListingCondition>('used');
  const [images, setImages] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ListingInput>({
    resolver: zodResolver(listingSchema) as never,
    defaultValues: { price: 0 },
  });

  const onSubmit = async (data: ListingInput) => {
    if (!user) return;
    setServerError(null);
    const { error } = await supabase.from('listings').insert({
      title: data.title,
      description: data.description || null,
      price: data.price,
      category,
      condition,
      seller_id: user.id,
      images,
    });
    if (error) {
      setServerError(error.message);
      toast.error('Зар нэмэхэд алдаа гарлаа');
    } else {
      navigate('/marketplace');
      toast.success('Зар амжилттай нэмэгдлээ!');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Зах зээл
      </Link>
      <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
            <Tag className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Шинэ зар</h1>
            <p className="text-sm text-gray-500">Зарах бүтээгдэхүүнийхээ мэдээллийг оруулна уу</p>
          </div>
        </div>

        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 mb-6">{serverError}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Гарчиг *</label>
            <input type="text" placeholder="Жишээ: Trek Marlin 7" className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${errors.title ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'}`} {...register('title')} />
            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Тайлбар</label>
            <textarea rows={4} placeholder="Дэлгэрэнгүй тайлбар..." className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none" {...register('description')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Үнэ (₮) *</label>
            <input type="number" placeholder="2500000" className={`w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${errors.price ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'}`} {...register('price', { valueAsNumber: true })} />
            {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ангилал</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Нөхцөл</label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button key={c.value} type="button" onClick={() => setCondition(c.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${condition === c.value ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Зурагнууд</label>
            <ImageUpload
              bucket="listings"
              folder="images"
              multiple
              onUpload={() => {}}
              onMultiUpload={(urls) => setImages(urls)}
              existingUrls={images}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Link to="/marketplace" className="flex-1 py-2.5 text-center border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50">Цуцлах</Link>
            <button type="submit" disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Хадгалж байна...</> : 'Зар нэмэх'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
