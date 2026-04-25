import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, Bike } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { resetPasswordSchema, type ResetPasswordInput } from '../lib/validation';
import { genericAuthError } from '../lib/auth-errors';
import { logAudit, AuditActions } from '../lib/audit';

export default function ResetPasswordCallback() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkValid, setLinkValid] = useState(true);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    // Supabase SDK reads URL fragment and creates a recovery session
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setLinkValid(false);
      }
      setReady(true);
    });
  }, []);

  const onSubmit = async (data: ResetPasswordInput) => {
    const { data: updateData, error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      toast.error(genericAuthError(error));
      return;
    }
    await logAudit(AuditActions.PASSWORD_CHANGED, updateData.user?.id);
    setDone(true);
    toast.success('Нууц үг амжилттай шинэчлэгдлээ!');
    setTimeout(() => navigate('/', { replace: true }), 2000);
  };

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {!linkValid ? (
            <div className="text-center">
              <h1 className="text-xl font-bold text-gray-900 mb-2">Холбоос хүчингүй</h1>
              <p className="text-sm text-gray-500 mb-6">
                Нууц үг сэргээх холбоос хүчин төгөлдөр бус эсвэл хугацаа дууссан байна.
              </p>
              <Link to="/forgot-password" className="inline-block px-6 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700">
                Дахин оролдох
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Амжилттай!</h1>
              <p className="text-sm text-gray-500">Нүүр хуудас руу шилжиж байна...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Шинэ нууц үг</h1>
                <p className="text-gray-500 text-sm mt-1">Шинэ нууц үгээ оруулна уу</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Шинэ нууц үг</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      autoFocus
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-10 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.password ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'}`}
                      {...register('password')}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>}
                  <p className="text-xs text-gray-400 mt-1">8+ тэмдэгт, 1 том үсэг, 1 тоо</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Баталгаажуулах</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${errors.confirm ? 'border-red-300 focus:ring-red-500/20' : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'}`}
                      {...register('confirm')}
                    />
                  </div>
                  {errors.confirm && <p className="mt-1 text-sm text-red-500">{errors.confirm.message}</p>}
                </div>

                <button type="submit" disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  Хадгалах
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
