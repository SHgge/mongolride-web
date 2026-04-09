import { useEffect, useState } from 'react';
import { Star, Send, User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase, supabasePublic } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface Rating {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user: { full_name: string; avatar_url: string | null } | null;
}

interface RouteRatingProps {
  routeId: string;
  onRatingUpdate?: () => void;
}

export default function RouteRating({ routeId, onRatingUpdate }: RouteRatingProps) {
  const { user, isAuthenticated } = useAuth();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  useEffect(() => {
    // Fetch ratings with user profiles
    supabasePublic
      .from('route_ratings')
      .select('id, rating, comment, created_at, user_id')
      .eq('route_id', routeId)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }

        // Fetch user profiles for each rating
        const userIds = [...new Set(data.map((r) => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

        const mapped: Rating[] = data.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          user: profileMap.get(r.user_id) ?? null,
        }));

        setRatings(mapped);

        // Check if current user already rated
        if (user) {
          const existing = data.find((r) => r.user_id === user.id);
          if (existing) {
            setMyRating(existing.rating);
            setComment(existing.comment ?? '');
            setHasRated(true);
          }
        }
        setLoading(false);
      });
  }, [routeId, user]);

  const handleSubmit = async () => {
    if (!user || myRating === 0) return;
    setSubmitting(true);

    const { error } = await supabase
      .from('route_ratings')
      .upsert({
        route_id: routeId,
        user_id: user.id,
        rating: myRating,
        comment: comment.trim() || null,
      }, { onConflict: 'route_id,user_id' });

    if (error) {
      toast.error('Үнэлгээ өгөхөд алдаа гарлаа');
    } else {
      toast.success(hasRated ? 'Үнэлгээ шинэчлэгдлээ' : 'Үнэлгээ амжилттай!');
      setHasRated(true);
      onRatingUpdate?.();

      // Recalculate avg rating on routes table
      const { data: allRatings } = await supabase
        .from('route_ratings')
        .select('rating')
        .eq('route_id', routeId);
      if (allRatings && allRatings.length > 0) {
        const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
        await supabase.from('routes').update({
          avg_rating: Math.round(avg * 100) / 100,
          rating_count: allRatings.length,
        }).eq('id', routeId);
      }

      // Refresh ratings list
      const { data: updated } = await supabase
        .from('route_ratings')
        .select('id, rating, comment, created_at, user_id')
        .eq('route_id', routeId)
        .order('created_at', { ascending: false });

      if (updated) {
        const userIds = [...new Set(updated.map((r) => r.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds);
        const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
        setRatings(updated.map((r) => ({
          id: r.id, rating: r.rating, comment: r.comment, created_at: r.created_at,
          user: profileMap.get(r.user_id) ?? null,
        })));
      }
    }
    setSubmitting(false);
  };

  const avgRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
    : '0.0';

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Үнэлгээ & Сэтгэгдэл</h2>
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500 fill-current" />
          <span className="text-lg font-bold text-gray-900">{avgRating}</span>
          <span className="text-sm text-gray-400">({ratings.length})</span>
        </div>
      </div>

      {/* Rating form */}
      {isAuthenticated && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">
            {hasRated ? 'Үнэлгээгээ шинэчлэх' : 'Үнэлгээ өгөх'}
          </p>
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setMyRating(star)}
                className="p-0.5"
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    star <= (hoverRating || myRating)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {myRating > 0 && <span className="text-sm text-gray-500 ml-2">{myRating}/5</span>}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Сэтгэгдэл бичих..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || myRating === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {hasRated ? 'Шинэчлэх' : 'Илгээх'}
            </button>
          </div>
        </div>
      )}

      {/* Ratings list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : ratings.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-6">Үнэлгээ байхгүй байна</p>
      ) : (
        <div className="space-y-4">
          {ratings.map((r) => (
            <div key={r.id} className="flex gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                {r.user?.avatar_url ? (
                  <img src={r.user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-900">{r.user?.full_name ?? 'Хэрэглэгч'}</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('mn-MN')}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
