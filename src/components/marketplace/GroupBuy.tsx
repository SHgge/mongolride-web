import { useEffect, useState } from 'react';
import { Users, Clock, ExternalLink, ShoppingCart } from 'lucide-react';
import { supabasePublic as supabase } from '../../lib/supabase';
import type { Tables } from '../../types/database.types';

type GroupBuyType = Tables<'group_buys'>;

function formatPrice(price: number): string {
  return new Intl.NumberFormat('mn-MN').format(price) + '₮';
}

function daysLeft(deadline: string): number {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function GroupBuy() {
  const [items, setItems] = useState<GroupBuyType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('group_buys')
      .select('*')
      .eq('status', 'open')
      .order('deadline', { ascending: true })
      .then(({ data }) => {
        setItems(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2].map((i) => <div key={i} className="bg-gray-100 rounded-2xl h-48 animate-pulse" />)}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="w-5 h-5 text-primary-600" />
        <h2 className="text-xl font-bold text-gray-900">Хамтын захиалга</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((item) => {
          const progress = item.target_quantity > 0 ? (item.current_quantity / item.target_quantity) * 100 : 0;
          const days = daysLeft(item.deadline);
          return (
            <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                {item.product_url && (
                  <a href={item.product_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary-600">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{item.description}</p>

              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold text-primary-700">{formatPrice(item.price_per_unit)}</span>
                <span className="text-sm text-gray-400">/ширхэг</span>
              </div>

              {/* Progress */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{item.current_quantity}/{item.target_quantity} нэгдсэн</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3.5 h-3.5" /> {days} өдөр үлдсэн
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Users className="w-3.5 h-3.5" /> {item.current_quantity} хүн
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
