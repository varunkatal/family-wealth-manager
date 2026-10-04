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
  { to: '/projections', label: 'Projections', icon: 'projections' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];
