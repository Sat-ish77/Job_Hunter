/**
 * src/main.jsx
 *
 * Application entry point for Job Hunter.
 *
 * This file mounts the React app into the DOM and wraps it with
 * the necessary provider hierarchy:
 *
 * 1. BrowserRouter (react-router-dom) - Enables client-side routing
 *    so the app can navigate between pages (Dashboard, Jobs, Pipeline, etc.)
 *    without full page reloads.
 *
 * 2. QueryClientProvider (@tanstack/react-query) - Provides the React Query
 *    client for server state management. Handles caching, background refetching,
 *    and synchronization of data from the Supabase backend.
 *
 * 3. AuthProvider (local AuthContext) - Manages user authentication state
 *    (login, logout, current user) so any component in the tree can check
 *    auth status and access user info.
 *
 * The providers are ordered so that:
 * - Router is outermost because auth may need to redirect on login/logout
 * - QueryClient is next so auth checks can use React Query
 * - Auth is innermost so the App and all routes have access to auth state
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "@/App.jsx";
import { queryClientInstance } from "@/lib/query-client";
import { AuthProvider } from "@/lib/AuthContext";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClientInstance}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
