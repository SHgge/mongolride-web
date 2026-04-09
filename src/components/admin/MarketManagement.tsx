import { useEffect, useState } from 'react';
import { Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import type { Tables, ListingStatus } from '../../types/database.types';

type Listing = Tables<'listings'>;

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  sold: 'bg-gray-100 text-gray-600',
  reserved: 'bg-yellow-100 text-yellow-700',
  removed: 'bg-red-100 text-red-700',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Идэвхтэй', sold: 'Зарагдсан', reserved: 'Захиалсан', removed: 'Хасагдсан',
};
const CATEGORY_LABELS: Record<string, string> = {
  bike: 'Дугуй', parts: 'Сэлбэг', clothing: 'Хувцас', accessories: 'Дагалдах', other: 'Бусад',
};

function formatPrice(p: number) { return new Intl.NumberFormat('mn-MN').format(p) + '₮'; }

export default function MarketManagement() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('listings').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setListings(data ?? []); setLoading(false); });
  }, []);

  const updateStatus = async (id: string, status: ListingStatus) => {
    const { error } = await supabase.from('listings').update({ status }).eq('id', id);
    if (!error) {
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
      toast.success('Төлөв шинэчлэгдлээ');
    }
    setEditingStatus(null);
  };

  const deleteListing = async (id: string) => {
    if (!confirm('Энэ зарыг устгах уу?')) return;
    const { error } = await supabase.from('listings').delete().eq('id', id);
    if (!error) { setListings((prev) => prev.filter((l) => l.id !== id)); toast.success('Зар устгагдлаа'); }
    else toast.error('Устгахад алдаа гарлаа');
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Зах зээл</h1>
        <p className="text-gray-500 text-sm mt-1">{listings.length} зар</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-500">Зар</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Ангилал</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Үнэ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Төлөв</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Үзсэн</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50"><td colSpan={6} className="px-4 py-4"><div className="h-6 bg-gray-100 rounded animate-pulse" /></td></tr>
              ))
            ) : listings.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Зар байхгүй</td></tr>
            ) : (
              listings.map((listing) => (
                <tr key={listing.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 line-clamp-1">{listing.title}</div>
                    <div className="text-xs text-gray-400">{new Date(listing.created_at).toLocaleDateString('mn-MN')}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{CATEGORY_LABELS[listing.category]}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatPrice(listing.price)}</td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button onClick={() => setEditingStatus(editingStatus === listing.id ? null : listing.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer hover:opacity-80 ${STATUS_COLORS[listing.status]}`}>
                        {STATUS_LABELS[listing.status]}
                      </button>
                      {editingStatus === listing.id && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                          {(['active', 'sold', 'reserved', 'removed'] as ListingStatus[]).map((s) => (
                            <button key={s} onClick={() => updateStatus(listing.id, s)}
                              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50">
                              <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS[s]}`}>{STATUS_LABELS[s]}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400">{listing.view_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a href={`/marketplace/${listing.id}`} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><ExternalLink className="w-4 h-4" /></a>
                      <button onClick={() => deleteListing(listing.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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
