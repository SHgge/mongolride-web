import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { MainLayout } from './components/layout';
import { AdminLayout } from './components/layout';
import PrivateRoute from './components/auth/PrivateRoute';
import AdminRoute from './components/auth/AdminRoute';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RoutesPage from './pages/RoutesPage';
import RouteDetailPage from './pages/RouteDetailPage';
import AddRoutePage from './pages/AddRoutePage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import MarketplacePage from './pages/MarketplacePage';
import ListingDetailPage from './pages/ListingDetailPage';
import AddListingPage from './pages/AddListingPage';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import NewsPage from './pages/NewsPage';
import NewsDetailPage from './pages/NewsDetailPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminMembersPage from './pages/AdminMembersPage';
import AdminRoutesPage from './pages/AdminRoutesPage';
import AdminEventsPage from './pages/AdminEventsPage';
import AdminMarketPage from './pages/AdminMarketPage';
import AdminNewsPage from './pages/AdminNewsPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/routes/:id" element={<RouteDetailPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/marketplace/:id" element={<ListingDetailPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/news/:slug" element={<NewsDetailPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              <Route element={<PrivateRoute />}>
                <Route path="/routes/new" element={<AddRoutePage />} />
                <Route path="/marketplace/new" element={<AddListingPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/members" element={<AdminMembersPage />} />
                <Route path="/admin/routes" element={<AdminRoutesPage />} />
                <Route path="/admin/events" element={<AdminEventsPage />} />
                <Route path="/admin/marketplace" element={<AdminMarketPage />} />
                <Route path="/admin/news" element={<AdminNewsPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
