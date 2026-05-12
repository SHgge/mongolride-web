import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MainLayout } from './components/layout';
import { AdminLayout } from './components/layout';
import PrivateRoute from './components/auth/PrivateRoute';
import AdminRoute from './components/auth/AdminRoute';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordCallback from './pages/ResetPasswordCallback';
import VerifyEmailNeededPage from './pages/VerifyEmailNeededPage';
import RoutesPage from './pages/RoutesPage';
import RouteDetailPage from './pages/RouteDetailPage';
import AddRoutePage from './pages/AddRoutePage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import MarketplacePage from './pages/MarketplacePage';
import ListingDetailPage from './pages/ListingDetailPage';
import AddListingPage from './pages/AddListingPage';
import ProfilePage from './pages/ProfilePage';
import WeatherPreferencesPage from './pages/profile/WeatherPreferencesPage';
import TicketPage from './pages/TicketPage';
import CheckInTokenPage from './pages/CheckInTokenPage';
import ScannerPage from './pages/ScannerPage';
import RosterPage from './pages/RosterPage';
import NotificationsFeedPage from './pages/NotificationsFeedPage';
import NotificationPreferencesPage from './pages/profile/NotificationPreferencesPage';
import UnsubscribePage from './pages/UnsubscribePage';
import TemplatesListPage from './pages/admin/notifications/TemplatesListPage';
import TemplateEditorPage from './pages/admin/notifications/TemplateEditorPage';
import AdminAnalyticsDashboardPage from './pages/AdminAnalyticsDashboardPage';
import OrganizerDashboardPage from './pages/OrganizerDashboardPage';
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

// EP-07: TanStack Query for analytics dashboard caching.
// 60s staleTime is the right fit for materialized-view-backed reads (15-min refresh).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password/callback" element={<ResetPasswordCallback />} />
                <Route path="/verify-email-needed" element={<VerifyEmailNeededPage />} />
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
                  <Route path="/profile/weather" element={<WeatherPreferencesPage />} />
                  <Route path="/profile/notifications" element={<NotificationPreferencesPage />} />
                  <Route path="/notifications" element={<NotificationsFeedPage />} />
                  <Route path="/unsubscribe" element={<UnsubscribePage />} />
                  <Route path="/events/:id/ticket" element={<TicketPage />} />
                  <Route path="/check-in/:token" element={<CheckInTokenPage />} />
                  {/* EP-09 scanner/roster: auth required; page itself authorises
                      admin / organizer / co-organizer / sweep_rider */}
                  <Route path="/admin/events/:eventId/scanner" element={<ScannerPage />} />
                  <Route path="/admin/events/:eventId/roster" element={<RosterPage />} />
                  <Route path="/organizer/dashboard" element={<OrganizerDashboardPage />} />
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
                  <Route path="/admin/notifications/templates" element={<TemplatesListPage />} />
                  <Route path="/admin/notifications/templates/:id" element={<TemplateEditorPage />} />
                  <Route path="/admin/dashboard" element={<AdminAnalyticsDashboardPage />} />
                </Route>
              </Route>
            </Routes>

            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: { borderRadius: '12px', padding: '12px 16px', fontSize: '14px' },
                success: { iconTheme: { primary: '#43a047', secondary: '#fff' } },
                error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </NotificationProvider>
        </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
