import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Marca } from '../types';
import type { ResultadoTerminos, ResultadoWER } from '../utils/metricas';
import { CRIBADO } from '../bench/dictados';

// ---------- Estado ----------

export type ModoPrompt = 'con' | 'sin' | 'ambos';

export interface ItemResultado {
  configId: string;
  dictadoId: string;
  conPrompt: boolean;
  duracionAudio: number; // s
  ms: number; // tiempo de transcripción
  tokensPrompt: number;
  reintentos?: number;
  werCrudo?: ResultadoWER;
  werPost?: ResultadoWER;
  terminosCrudo?: ResultadoTerminos;
  terminosPost?: ResultadoTerminos;
  textoCrudo?: string;
  textoPost?: string;
  cambios?: number;
  marcas?: Marca[];
  error?: string;
}

export interface CargaConfig {
  configId: string;
  ms?: number;
  backend?: string;
  error?: string;
}

interface EnCurso {
  configId: string;
  dictadoId: string;
  conPrompt: boolean;
}

export interface EstadoBench {
  audios: Record<string, File>; // no se persiste
  seleccionConfigs: string[];
  seleccionDictados: string[];
  modoPrompt: ModoPrompt;
  resultados: ItemResultado[];
  cargas: CargaConfig[];
  ejecutando: boolean;
  progreso: string;
  enCurso: EnCurso | null;
}

export type AccionBench =
  | { tipo: 'audios'; archivos: Record<string, File> }
  | { tipo: 'alternarConfig'; id: string }
  | { tipo: 'seleccionarDictados'; ids: string[] }
  | { tipo: 'alternarDictado'; id: string }
  | { tipo: 'modoPrompt'; modo: ModoPrompt }
  | { tipo: 'inicio' }
  | { tipo: 'progreso'; texto: string }
  | { tipo: 'enCurso'; valor: EnCurso | null }
  | { tipo: 'carga'; carga: CargaConfig }
  | { tipo: 'resultado'; item: ItemResultado }
  | { tipo: 'fin' }
  | { tipo: 'borrarResultados' };

// Solo resultados de dictados sintéticos: se guardan en el navegador para no
// perderlos si la página se cierra o el sistema la descarta por memoria.
const CLAVE = 'pase-guardia:bench:v1';

function restaurar(): Pick<EstadoBench, 'resultados' | 'cargas' | 'seleccionConfigs' | 'seleccionDictados' | 'modoPrompt'> & { enCurso: EnCurso | null } {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (d) return d;
  } catch {
    /* nada guardado */
  }
  return { resultados: [], cargas: [], seleccionConfigs: [], seleccionDictados: CRIBADO, modoPrompt: 'ambos', enCurso: null };
}

function inicial(): EstadoBench {
  const r = restaurar();
  const resultados = [...r.resultados];
  // Si la página se recargó a mitad de una transcripción, se registra como fallo.
  if (r.enCurso) {
    resultados.push({
      ...r.enCurso,
      duracionAudio: 0,
      ms: 0,
      tokensPrompt: 0,
      error: 'Se interrumpió: posible falta de memoria o la app pasó a segundo plano.',
    });
  }
  return { ...r, resultados, audios: {}, ejecutando: false, progreso: '', enCurso: null };
}

function reducer(s: EstadoBench, a: AccionBench): EstadoBench {
  switch (a.tipo) {
    case 'audios':
      return { ...s, audios: { ...s.audios, ...a.archivos } };
    case 'alternarConfig':
      return {
        ...s,
        seleccionConfigs: s.seleccionConfigs.includes(a.id)
          ? s.seleccionConfigs.filter((x) => x !== a.id)
          : [...s.seleccionConfigs, a.id],
      };
    case 'seleccionarDictados':
      return { ...s, seleccionDictados: a.ids };
    case 'alternarDictado':
      return {
        ...s,
        seleccionDictados: s.seleccionDictados.includes(a.id)
          ? s.seleccionDictados.filter((x) => x !== a.id)
          : [...s.seleccionDictados, a.id].sort(),
      };
    case 'modoPrompt':
      return { ...s, modoPrompt: a.modo };
    case 'inicio':
      return { ...s, ejecutando: true, progreso: 'Preparando…' };
    case 'progreso':
      return { ...s, progreso: a.texto };
    case 'enCurso':
      return { ...s, enCurso: a.valor };
    case 'carga':
      return { ...s, cargas: [...s.cargas.filter((c) => c.configId !== a.carga.configId), a.carga] };
    case 'resultado':
      return {
        ...s,
        resultados: [
          ...s.resultados.filter(
            (r) => !(r.configId === a.item.configId && r.dictadoId === a.item.dictadoId && r.conPrompt === a.item.conPrompt),
          ),
          a.item,
        ],
      };
    case 'fin':
      return { ...s, ejecutando: false, enCurso: null, progreso: '' };
    case 'borrarResultados':
      return { ...s, resultados: [], cargas: [] };
  }
}

// ---------- Contexto ----------

const Ctx = createContext<{ estado: EstadoBench; dispatch: Dispatch<AccionBench> } | null>(null);

export function BenchProvider({ children }: { children: ReactNode }) {
  const [estado, dispatch] = useReducer(reducer, undefined, inicial);
  useEffect(() => {
    const { resultados, cargas, seleccionConfigs, seleccionDictados, modoPrompt, enCurso } = estado;
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ resultados, cargas, seleccionConfigs, seleccionDictados, modoPrompt, enCurso }));
    } catch {
      /* sin almacenamiento */
    }
  }, [estado]);
  return <Ctx.Provider value={{ estado, dispatch }}>{children}</Ctx.Provider>;
}

export function useBench() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useBench fuera de BenchProvider');
  return c;
}
