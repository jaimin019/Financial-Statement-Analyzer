import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import AuthGuard from './components/AuthGuard.jsx';
import ScrollRestoration from './components/ScrollRestoration.jsx';
import AppShell from './pages/AppShell.jsx';
import AuthPage from './pages/AuthPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import OAuthCallback from './pages/OAuthCallback.jsx';
import Onboarding from './pages/Onboarding.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import NotFound from './pages/NotFound.jsx';

const pageTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] };

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={pageTransition}
        style={{ width: '100%', height: '100%' }}
      >
        <Routes location={location}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={
            <AuthGuard><AuthPage /></AuthGuard>
          } />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/app/onboarding" element={
            <ProtectedRoute><Onboarding /></ProtectedRoute>
          } />
          <Route path="/app" element={
            <ProtectedRoute><AppShell /></ProtectedRoute>
          } />
          <Route path="/app/admin" element={
            <AdminRoute><AdminDashboard /></AdminRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollRestoration />
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
