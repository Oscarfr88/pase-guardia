import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Card({ title, subtitle, children }: Props) {
  return (
    <section className="mb-5 animate-fade-in rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft transition duration-300 hover:shadow-glow dark:border-slate-700/60 dark:bg-slate-800/50">
      <header className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-700/70">
        <span className="h-4 w-1 rounded-full bg-gradient-to-b from-clinical-400 to-clinical-600" />
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
