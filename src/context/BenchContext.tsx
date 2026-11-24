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

/** Carga de modelo en marcha: si Safari cierra la página por memoria, queda el rastro. */
interface CargaEnCurso {
  configId: string;
  ultimo: string; // último progreso informado (archivo y porcentaje)
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
  cargaEnCurso: CargaEnCurso | null;
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
  | { tipo: 'cargaEnCurso'; valor: CargaEnCurso | null }
  | { tipo: 'carga'; carga: CargaConfig }
  | { tipo: 'resultado'; item: ItemResultado }
  | { tipo: 'fin' }
  | { tipo: 'borrarResultados' };

// Solo resultados de dictados sintéticos: se guardan en el navegador para no
// perderlos si la página se cierra o el sistema la descarta por memoria.
const CLAVE = 'pase-guardia:bench:v1';

type Persistido = Pick<EstadoBench, 'resultados' | 'cargas' | 'seleccionConfigs' | 'seleccionDictados' | 'modoPrompt' | 'enCurso' | 'cargaEnCurso'>;

function restaurar(): Persistido {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (d) return { cargaEnCurso: null, ...d };
  } catch {
    /* nada guardado */
  }
  return { resultados: [], cargas: [], seleccionConfigs: [], seleccionDictados: CRIBADO, modoPrompt: 'ambos', enCurso: null, cargaEnCurso: null };
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
  // Lo mismo si se cerró mientras cargaba un modelo (sin esto, la falla no dejaba rastro).
  const cargas = r.cargaEnCurso
    ? [
        ...r.cargas.filter((c) => c.configId !== r.cargaEnCurso!.configId),
        {
          configId: r.cargaEnCurso.configId,
          error: `Se interrumpió la carga (iba por: ${r.cargaEnCurso.ultimo}). Posible falta de memoria: el sistema cerró la página.`,
        },
      ]
    : r.cargas;
  return { ...r, resultados, cargas, audios: {}, ejecutando: false, progreso: '', enCurso: null, cargaEnCurso: null };
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
      return { ...s, progreso: a.texto, cargaEnCurso: s.cargaEnCurso && { ...s.cargaEnCurso, ultimo: a.texto } };
    case 'enCurso':
      return { ...s, enCurso: a.valor };
    case 'cargaEnCurso':
      return { ...s, cargaEnCurso: a.valor };
    case 'carga':
      return { ...s, cargaEnCurso: null, cargas: [...s.cargas.filter((c) => c.configId !== a.carga.configId), a.carga] };
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
      return { ...s, ejecutando: false, enCurso: null, cargaEnCurso: null, progreso: '' };
    case 'borrarResultados':
      return { ...s, resultados: [], cargas: [] };
  }
}

// ---------- Contexto ----------

const Ctx = createContext<{ estado: EstadoBench; dispatch: Dispatch<AccionBench> } | null>(null);

export function BenchProvider({ children }: { children: ReactNode }) {
  const [estado, dispatch] = useReducer(reducer, undefined, inicial);
  useEffect(() => {
    const { resultados, cargas, seleccionConfigs, seleccionDictados, modoPrompt, enCurso, cargaEnCurso } = estado;
    const guardado: Persistido = { resultados, cargas, seleccionConfigs, seleccionDictados, modoPrompt, enCurso, cargaEnCurso };
    try {
      localStorage.setItem(CLAVE, JSON.stringify(guardado));
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
