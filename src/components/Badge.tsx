import type { ReactNode } from 'react';

const TONES = {
  demo: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  warning: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
} as const;

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export const DemoBadge = () => <Badge tone="demo">Demo</Badge>;
