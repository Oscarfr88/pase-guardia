import { FlaskConical, Moon, ShieldCheck, Stethoscope, Sun, TriangleAlert } from 'lucide-react';
import { Card } from './components/ui/Card';
import { AVISO_RESPONSABILIDAD, PRINCIPIOS_PRIVACIDAD } from './data/avisos';
import { useTema } from './utils/tema';

// Etapa 2: la app todavía no permite cargar pases. Esta pantalla explica el estado
// del desarrollo y da acceso a la evaluación de motores de transcripción.
export default function App() {
  const [oscuro, alternarTema] = useTema();
  const base = import.meta.env.BASE_URL;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-100 to-clinical-50 text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-clinical-500 to-clinical-700 text-white shadow-glow">
              <Stethoscope size={20} />
            </span>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight">Pase de Guardia UTI</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Dictado y estructuración en el dispositivo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={alternarTema}
            aria-label={oscuro ? 'Modo claro' : 'Modo nocturno'}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300/80 bg-white/60 px-3 text-sm font-medium transition hover:border-clinical-400 dark:border-slate-600/80 dark:bg-slate-800/60"
          >
            {oscuro ? <Sun size={18} /> : <Moon size={18} />}
            <span className="hidden sm:inline">{oscuro ? 'Modo claro' : 'Modo nocturno'}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 shrink-0" size={20} />
          <p className="text-sm">
            <strong>Versión en desarrollo (etapa 2 de 5).</strong> Todavía no se puede usar para pases reales: no
            ingreses datos de pacientes.
          </p>
        </div>

        <Card title="Evaluación de motores de transcripción" subtitle="Para medir en iPhone y Android con los dictados sintéticos">
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
            Compara Whisper en WebGPU y WebAssembly con distintos tamaños de modelo: tasa de error de palabras,
            acierto en términos médicos y tiempo por minuto de audio.
          </p>
          <a
            href={`${base}bench/`}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-clinical-600 px-4 font-semibold text-white transition hover:bg-clinical-700"
          >
            <FlaskConical size={18} /> Abrir la evaluación
          </a>
        </Card>

        <Card title="Aviso de responsabilidad">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {AVISO_RESPONSABILIDAD.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>

        <Card title="Privacidad">
          <ul className="space-y-2 text-sm">
            {PRINCIPIOS_PRIVACIDAD.map((p) => (
              <li key={p} className="flex gap-2">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-clinical-600 dark:text-clinical-400" />
                {p}
              </li>
            ))}
          </ul>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-500">
          Código fuente: github.com/Oscarfr88/pase-guardia · Licencia propuesta Apache-2.0, pendiente de revisión legal.
        </p>
      </main>
    </div>
  );
}
