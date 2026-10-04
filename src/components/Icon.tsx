export type IconName = 'dashboard' | 'family' | 'assets' | 'liabilities' | 'investments' | 'cashflow' | 'goals' | 'projections' | 'history' | 'data' | 'settings' | 'menu' | 'close';

const PATHS: Record<IconName, string> = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  family:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM1 20c0-3.9 3.6-7 8-7s8 3.1 8 7v1H1v-1Zm17.5 1v-1c0-2.4-1-4.5-2.7-6 3.7.2 6.2 2.7 6.2 6v1h-3.5Z',
  assets:
    'M4 6a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm2 0v1h10V6H6Zm11 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  liabilities:
    'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm2 2v2h14V8H5Zm2 5v2h4v-2H7Z',
  investments:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15v1.5h-2V17a3.5 3.5 0 0 1-2.8-2.4l1.9-.6c.2.7.9 1.2 1.9 1.2h1c.8 0 1.3-.4 1.3-1s-.5-1-1.3-1h-2a3 3 0 0 1 0-6V5.5h2V7a3.3 3.3 0 0 1 2.7 2.2l-1.9.6c-.2-.5-.7-.8-1.3-.8h-1.5c-.7 0-1.2.4-1.2 1s.5 1 1.2 1h2a3 3 0 0 1 0 6Z',
  cashflow:
    'M7 4h2v12.2l2.6-2.6L13 15l-5 5-5-5 1.4-1.4L7 16.2V4Zm8 16h2V7.8l2.6 2.6L21 9l-5-5-5 5 1.4 1.4L15 7.8V20Z',
  goals:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
  projections:
    'M3 19h18v2H3v-2Zm1.3-4.7 5-5 3.5 3.5L18 7.6V11h2V4h-7v2h3.6l-4.8 4.8-3.5-3.5-6.4 6.4 1.4 1.4Z',
  history:
    'M13 3a9 9 0 0 0-9 9H1l3.9 3.9L9 12H6a7 7 0 1 1 2.1 5l-1.4 1.4A9 9 0 1 0 13 3Zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8H12Z',
  data:
    'M12 3C7.6 3 4 4.3 4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6c0-1.7-3.6-3-8-3Zm6 15c-.3.4-2.5 1-6 1s-5.7-.6-6-1v-2.3c1.5.8 3.7 1.3 6 1.3s4.5-.5 6-1.3V18Zm0-5c-.3.4-2.5 1-6 1s-5.7-.6-6-1v-2.3c1.5.8 3.7 1.3 6 1.3s4.5-.5 6-1.3V13Zm-6-4c-3.5 0-5.7-.6-6-1 .3-.4 2.5-1 6-1s5.7.6 6 1c-.3.4-2.5 1-6 1Z',
  settings:
    'M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M6 6l12 12M18 6 6 18',
};

const STROKED: IconName[] = ['menu', 'close'];

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const stroked = STROKED.includes(name);
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill={stroked ? 'none' : 'currentColor'}
      stroke={stroked ? 'currentColor' : 'none'}
      strokeWidth={stroked ? 2 : undefined}
      strokeLinecap="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
