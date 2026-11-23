import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  icono?: ReactNode;
}

const estilos: Record<Variante, string> = {
  primario:
    'bg-clinical-600 text-white hover:bg-clinical-700 disabled:bg-slate-400 dark:disabled:bg-slate-700',
  secundario:
    'border border-slate-300/80 bg-white/70 text-slate-700 hover:border-clinical-400 hover:text-clinical-700 dark:border-slate-600/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:text-clinical-300',
  peligro: 'bg-rose-600 text-white hover:bg-rose-700',
};

/** Botón táctil: alto mínimo de 48 px. */
export function Boton({ variante = 'primario', icono, className = '', children, ...resto }: Props) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${estilos[variante]} ${className}`}
      {...resto}
    >
      {icono}
      {children}
    </button>
  );
}
