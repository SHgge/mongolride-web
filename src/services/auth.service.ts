import { supabase } from '../lib/supabase';

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthResult {
  error: string | null;
}

export const authService = {
  /** И-мэйл + нууц үгээр нэвтрэх */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },

  /** Шинэ хэрэглэгч бүртгүүлэх (trigger-ээр profile автоматаар үүснэ) */
  async signUp({ email, password, fullName }: SignUpParams): Promise<AuthResult> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    return { error: error?.message ?? null };
  },

  /** Системээс гарах */
  async signOut(): Promise<AuthResult> {
    const { error } = await supabase.auth.signOut();
    return { error: error?.message ?? null };
  },

  /** Google OAuth нэвтрэлт */
  async signInWithGoogle(): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    return { error: error?.message ?? null };
  },

  /** Нууц үг сэргээх и-мэйл илгээх */
  async resetPassword(email: string): Promise<AuthResult> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  },

  /** Шинэ нууц үг тохируулах (reset link-ээр орсны дараа) */
  async updatePassword(newPassword: string): Promise<AuthResult> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  },

  /** И-мэйл баталгаажуулалт дахин илгээх */
  async resendVerification(email: string): Promise<AuthResult> {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    return { error: error?.message ?? null };
  },

  /** Одоогийн session авах */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error: error?.message ?? null };
  },

  /** Auth state өөрчлөгдөхөд listener */
  onAuthStateChange(callback: Parameters<typeof supabase.auth.onAuthStateChange>[0]) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
