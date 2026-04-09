import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Tag, Eye, Clock, User, MessageCircle, Phone } from 'lucide-react';
import { supabasePublic as supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { Tables } from '../types/database.types';
import { Loader } from '../components/common';

type Listing = Tables<'listings'>;
type Profile = Tables<'profiles'>;

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

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setListing(data);
        if (data?.seller_id) {
          supabase.from('profiles').select('*').eq('id', data.seller_id).single().then(({ data: p }) => setSeller(p));
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  if (!listing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Зар олдсонгүй</h2>
        <Link to="/marketplace" className="text-primary-600 font-medium">Зах зээл руу буцах</Link>
      </div>
    );
  }

  const cond = CONDITION_LABELS[listing.condition] ?? CONDITION_LABELS.used;
  const isOwner = user?.id === listing.seller_id;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Зах зээл
      </Link>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Left: Image */}
        <div className="md:col-span-3">
          <div className="bg-gray-50 rounded-2xl h-80 flex items-center justify-center overflow-hidden">
            {listing.images?.[0] ? (
              <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <Tag className="w-16 h-16 text-gray-300" />
            )}
          </div>
          {/* Description */}
          <div className="bg-white border border-gray-100 rounded-xl p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Тайлбар</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">{listing.description || 'Тайлбар байхгүй.'}</p>
          </div>
        </div>

        {/* Right: Info */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-gray-100 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium ${cond.color}`}>{cond.label}</span>
              <span className="text-xs text-gray-400">{CATEGORY_LABELS[listing.category]}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">{listing.title}</h1>
            <div className="text-3xl font-bold text-primary-700 mb-4">{formatPrice(listing.price)}</div>
            <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
              <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {listing.view_count} үзсэн</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(listing.created_at).toLocaleDateString('mn-MN')}</span>
            </div>

            {listing.status === 'sold' && (
              <div className="bg-red-50 text-red-600 text-sm font-medium rounded-lg px-4 py-2.5 text-center mb-4">Зарагдсан</div>
            )}

            {!isOwner && listing.status === 'active' && (
              <button className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors">
                <MessageCircle className="w-5 h-5" /> Холбоо барих
              </button>
            )}
          </div>

          {/* Seller info */}
          {seller && (
            <div className="bg-white border border-gray-100 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Зарагч</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  {seller.avatar_url ? (
                    <img src={seller.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-primary-600" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{seller.full_name}</div>
                  {seller.phone && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Phone className="w-3 h-3" /> {seller.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
