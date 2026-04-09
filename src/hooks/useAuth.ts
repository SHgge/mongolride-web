import { useAuthContext } from '../contexts/AuthContext';

export function useAuth() {
  const { user, profile, role, loading, error, signUp, signIn, signOut, refreshProfile } =
    useAuthContext();

  return {
    user,
    profile,
    role,
    isLoading: loading,
    isAuthenticated: !!user,
    isAdmin: role === 'admin',
    error,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };
}
