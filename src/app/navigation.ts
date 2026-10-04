import type { IconName } from '../components/Icon';

export type NavItem = {
  to: string;
  label: string;
  icon: IconName;
};

// New sections are added here as each phase is built.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/family', label: 'Family', icon: 'family' },
  { to: '/assets', label: 'Assets', icon: 'assets' },
  { to: '/liabilities', label: 'Liabilities', icon: 'liabilities' },
  { to: '/investments', label: 'Investments', icon: 'investments' },
  { to: '/cash-flow', label: 'Cash flow', icon: 'cashflow' },
  { to: '/goals', label: 'Goals', icon: 'goals' },
  { to: '/projections', label: 'Projections', icon: 'projections' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];
