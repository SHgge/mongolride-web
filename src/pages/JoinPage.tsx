import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bike, UserPlus, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Loader } from '../components/common';

export default function JoinPage() {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();
  const [motivation, setMotivation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingStatus, setExistingStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [checking, setChecking] = useState(true);

  // Redirect non-Guests
  useEffect(() => {
    if (!isLoading && role && role !== 'guest') {
      navigate('/profile', { replace: true });
    }
  }, [isLoading, role, navigate]);

  // Check if user has existing request
  useEffect(() => {
    if (!user) { setChecking(false); return; }
    supabase
      .from('membership_requests')
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setExistingStatus(data.status);
        setChecking(false);
      });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (motivation.length > 500) { toast.error('Шалтгаан 500 тэмдэгтээс хэтрэх ёсгүй'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('membership_requests').insert({
      user_id: user.id,
      motivation: motivation.trim() || null,
    });

    if (error) {
      // Unique violation = pending duplicate
      if (error.code === '23505') {
        toast.error('Та аль хэдийн хүлээгдэж буй хүсэлттэй байна');
      } else if (error.code === 'P0003' || /дахин хүсэлт/i.test(error.message)) {
        // Cooldown
        toast.error(error.message);
      } else {
        toast.error('Хүсэлт явуулахад алдаа гарлаа');
        console.error('[join]', error);
      }
      setSubmitting(false);
      return;
    }

    toast.success('Хүсэлт амжилттай явуулагдлаа!');
    setExistingStatus('pending');
    setSubmitting(false);
  };

  if (isLoading || checking) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader size="lg" /></div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 mb-4">Хүсэлт явуулахын тулд нэвтэрнэ үү</p>
        <Link to="/login" className="inline-flex px-6 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
          Нэвтрэх
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Нүүр хуудас
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
            <Bike className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Клубт нэгдэх</h1>
            <p className="text-sm text-gray-500">MongolRide клубын гишүүн болох хүсэлт</p>
          </div>
        </div>

        {existingStatus === 'pending' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-800">Хүсэлт хүлээгдэж байна</h3>
              <p className="text-sm text-yellow-700 mt-1">Таны өмнөх хүсэлтийг админ батлахыг хүлээж байна.</p>
            </div>
          </div>
        )}

        {existingStatus === 'approved' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-green-800">Та клубын гишүүн боллоо</h3>
              <p className="text-sm text-green-700 mt-1">Тавтай морилно уу!</p>
            </div>
          </div>
        )}

        {existingStatus !== 'pending' && existingStatus !== 'approved' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Яагаад нэгдэхийг хүсэж байна вэ? <span className="text-xs text-gray-400">(заавал биш, {motivation.length}/500)</span>
              </label>
              <textarea
                rows={4}
                value={motivation}
                maxLength={500}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Дугуйн туршлага, сонирхол, зорилго..."
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600 leading-relaxed">
              <p className="font-medium mb-1">⚡ Хүсэлт явуулсны дараа:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Админ таны хүсэлтийг шалгана</li>
                <li>Зөвшөөрөгдвөл клубын бүх боломжуудыг ашиглах эрхтэй болно</li>
                <li>Хариу гарсан үед имэйл болон апп дотор мэдэгдэл хүлээн авна</li>
              </ul>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
              Хүсэлт явуулах
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
