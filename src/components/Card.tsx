import type { ReactNode } from 'react';

type CardProps = { children: ReactNode; className?: string; padded?: boolean };

export function Card({ children, className = '', padded = true }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </section>
  );
}
