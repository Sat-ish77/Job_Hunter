/**
 * Authentication Context for Job Hunter
 * ==============================================
 *
 * This module provides a React Context that manages all authentication state and
 * operations using Supabase Auth. It replaces the previous Base44 SDK auth system.
 *
 * HOW THE AUTH FLOW WORKS:
 *
 * 1. INITIAL LOAD:
 *    When the app first mounts, AuthProvider calls supabase.auth.getSession() to
 *    check if there is an existing session stored in localStorage (from a previous
 *    login). If a valid session exists, the user is immediately authenticated without
 *    needing to log in again.
 *
 * 2. AUTH STATE LISTENER:
 *    We set up supabase.auth.onAuthStateChange() which is a realtime listener that
 *    fires whenever the auth state changes. This handles:
 *    - SIGNED_IN: User just logged in (email/password or OAuth redirect)
 *    - SIGNED_OUT: User logged out or session expired
 *    - TOKEN_REFRESHED: Supabase automatically refreshed the JWT
 *    - USER_UPDATED: User profile data changed
 *    This listener ensures the React state always reflects the true auth state,
 *    even if auth events happen in other browser tabs.
 *
 * 3. SIGN IN METHODS:
 *    - signIn(email, password): Standard email + password authentication
 *    - signUp(email, password): Creates a new account (Supabase sends a confirmation email by default)
 *    - signInWithGoogle(): OAuth redirect flow - user is sent to Google's consent screen
 *      and redirected back to the app after authenticating
 *    - signOut(): Clears the session both locally and on Supabase's server
 *
 * 4. CONSUMING THE CONTEXT:
 *    Components use the useAuth() hook to access auth state and methods:
 *      const { user, session, loading, signIn, signOut } = useAuth();
 *
 * IMPORTANT: The AuthProvider must wrap the entire app (or at least all routes
 * that need auth) in the component tree, typically in App.jsx or main.jsx.
 */

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/api/base44Client';

// Create the context object. This holds the auth state and methods that will
// be available to any component that calls useAuth().
const AuthContext = createContext(undefined);

/**
 * AuthProvider Component
 *
 * Wraps the application and provides authentication state to all child components.
 * It manages the lifecycle of the user session: checking for existing sessions on
 * mount, listening for auth changes, and exposing methods for sign-in/sign-up/sign-out.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components that will have access to auth context
 */
export const AuthProvider = ({ children }) => {
  // The Supabase user object (contains id, email, user_metadata, etc.)
  // null when not authenticated.
  const [user, setUser] = useState(null);

  // The full Supabase session object (contains access_token, refresh_token, expires_at, and the user).
  // null when not authenticated. Components that need the JWT token can access session.access_token.
  const [session, setSession] = useState(null);

  // True while we are checking the initial session on mount.
  // Components should show a loading spinner while this is true to avoid
  // flashing unauthenticated content before the session check completes.
  const [loading, setLoading] = useState(true);

  /**
   * On mount, perform two tasks:
   * 1. Check for an existing session (e.g., user previously logged in and refreshed the page)
   * 2. Subscribe to auth state changes for the lifetime of the component
   */
  useEffect(() => {
    // --- Step 1: Check for existing session ---
    // getSession() reads the session from localStorage (or cookies, depending on config).
    // If the stored JWT is expired, Supabase will attempt to refresh it automatically.
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error retrieving session:', error.message);
          // Clear any stale state if session retrieval fails
          setSession(null);
          setUser(null);
        } else if (currentSession) {
          // Valid session found - user is already logged in
          setSession(currentSession);
          setUser(currentSession.user);
        }
        // If no session and no error, user is simply not logged in (session and user stay null)
      } catch (err) {
        console.error('Unexpected error during session initialization:', err);
      } finally {
        // Whether we found a session or not, initial loading is complete.
        // Components can now render their authenticated or unauthenticated UI.
        setLoading(false);
      }
    };

    initializeAuth();

    // --- Step 2: Subscribe to auth state changes ---
    // This listener fires on every auth event: login, logout, token refresh, etc.
    // It keeps our React state in sync with the actual auth state at all times.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Update React state to reflect the new auth state
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Log auth events for debugging (remove in production if too noisy)
        if (import.meta.env.DEV) {
          console.log(`[Auth] Event: ${event}`, newSession?.user?.email ?? 'no user');
        }
      }
    );

    // --- Cleanup ---
    // Unsubscribe from the auth state listener when the AuthProvider unmounts.
    // This prevents memory leaks and stale event handlers.
    return () => {
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array = runs once on mount

  /**
   * Sign in with email and password.
   *
   * Uses Supabase's signInWithPassword method which validates credentials
   * against the auth.users table. On success, Supabase stores the session
   * in localStorage and the onAuthStateChange listener updates our React state.
   *
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Object} { data, error } - data contains the session on success
   */
  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    // We don't manually update state here because onAuthStateChange handles it.
    // This ensures a single source of truth for auth state updates.
    return { data, error };
  }, []);

  /**
   * Create a new account with email and password.
   *
   * Uses Supabase's signUp method. By default, Supabase sends a confirmation
   * email to the user. The account won't be fully active until the email is confirmed
   * (depending on your Supabase project settings). The handle_new_user() database
   * trigger automatically creates a profile row in public.profiles when the user
   * is inserted into auth.users.
   *
   * @param {string} email - New user's email address
   * @param {string} password - New user's password (min 6 characters by default)
   * @returns {Object} { data, error } - data contains the user (and session if auto-confirm is enabled)
   */
  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  }, []);

  /**
   * Sign in with Google OAuth.
   *
   * This initiates an OAuth redirect flow:
   * 1. User is redirected to Google's consent screen
   * 2. After granting permission, Google redirects back to your app's redirect URL
   * 3. Supabase exchanges the authorization code for tokens
   * 4. The onAuthStateChange listener fires with the SIGNED_IN event
   *
   * Prerequisites: Google OAuth must be configured in your Supabase dashboard
   * (Authentication > Providers > Google). You need a Google Cloud OAuth client ID
   * and secret, and the redirect URL must be whitelisted in both Google Cloud Console
   * and Supabase.
   *
   * @returns {Object} { data, error } - data contains the OAuth redirect URL
   */
  const signInWithGoogle = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // After Google auth, redirect back to the app's root URL.
        // You can change this to redirect to a specific page like '/onboarding'.
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { data, error };
  }, []);

  /**
   * Sign out the current user.
   *
   * Clears the session both locally (localStorage) and on Supabase's server
   * (invalidates the refresh token). The onAuthStateChange listener will fire
   * with the SIGNED_OUT event, which sets user and session to null in our state.
   *
   * @returns {Object} { error } - error is null on success
   */
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    }
    return { error };
  }, []);

  // The value object provided to all consumers via useAuth().
  // Memoization is not strictly necessary here since AuthProvider rarely re-renders,
  // but the state values themselves are stable references when unchanged.
  const value = {
    user,         // The Supabase user object, or null
    session,      // The full session (includes access_token), or null
    loading,      // True during initial session check
    signIn,       // (email, password) => Promise<{ data, error }>
    signUp,       // (email, password) => Promise<{ data, error }>
    signInWithGoogle, // () => Promise<{ data, error }>
    signOut,      // () => Promise<{ error }>
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to access the authentication context.
 *
 * Must be called from a component that is a descendant of AuthProvider.
 * Throws an error if used outside of the provider to catch misconfiguration early.
 *
 * Usage:
 *   const { user, session, loading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
 *
 *   if (loading) return <Spinner />;
 *   if (!user) return <LoginPage />;
 *   return <Dashboard user={user} />;
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error(
      'useAuth must be used within an AuthProvider. ' +
      'Make sure your component tree is wrapped with <AuthProvider>.'
    );
  }
  return context;
};
