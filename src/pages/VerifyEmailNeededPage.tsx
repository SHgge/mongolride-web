import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, Bike, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export default function VerifyEmailNeededPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      toast.error('Илгээхэд алдаа гарлаа');
    } else {
      setSent(true);
      toast.success('Имэйл дахин илгээгдлээ');
    }
    setResending(false);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">
            Mongol<span className="text-primary-600">Ride</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {sent ? <CheckCircle2 className="w-8 h-8 text-primary-600" /> : <Mail className="w-8 h-8 text-primary-600" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Имэйлээ нягтлаарай</h1>
          <p className="text-sm text-gray-500 mb-2">
            Бид дараах хаяг руу баталгаажуулах холбоос илгээсэн:
          </p>
          {email && (
            <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-4 py-2.5 mb-6">
              {email}
            </p>
          )}
          <p className="text-xs text-gray-400 mb-6">
            Имэйл ирээгүй бол spam/junk хавтсаа шалгана уу.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={resending || !email}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {sent ? 'Дахин илгээх' : 'Имэйл дахин илгээх'}
            </button>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /> Нэвтрэх хуудас руу
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
