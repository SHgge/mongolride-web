import { Link } from 'react-router-dom';
import { Eye, Tag } from 'lucide-react';
import type { Tables } from '../../types/database.types';

type Listing = Tables<'listings'>;

const CATEGORY_LABELS: Record<string, string> = {
  bike: 'Дугуй', parts: 'Сэлбэг', clothing: 'Хувцас', accessories: 'Дагалдах', other: 'Бусад',
};

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'Шинэ', color: 'bg-green-100 text-green-700' },
  like_new: { label: 'Бараг шинэ', color: 'bg-blue-100 text-blue-700' },
  used: { label: 'Хэрэглэсэн', color: 'bg-yellow-100 text-yellow-700' },
  for_parts: { label: 'Сэлбэгт', color: 'bg-gray-100 text-gray-600' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮';
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const cond = CONDITION_LABELS[listing.condition] ?? CONDITION_LABELS.used;
  const isSold = listing.status === 'sold';

  return (
    <Link
      to={`/marketplace/${listing.id}`}
      className={`group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-300 ${isSold ? 'opacity-60' : ''}`}
    >
      {/* Image */}
      <div className="h-48 bg-gray-50 relative overflow-hidden">
        {listing.images?.[0] ? (
          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Tag className="w-10 h-10 text-gray-300" />
          </div>
        )}
        <span className={`absolute top-3 left-3 px-2 py-0.5 rounded-md text-xs font-medium ${cond.color}`}>
          {cond.label}
        </span>
        {isSold && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold -rotate-12">ЗАРАГДСАН</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">
            {listing.title}
          </h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">{CATEGORY_LABELS[listing.category] ?? listing.category}</p>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary-700">{formatPrice(listing.price)}</span>
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Eye className="w-3.5 h-3.5" /> {listing.view_count}
          </span>
        </div>
      </div>
    </Link>
  );
}
