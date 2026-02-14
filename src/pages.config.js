/**
 * Page Route Configuration
 * =========================
 *
 * Central configuration for all pages/routes in the application. Each entry defines
 * a route path, its display label, an icon name from lucide-react, whether the route
 * requires authentication, and a lazy-loaded component.
 *
 * LAZY LOADING: Components are imported using React.lazy() so that each page's code
 * is split into a separate bundle chunk. This means users only download the JavaScript
 * for pages they actually visit, improving initial load time.
 *
 * USAGE: The router (in App.jsx or wherever routes are defined) iterates over this
 * array to generate <Route> elements. The sidebar/navigation also uses this config
 * to build nav links, filtering by requiresAuth and using the label + icon fields.
 *
 * ADDING A NEW PAGE:
 * 1. Create the page component in src/pages/YourPage.jsx
 * 2. Add an entry to the pagesConfig array below
 * 3. The route and nav link are automatically generated
 */

import { lazy } from 'react';

/**
 * @typedef {Object} PageConfig
 * @property {string} path - The URL path for react-router (supports dynamic segments like :id)
 * @property {string} label - Display name shown in the sidebar navigation
 * @property {string} icon - Name of the lucide-react icon component (e.g., 'LayoutDashboard')
 * @property {boolean} requiresAuth - If true, unauthenticated users are redirected to login
 * @property {React.LazyExoticComponent} component - Lazy-loaded page component
 * @property {boolean} [showInNav] - Whether to show this page in the sidebar navigation (defaults to true)
 */

/** @type {PageConfig[]} */
export const pagesConfig = [
  {
    path: '/',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    requiresAuth: true,
    component: lazy(() => import('./pages/Dashboard')),
    showInNav: true,
  },
  {
    path: '/jobs',
    label: 'Jobs',
    icon: 'Briefcase',
    requiresAuth: true,
    component: lazy(() => import('./pages/Jobs')),
    showInNav: true,
  },
  {
    path: '/jobs/:id',
    label: 'Job Detail',
    icon: 'FileText',
    requiresAuth: true,
    component: lazy(() => import('./pages/JobDetail')),
    // Job detail is accessed by clicking a job, not from the sidebar
    showInNav: false,
  },
  {
    path: '/onboarding',
    label: 'Onboarding',
    icon: 'Rocket',
    requiresAuth: true,
    component: lazy(() => import('./pages/Onboarding')),
    // Onboarding is shown only for new users, not in regular navigation
    showInNav: false,
  },
  {
    path: '/pipeline',
    label: 'Pipeline',
    icon: 'GitBranch',
    requiresAuth: true,
    component: lazy(() => import('./pages/Pipeline')),
    showInNav: true,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: 'Settings',
    requiresAuth: true,
    component: lazy(() => import('./pages/Settings')),
    showInNav: true,
  },
];

/**
 * Helper: Get only the pages that should appear in the sidebar navigation.
 * Filters out pages like Job Detail and Onboarding that are accessed
 * through other means (clicking a job card, or redirect after signup).
 */
export const navPages = pagesConfig.filter((page) => page.showInNav);
