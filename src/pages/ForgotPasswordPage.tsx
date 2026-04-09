import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bike, Mail, ArrowLeft, Loader2, CheckCircle2, Send } from 'lucide-react';
import { authService } from '../services/auth.service';

const forgotSchema = z.object({
  email: z.string().email('И-мэйл хаяг буруу байна'),
});

type ForgotInput = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotInput>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotInput) => {
    setServerError(null);
    const { error } = await authService.resetPassword(data.email);
    if (error) {
      setServerError(error);
    } else {
      setSentEmail(data.email);
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">
            Mongol<span className="text-primary-600">Ride</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {success ? (
            /* Success state */
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-primary-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">И-мэйл илгээлээ!</h1>
              <p className="text-gray-500 text-sm mb-2">
                Нууц үг сэргээх линкийг дараах хаяг руу илгээлээ:
              </p>
              <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-lg px-4 py-2.5 mb-6">
                {sentEmail}
              </p>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                И-мэйл ирээгүй бол spam/junk хавтсаа шалгана уу. Линк 24 цагийн дотор хүчинтэй.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => { setSuccess(false); setServerError(null); }}
                  className="w-full py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Дахин илгээх
                </button>
                <Link
                  to="/login"
                  className="block w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors text-center"
                >
                  Нэвтрэх хуудас руу
                </Link>
              </div>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-6 h-6 text-primary-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Нууц үг сэргээх</h1>
                <p className="text-gray-500 text-sm">
                  Бүртгэлтэй и-мэйл хаягаа оруулна уу. Нууц үг сэргээх линк илгээх болно.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {serverError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {serverError}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    И-мэйл хаяг
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="name@example.com"
                      className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
                        errors.email
                          ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                          : 'border-gray-200 focus:ring-primary-500/20 focus:border-primary-500'
                      }`}
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Илгээж байна...
                    </>
                  ) : (
                    'Сэргээх линк илгээх'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Нэвтрэх хуудас руу буцах
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
