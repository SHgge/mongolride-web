import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader } from '../common';

export default function PrivateRoute() {
  const { isAuthenticated, isLoading, profile } = useAuth();

  // Loading эсвэл profile ачаалагдаж байгаа үед хүлээх
  if (isLoading || (isAuthenticated && !profile)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
