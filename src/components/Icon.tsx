export type IconName = 'dashboard' | 'family' | 'assets' | 'liabilities' | 'projections' | 'settings' | 'menu' | 'close';

const PATHS: Record<IconName, string> = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  family:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7.5 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM1 20c0-3.9 3.6-7 8-7s8 3.1 8 7v1H1v-1Zm17.5 1v-1c0-2.4-1-4.5-2.7-6 3.7.2 6.2 2.7 6.2 6v1h-3.5Z',
  assets:
    'M4 6a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Zm2 0v1h10V6H6Zm11 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  liabilities:
    'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm2 2v2h14V8H5Zm2 5v2h4v-2H7Z',
  projections:
    'M3 19h18v2H3v-2Zm1.3-4.7 5-5 3.5 3.5L18 7.6V11h2V4h-7v2h3.6l-4.8 4.8-3.5-3.5-6.4 6.4 1.4 1.4Z',
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
