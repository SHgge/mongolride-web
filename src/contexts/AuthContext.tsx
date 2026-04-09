import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import toast from 'react-hot-toast';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/user.types';
import type { UserRole } from '../types/database.types';

interface AuthContextType {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = session?.user ?? null;
  const role = profile?.role ?? null;

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (err) {
        console.error('Profile fetch error:', err.message);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch {
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session: s }, error: sessionErr } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionErr || !s) {
          // Session байхгүй эсвэл алдаатай → guest
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Session-ийн хүчинтэй эсэхийг шалгах (timeout 5 секунд)
        const userPromise = supabase.auth.getUser();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        );

        let currentUser;
        try {
          const { data, error: userErr } = await Promise.race([userPromise, timeoutPromise]);
          if (userErr || !data?.user) throw new Error('Invalid session');
          currentUser = data.user;
        } catch {
          // Token хүчингүй эсвэл timeout → session цэвэрлэж guest болох
          console.warn('Invalid/expired session, clearing...');
          try { await supabase.auth.signOut(); } catch { /* ignore */ }
          setSession(null);
          setProfile(null);
          // localStorage-д үлдсэн session устгах
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('sb-')) localStorage.removeItem(key);
          });
          setLoading(false);
          return;
        }

        if (!mounted) return;

        // Хүчинтэй session
        setSession(s);
        await fetchProfile(currentUser.id);
      } catch {
        setSession(null);
        setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && newSession?.user) {
          setSession(newSession);
          await fetchProfile(newSession.user.id);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          setSession(newSession);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      setError(null);
      const { error: e } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (e) { setError(e.message); return { error: e.message }; }
      return { error: null };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (e) { setError(e.message); return { error: e.message }; }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await supabase.auth.signOut();
    } catch {
      // signOut алдаа гарсан ч state цэвэрлэх
    }
    setProfile(null);
    setSession(null);
    toast.success('Системээс гарлаа');
    // localStorage-д үлдсэн session устгах
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ session, user, profile, role, loading, error, signUp, signIn, signOut, refreshProfile }),
    [session, user, profile, role, loading, error, signUp, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
