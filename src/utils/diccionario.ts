// ============================================================
// Administración del diccionario personalizado: alta sin duplicados,
// validación de archivos importados, fusión y selección de términos
// para el prompt de sesgo del modelo.
// ============================================================

import type { CategoriaTermino, Diccionario, Termino } from '../types';
import { CATEGORIAS } from '../data/categorias';
import { clave, clavesDePalabras } from './texto';

export const FORMATO_DICCIONARIO = 'pase-guardia/diccionario' as const;

const claveFrase = (s: string) => clavesDePalabras(s).join(' ');

function nuevoId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buscarTermino(dic: Diccionario, termino: string): Termino | undefined {
  const k = claveFrase(termino);
  return dic.terminos.find((t) => claveFrase(t.termino) === k);
}

/** ¿A qué término apunta hoy esta forma (como variante o como término)? */
export function terminoDeForma(dic: Diccionario, forma: string): Termino | undefined {
  const k = claveFrase(forma);
  return dic.terminos.find((t) => claveFrase(t.termino) === k || t.variantes.some((v) => claveFrase(v) === k));
}

export interface ResultadoAlta {
  diccionario: Diccionario;
  accion: 'creado' | 'fusionado' | 'sin_cambios';
  termino: Termino;
  /** Variantes que ya apuntaban a otro término y no se agregaron. */
  conflictos: { variante: string; terminoExistente: string }[];
}

/**
 * Agrega un término desde la interfaz. Si ya existe (misma forma, sin importar
 * mayúsculas ni tildes), no lo duplica: fusiona las variantes nuevas.
 * Devuelve un diccionario nuevo (inmutable) con la versión incrementada.
 */
export function agregarTermino(
  dic: Diccionario,
  entrada: { termino: string; variantes: string[]; categoria: CategoriaTermino; sesgo?: boolean; nota?: string },
): ResultadoAlta {
  const termino = entrada.termino.trim();
  if (!termino) throw new Error('El término no puede estar vacío.');
  const kTermino = claveFrase(termino);
  const existente = buscarTermino(dic, termino);

  const conflictos: ResultadoAlta['conflictos'] = [];
  const variantesValidas: string[] = [];
  for (const vBruta of entrada.variantes) {
    const v = vBruta.trim();
    const kv = claveFrase(v);
    // vacía o idéntica al término (una variante que solo difiere en tildes sí sirve)
    if (!kv || v.toLocaleLowerCase('es') === termino.toLocaleLowerCase('es')) continue;
    const duenio = terminoDeForma(dic, v);
    if (duenio && claveFrase(duenio.termino) !== kTermino) {
      conflictos.push({ variante: v, terminoExistente: duenio.termino });
      continue;
    }
    if (!variantesValidas.some((x) => claveFrase(x) === kv)) variantesValidas.push(v);
  }

  if (existente) {
    const nuevas = variantesValidas.filter((v) => !existente.variantes.some((x) => claveFrase(x) === claveFrase(v)));
    if (!nuevas.length) return { diccionario: dic, accion: 'sin_cambios', termino: existente, conflictos };
    const actualizado: Termino = { ...existente, variantes: [...existente.variantes, ...nuevas] };
    return {
      diccionario: {
        ...dic,
        version: dic.version + 1,
        terminos: dic.terminos.map((t) => (t.id === existente.id ? actualizado : t)),
      },
      accion: 'fusionado',
      termino: actualizado,
      conflictos,
    };
  }

  const nuevo: Termino = {
    id: nuevoId(),
    termino,
    variantes: variantesValidas,
    categoria: entrada.categoria,
    origen: 'usuario',
    sesgo: entrada.sesgo ?? true,
    ...(entrada.nota ? { nota: entrada.nota } : {}),
  };
  return {
    diccionario: { ...dic, version: dic.version + 1, terminos: [...dic.terminos, nuevo] },
    accion: 'creado',
    termino: nuevo,
    conflictos,
  };
}

// ---------- Validación e importación ----------

export interface ProblemaDiccionario {
  tipo: 'formato' | 'duplicado' | 'conflicto' | 'categoria';
  detalle: string;
}

export function validarDiccionario(dato: unknown): { ok: boolean; problemas: ProblemaDiccionario[] } {
  const problemas: ProblemaDiccionario[] = [];
  const d = dato as Partial<Diccionario> | null;
  if (!d || typeof d !== 'object') return { ok: false, problemas: [{ tipo: 'formato', detalle: 'El archivo no es un objeto JSON.' }] };
  if (d.formato !== FORMATO_DICCIONARIO) problemas.push({ tipo: 'formato', detalle: `"formato" debe ser "${FORMATO_DICCIONARIO}".` });
  if (!Array.isArray(d.terminos)) {
    problemas.push({ tipo: 'formato', detalle: '"terminos" debe ser una lista.' });
    return { ok: false, problemas };
  }
  const vistos = new Map<string, string>();
  const formas = new Map<string, string>();
  d.terminos.forEach((t, i) => {
    if (!t || typeof t.termino !== 'string' || !t.termino.trim() || !Array.isArray(t.variantes)) {
      problemas.push({ tipo: 'formato', detalle: `Término #${i + 1}: requiere "termino" (texto) y "variantes" (lista).` });
      return;
    }
    if (!CATEGORIAS.some((c) => c.id === t.categoria)) {
      problemas.push({ tipo: 'categoria', detalle: `"${t.termino}": categoría desconocida "${t.categoria}".` });
    }
    const k = claveFrase(t.termino);
    if (vistos.has(k)) problemas.push({ tipo: 'duplicado', detalle: `"${t.termino}" está repetido.` });
    vistos.set(k, t.termino);
    for (const v of [t.termino, ...t.variantes]) {
      const kv = claveFrase(String(v));
      const previo = formas.get(kv);
      if (previo !== undefined && claveFrase(previo) !== k) {
        problemas.push({ tipo: 'conflicto', detalle: `"${v}" apunta a "${previo}" y a "${t.termino}".` });
      }
      formas.set(kv, t.termino);
    }
  });
  return { ok: !problemas.some((p) => p.tipo === 'formato' || p.tipo === 'categoria'), problemas };
}

/** Importa un diccionario y lo fusiona con el actual sin duplicar. */
export function importarDiccionario(actual: Diccionario, json: string): { diccionario: Diccionario; agregados: number; fusionados: number; conflictos: number } {
  let dato: unknown;
  try {
    dato = JSON.parse(json);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const { ok, problemas } = validarDiccionario(dato);
  if (!ok) throw new Error(problemas.map((p) => p.detalle).join('\n'));
  let dic = actual;
  let agregados = 0, fusionados = 0, conflictos = 0;
  for (const t of (dato as Diccionario).terminos) {
    const r = agregarTermino(dic, { termino: t.termino, variantes: t.variantes, categoria: t.categoria, sesgo: t.sesgo, nota: t.nota });
    dic = r.diccionario;
    if (r.accion === 'creado') agregados++;
    if (r.accion === 'fusionado') fusionados++;
    conflictos += r.conflictos.length;
  }
  return { diccionario: dic, agregados, fusionados, conflictos };
}

export function exportarDiccionario(dic: Diccionario): string {
  return JSON.stringify({ formato: FORMATO_DICCIONARIO, version: dic.version, terminos: dic.terminos }, null, 2);
}

// ---------- Prompt de sesgo ----------

/**
 * Términos para el prompt inicial de Whisper, en orden de prioridad:
 * primero los del usuario (los más recientes primero), después los de la base
 * marcados con `sesgo`. El worker los recorta al presupuesto de tokens.
 */
export function terminosParaSesgo(dic: Diccionario): string[] {
  const usuario = dic.terminos.filter((t) => t.origen === 'usuario' && t.sesgo).reverse();
  const base = dic.terminos.filter((t) => t.origen === 'base' && t.sesgo);
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const t of [...usuario, ...base]) {
    const k = clave(t.termino);
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push(t.termino);
  }
  return salida;
}

export const ENCABEZADO_PROMPT = 'Pase de guardia de terapia intensiva.';
