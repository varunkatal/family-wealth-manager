import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Disclaimer } from '../components/Disclaimer';
import { Icon } from '../components/Icon';
import { StorageBadge } from '../features/sync/StorageBadge';
import { SyncStatusMessage } from '../features/sync/SyncStatusMessage';
import { NAV_ITEMS } from './navigation';
import { useSettings } from './SettingsContext';
import { useOptionalSync } from './SyncContext';

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {NAV_ITEMS.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`
            }
          >
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 font-bold text-white">₹</span>
      <span className="font-semibold leading-tight">Family Wealth Calculator</span>
    </div>
  );
}

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { error } = useSettings();
  const sync = useOptionalSync();

  // Close the mobile menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 md:flex dark:border-slate-800 dark:bg-slate-900">
        <Brand />
        <nav aria-label="Main" className="mt-8">
          <NavLinks />
        </nav>
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white px-4 py-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close menu"
              >
                <Icon name="close" />
              </button>
            </div>
            <nav aria-label="Mobile" className="mt-8">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </nav>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-900/90">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>
          <span className="truncate font-semibold md:hidden">Family Wealth Calculator</span>
          <div className="ml-auto">
            <StorageBadge />
          </div>
        </header>

        {sync?.mode === 'google' && sync.status.kind === 'error' && <SyncStatusMessage className="mx-4 mt-3 md:mx-8" />}

        {error && (
          <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 md:px-8 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {error}
          </div>
        )}

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-6xl">
            <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <footer className="border-t border-slate-200 px-4 py-4 md:px-8 dark:border-slate-800">
          <div className="mx-auto max-w-6xl">
            <Disclaimer />
          </div>
        </footer>
      </div>
    </div>
  );
}
