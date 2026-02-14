/**
 * src/Layout.jsx
 *
 * Main application layout with Modern Glassmorphism design
 * 
 * DESIGN SYSTEM:
 * - Background: Deep slate-950 (Professional dark)
 * - Glass Cards: slate-900/50 with backdrop-blur-md
 * - Borders: white/10 (Subtle glass edges)
 * - Text: slate-100 (High readability)
 * - Accents: blue-400 (Modern, professional)
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Search,
  Briefcase,
  Settings,
  Menu,
  X,
  LogOut,
  Target,
  Sparkles
} from 'lucide-react';
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Jobs', path: '/jobs', icon: Search },
  { name: 'Pipeline', path: '/pipeline', icon: Briefcase },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ═══════════════════════════════════════════════════════════
       * DESKTOP SIDEBAR - Glassmorphism Style
       * ═══════════════════════════════════════════════════════════ */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-1 flex-col bg-slate-900/50 backdrop-blur-md border-r border-white/10">
          {/* Logo */}
          <div className="flex h-16 items-center px-6 border-b border-white/10">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-100">InternHunter</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/20"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", active && "text-blue-400")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Profile & Logout Dropdown */}
          {user && (
            <div className="p-4 border-t border-white/10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-500/20 text-blue-400 text-sm border border-blue-500/30">
                        {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">
                        {user.user_metadata?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-slate-900/95 backdrop-blur-md border-white/10 text-slate-100">
                  <DropdownMenuItem asChild className="hover:bg-slate-800/50">
                    <Link to="/settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-400 hover:bg-red-500/10">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════
       * MOBILE HEADER - Glassmorphism Style
       * ═══════════════════════════════════════════════════════════ */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-900/50 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-100">InternHunter</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-100 hover:bg-slate-800/50"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <nav className="px-4 py-3 border-t border-white/10 bg-slate-900/95 backdrop-blur-md">
            <div className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-blue-500/20 text-blue-400"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
            {user && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10"
                >
                  <LogOut className="w-5 h-5" />
                  Sign out
                </button>
              </div>
            )}
          </nav>
        )}
      </header>

      {/* ═══════════════════════════════════════════════════════════
       * MAIN CONTENT AREA
       * ═══════════════════════════════════════════════════════════ */}
      <main className="lg:pl-64">
        {children}
      </main>
    </div>
  );
}
