import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader } from '../common';

export default function AdminRoute() {
  const { isAuthenticated, isAdmin, isLoading, profile } = useAuth();

  // Loading эсвэл profile ачаалагдаж байгаа үед хүлээх
  if (isLoading || (isAuthenticated && !profile)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
