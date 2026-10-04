export type NavItem = {
  to: string;
  label: string;
  icon: 'dashboard' | 'settings';
};

// New sections are added here as each phase is built.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];
