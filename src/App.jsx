/**
 * src/App.jsx
 *
 * Root application component for Internship Hunter.
 *
 * AUTH & ONBOARDING FLOW:
 * 1. App renders → useAuth() checks for existing session
 * 2. While loading → shows spinner
 * 3. If no user → redirects to /login
 * 4. If user exists but !onboarding_completed → redirects to /onboarding
 * 5. If user on /onboarding but completed → force redirect to /dashboard
 * 6. If user exists → renders the requested page
 *
 * COMPONENT HIERARCHY:
 *   App (providers already in main.jsx)
 *     ├── NavigationTracker (scroll-to-top on route change)
 *     ├── Toaster (sonner toast notifications)
 *     └── Routes
 *         ├── / → Dashboard (with Layout)
 *         ├── /jobs → Jobs (with Layout)
 *         ├── /jobs/:id → JobDetail (with Layout)
 *         ├── /onboarding → Onboarding (NO Layout - full-screen wizard)
 *         ├── /pipeline → Pipeline (with Layout)
 *         ├── /settings → Settings (with Layout)
 *         ├── /login → LoginPage (NO Layout)
 *         └── * → PageNotFound
 */

import { Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/base44Client';
import { pagesConfig } from './pages.config';
import NavigationTracker from '@/lib/NavigationTracker';
import PageNotFound from '@/lib/PageNotFound';
import Layout from '@/Layout';
import LoginPage from '@/pages/Login';
import ChatWidget from '@/components/ChatWidget';

/**
 * Loading spinner shown while:
 * - Checking initial auth session
 * - Lazy-loading a page component
 */
const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
    <div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
  </div>
);

/**
 * ProtectedRoute wraps pages that require authentication.
 * If the user is not logged in, they are redirected to /login.
 * If the user hasn't completed onboarding, redirect to /onboarding.
 */
const ProtectedRoute = ({ children, requiresOnboarding = true }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [onboardingCompleted, setOnboardingCompleted] = useState(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Check onboarding status from profiles table
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setCheckingOnboarding(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          setOnboardingCompleted(false);
        } else {
          setOnboardingCompleted(profile?.onboarding_completed || false);
        }
      } catch (err) {
        console.error('Error checking onboarding:', err);
        setOnboardingCompleted(false);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  // Show loading spinner while checking auth or onboarding
  if (loading || checkingOnboarding) {
    return <LoadingSpinner />;
  }

  // Not authenticated → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // On onboarding page but already completed → force to dashboard
  if (location.pathname === '/onboarding' && onboardingCompleted === true) {
    return <Navigate to="/dashboard" replace />;
  }

  // Not on onboarding page, but onboarding not completed → redirect to onboarding
  if (
    requiresOnboarding &&
    location.pathname !== '/onboarding' &&
    onboardingCompleted === false
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

function App() {
  const { user, loading } = useAuth();
  
  return (
    <>
      {/* Tracks route changes for scroll-to-top and optional analytics */}
      <NavigationTracker />

      {/* Suspense boundary for lazy-loaded page components */}
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public route: Login page (no layout, no auth required) */}
          <Route path="/login" element={<LoginPage />} />

          {/* Root redirect: wait for auth loading to finish before routing */}
          <Route 
            path="/" 
            element={
              loading ? <LoadingSpinner /> :
              user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
            } 
          />

          {/* Explicit dashboard route */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Suspense fallback={<LoadingSpinner />}>
                    {pagesConfig.find(p => p.path === '/')?.component && 
                      (() => {
                        const DashboardComponent = pagesConfig.find(p => p.path === '/')?.component;
                        return <DashboardComponent />;
                      })()
                    }
                  </Suspense>
                </Layout>
              </ProtectedRoute>
            }
          />

          {/* Protected routes: All app pages require authentication */}
          {pagesConfig.filter(p => p.path !== '/').map(({ path, component: Component }) => {
            // Onboarding gets no layout (it's a full-screen wizard)
            // Also doesn't require onboarding to be complete (obviously)
            if (path === '/onboarding') {
              return (
                <Route
                  key={path}
                  path={path}
                  element={
                    <ProtectedRoute requiresOnboarding={false}>
                      <Component />
                    </ProtectedRoute>
                  }
                />
              );
            }

            // All other pages get the standard Layout (sidebar + header)
            return (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Component />
                    </Layout>
                  </ProtectedRoute>
                }
              />
            );
          })}

          {/* 404 fallback for any unmatched routes */}
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>

      {/* AI Career Coach - floats on all protected pages */}
      {user && <ChatWidget />}

      {/* Sonner toast notifications - appears in the bottom-right corner */}
      <Toaster position="bottom-right" richColors />
    </>
  );
}

export default App;
