// ============================================================
// Post-proceso determinístico de la transcripción.
//
//   1. Puntuación dictada ("punto y aparte", "coma", "dos puntos"…)
//   2. Diccionario: variante → término correcto
//   3. Unidades después de un número ("30 mililitros por kilo" → "30 ml/kg")
//   4. Coma decimal (0.35 → 0,35, solo si no es ambiguo)
//   5. Marcas para revisión (alucinaciones, repeticiones, números ambiguos)
//
// No agrega ni quita contenido clínico: cada cambio queda registrado en
// `cambios` para resaltarlo en la revisión, y lo dudoso se marca sin tocarlo.
// ============================================================

import type {
  Cambio,
  Diccionario,
  Marca,
  OpcionesPostproceso,
  ResultadoPostproceso,
} from '../types';
import {
  COMA_CLINICA_ANTES,
  COMA_CLINICA_DESPUES,
  COMANDOS_PUNTUACION,
  DOS_PUNTOS_PROPIO_ANTES,
  DOS_PUNTOS_PROPIO_DESPUES,
  FRASES_ALUCINADAS,
  PALABRAS_SECCION,
  PUNTO_PROPIO_ANTES,
  RAICES_CON_DIGITO,
  PUNTO_PROPIO_DESPUES,
  UNIDADES,
} from '../data/reglasTexto';
import {
  capitalizar,
  clave,
  clavesDePalabras,
  empiezaConMayuscula,
  esNumero,
  esNumeroEnDigitos,
  tieneMayusculas,
  tokenizar,
  type Token,
} from './texto';

export const OPCIONES_POR_DEFECTO: OpcionesPostproceso = {
  puntuacionDictada: true,
  comaDecimal: true,
  abreviarUnidades: true,
};

// Marca invisible que rodea los signos insertados por la puntuación dictada,
// para limpiar solo alrededor de ellos y no tocar el resto del texto.
const S = '';

// ---------- 1. Puntuación dictada ----------

function separadorEntre(texto: string, a: Token, b: Token): string {
  return texto.slice(a.fin, b.inicio);
}

/** Entre las palabras de un comando solo puede haber espacios o la puntuación que puso el modelo. */
function separadorDeComando(sep: string): boolean {
  return /^[\s,.;:]+$/.test(sep);
}

/**
 * Formas en que Whisper ya "interpretó" a medias un comando dictado:
 * "punto y aparte" → ". y aparte"; "punto seguido" → ".seguido".
 */
function comandosInterpretadosPorElModelo(texto: string, cambios: Cambio[]): string {
  return texto
    .replace(/\s*\.\s*y\s+aparte\b(?!\s*,)[.,]?/giu, (m) => {
      cambios.push({ tipo: 'puntuacion', desde: m.trim(), hacia: '.↵' });
      return `${S}.\n`;
    })
    .replace(/\s*\.\s*(?:y\s+)?seguido\b(?!\s+(?:de|del|por)\b)[.,]?/giu, (m) => {
      cambios.push({ tipo: 'puntuacion', desde: m.trim(), hacia: '.' });
      return `${S}.`;
    });
}

export function aplicarPuntuacionDictada(texto: string, cambios: Cambio[]): string {
  texto = comandosInterpretadosPorElModelo(texto, cambios);
  const tokens = tokenizar(texto);
  const claves = tokens.map((t, i) =>
    // "2 puntos" es "dos puntos" (el modelo escribió el número)
    t.texto === '2' && i + 1 < tokens.length && clave(tokens[i + 1].texto) === 'puntos' ? 'dos' : clave(t.texto),
  );
  let salida = '';
  let cursor = 0;
  let i = 0;

  while (i < tokens.length) {
    let aplicado = false;
    // "Diagnóstico 2. Estado…": después de una palabra de sección, "2." es "dos puntos".
    if (i > 0 && tokens[i].texto === '2' && PALABRAS_SECCION.has(claves[i - 1]) &&
        /^\s+$/.test(separadorEntre(texto, tokens[i - 1], tokens[i])) &&
        /^\.(?!\d)/.test(texto.slice(tokens[i].fin))) {
      salida += texto.slice(cursor, tokens[i].inicio) + S + ':';
      cursor = tokens[i].fin + 1; // consume el punto
      cambios.push({ tipo: 'puntuacion', desde: '2.', hacia: ':' });
      i += 1;
      continue;
    }
    for (const cmd of COMANDOS_PUNTUACION) {
      const n = cmd.palabras.length;
      if (i + n > tokens.length) continue;
      let coincide = true;
      for (let k = 0; k < n; k++) {
        if (claves[i + k] !== cmd.palabras[k]) { coincide = false; break; }
        if (k > 0 && !separadorDeComando(separadorEntre(texto, tokens[i + k - 1], tokens[i + k]))) {
          coincide = false; break;
        }
      }
      if (!coincide) continue;

      const previo = i > 0 ? claves[i - 1] : '';
      const siguiente = i + n < tokens.length ? claves[i + n] : '';
      const previoTok = i > 0 ? tokens[i - 1] : null;
      const siguienteTok = i + n < tokens.length ? tokens[i + n] : null;
      const cmdClave = cmd.palabras.join(' ');

      // Decimal hablado entre dígitos: "0 coma 15" → "0,15"; "7 punto 35" → "7,35"
      if ((cmdClave === 'coma' || cmdClave === 'punto') && previoTok && siguienteTok &&
          esNumeroEnDigitos(previoTok.texto) && esNumeroEnDigitos(siguienteTok.texto) &&
          /^\s+$/.test(separadorEntre(texto, previoTok, tokens[i])) &&
          /^\s+$/.test(separadorEntre(texto, tokens[i], siguienteTok))) {
        salida += texto.slice(cursor, previoTok.fin) + ',';
        cursor = siguienteTok.inicio;
        cambios.push({ tipo: 'decimal', desde: `${previoTok.texto} ${tokens[i].texto} ${siguienteTok.texto}`, hacia: `${previoTok.texto},${siguienteTok.texto}` });
        i += 1;
        aplicado = true;
        break;
      }

      // Usos no gramaticales: se deja la palabra tal cual.
      if (cmdClave === 'coma') {
        if (COMA_CLINICA_ANTES.has(previo) || COMA_CLINICA_DESPUES.has(siguiente)) break;
        if (esNumero(previo) && esNumero(siguiente)) break; // "cero coma quince"
      }
      if (cmdClave === 'punto') {
        if (PUNTO_PROPIO_ANTES.has(previo) || PUNTO_PROPIO_DESPUES.has(siguiente)) break;
        if (esNumero(previo) && esNumero(siguiente)) break;
      }
      if (cmdClave === 'dos puntos') {
        if (DOS_PUNTOS_PROPIO_ANTES.has(previo) || DOS_PUNTOS_PROPIO_DESPUES.has(siguiente)) break;
      }

      const desde = texto.slice(tokens[i].inicio, tokens[i + n - 1].fin);
      salida += texto.slice(cursor, tokens[i].inicio) + S + cmd.signo;
      cursor = tokens[i + n - 1].fin;
      cambios.push({ tipo: 'puntuacion', desde, hacia: cmd.signo === '\n' ? '↵' : cmd.signo.replace('\n', '↵') });
      i += n;
      aplicado = true;
      break;
    }
    if (!aplicado) i += 1;
  }
  salida += texto.slice(cursor);
  return limpiarAlrededorDeSignos(salida);
}

function limpiarAlrededorDeSignos(s: string): string {
  if (!s.includes(S)) return s;
  const signo = `${S}(?:\\.\\n|[,.;:()\\n])`;
  return s
    // espacios antes del signo insertado (salvo la apertura de paréntesis)
    .replace(new RegExp(`[ \\t]*(${S}(?:\\.\\n|[,.;:)\\n]))`, 'g'), '$1')
    // puntuación que puso el modelo justo antes: gana la dictada
    .replace(new RegExp(`[,.;:]+(${signo})`, 'g'), '$1')
    // puntuación que puso el modelo justo después
    .replace(new RegExp(`(${signo})[ \\t]*[,.;:]+(?!\\d)`, 'g'), '$1')
    // saltos de línea: sin espacios alrededor, mayúscula después
    .replace(new RegExp(`(${S}(?:\\.)?\\n)[ \\t]*(\\p{L})`, 'gu'), (_, a: string, l: string) => a + l.toLocaleUpperCase('es'))
    .replace(new RegExp(`(${S}(?:\\.)?\\n)[ \\t]+`, 'g'), '$1')
    // punto: un espacio y mayúscula
    .replace(new RegExp(`(${S}\\.)[ \\t]*(\\p{L})`, 'gu'), (_, a: string, l: string) => `${a} ${l.toLocaleUpperCase('es')}`)
    // coma, punto y coma, dos puntos, cierre de paréntesis: un espacio después
    .replace(new RegExp(`(${S}[,;:)])[ \\t]*(?=[\\p{L}\\p{N}(])`, 'gu'), '$1 ')
    // apertura de paréntesis: sin espacio después
    .replace(new RegExp(`(${S}\\()[ \\t]+`, 'g'), '$1')
    .replaceAll(S, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '');
}

// ---------- 2. Diccionario ----------

interface Entrada {
  termino: string;
  /** Solo el propio término (sin variantes) se compara respetando tildes. */
  conTildes?: string;
}

export interface IndiceDiccionario {
  maxPalabras: number;
  mapa: Map<string, Entrada[]>;
}

export function compilarDiccionario(dic: Diccionario): IndiceDiccionario {
  const mapa = new Map<string, Entrada[]>();
  let maxPalabras = 1;
  const agregar = (k: string[], e: Entrada) => {
    if (!k.length) return;
    const key = k.join(' ');
    const lista = mapa.get(key) ?? [];
    if (!lista.some((x) => x.termino === e.termino && x.conTildes === e.conTildes)) lista.push(e);
    mapa.set(key, lista);
    maxPalabras = Math.max(maxPalabras, k.length);
  };
  for (const t of dic.terminos) {
    for (const v of t.variantes) agregar(clavesDePalabras(v), { termino: t.termino });
    // El término en sí: corrige mayúsculas de siglas y epónimos ("fio2" → "FiO2",
    // "glasgow" → "Glasgow") y guiones ("ceftazidima avibactam" → "ceftazidima-avibactam").
    // Respeta tildes para no convertir, por ejemplo, "irá" en una sigla. Se omiten las
    // notaciones de letras sueltas ("E/A") para no capturar secuencias comunes.
    if (tokenizar(t.termino).some((x) => x.texto.length > 1)) {
      agregar(clavesDePalabras(t.termino), {
        termino: t.termino,
        conTildes: tokenizar(t.termino).map((x) => x.texto.toLocaleLowerCase('es')).join(' '),
      });
    }
  }
  return { maxPalabras, mapa };
}

function reemplazoConMayusculas(original: string, termino: string): string {
  if (tieneMayusculas(termino)) return termino;
  return empiezaConMayuscula(original) ? capitalizar(termino) : termino;
}

export function aplicarDiccionario(texto: string, indice: IndiceDiccionario, cambios: Cambio[]): string {
  const tokens = tokenizar(texto);
  let salida = '';
  let cursor = 0;
  let i = 0;
  while (i < tokens.length) {
    let consumidos = 0;
    for (let n = Math.min(indice.maxPalabras, tokens.length - i); n >= 1; n--) {
      // Las palabras de una variante deben estar separadas solo por espacios, guiones o barras.
      let contiguas = true;
      for (let k = 1; k < n; k++) {
        if (!/^[\s\-/]+$/.test(texto.slice(tokens[i + k - 1].fin, tokens[i + k].inicio))) { contiguas = false; break; }
      }
      if (!contiguas) continue;
      const tramo = tokens.slice(i, i + n);
      const entradas = indice.mapa.get(tramo.map((t) => clave(t.texto)).join(' '));
      if (!entradas) continue;
      const minus = tramo.map((t) => t.texto.toLocaleLowerCase('es')).join(' ');
      const entrada = entradas.find((e) => e.conTildes === undefined || e.conTildes === minus);
      if (!entrada) continue;

      const original = texto.slice(tramo[0].inicio, tramo[n - 1].fin);
      const nuevo = reemplazoConMayusculas(original, entrada.termino);
      salida += texto.slice(cursor, tramo[0].inicio) + nuevo;
      cursor = tramo[n - 1].fin;
      if (nuevo !== original) cambios.push({ tipo: 'diccionario', desde: original, hacia: nuevo });
      consumidos = n;
      break;
    }
    i += consumidos || 1;
  }
  return salida + texto.slice(cursor);
}

// ---------- 3. Unidades ----------

const UNIDADES_CLAVES = UNIDADES.map((u) => ({ ...u, claves: u.palabras })).sort(
  (a, b) => b.claves.length - a.claves.length,
);

export function abreviarUnidades(texto: string, cambios: Cambio[]): string {
  // "40%" → "40 %" (norma de la RAE)
  texto = texto.replace(/(\d)%/g, (_, d: string) => {
    cambios.push({ tipo: 'unidad', desde: `${d}%`, hacia: `${d} %` });
    return `${d} %`;
  });
  const tokens = tokenizar(texto);
  const claves = tokens.map((t) => clave(t.texto));
  let salida = '';
  let cursor = 0;
  for (let i = 1; i < tokens.length; i++) {
    if (!esNumeroEnDigitos(tokens[i - 1].texto)) continue;
    if (!/^[ \t]+$/.test(texto.slice(tokens[i - 1].fin, tokens[i].inicio))) continue;
    for (const u of UNIDADES_CLAVES) {
      const n = u.claves.length;
      if (i + n > tokens.length) continue;
      let ok = true;
      for (let k = 0; k < n; k++) {
        if (claves[i + k] !== u.claves[k]) { ok = false; break; }
        if (k > 0 && !/^[ \t]+$/.test(texto.slice(tokens[i + k - 1].fin, tokens[i + k].inicio))) { ok = false; break; }
      }
      if (!ok) continue;
      const desde = texto.slice(tokens[i].inicio, tokens[i + n - 1].fin);
      salida += texto.slice(cursor, tokens[i - 1].fin) + ' ' + u.abreviatura;
      cursor = tokens[i + n - 1].fin;
      cambios.push({ tipo: 'unidad', desde, hacia: u.abreviatura });
      i += n - 1;
      break;
    }
  }
  return salida + texto.slice(cursor);
}

// ---------- 4. Coma decimal ----------

export function normalizarDecimales(texto: string, cambios: Cambio[], marcas: Marca[]): string {
  // Punto decimal → coma. Se convierte si la parte decimal tiene 1–2 cifras o si la
  // parte entera es 0. "25.000" (tres cifras) es separador de miles y no se toca.
  // Tampoco se tocan las horas ("a las 8.30").
  const salida = texto.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d]|[.,]\d)/g, (m, ent: string, dec: string, off: number) => {
    const antes = clave(texto.slice(Math.max(0, off - 8), off));
    if (/\b(las|la|hora|horas)\s*$/.test(antes)) return m;
    if (dec.length <= 2 || ent === '0') {
      const nuevo = `${ent},${dec}`;
      cambios.push({ tipo: 'decimal', desde: m, hacia: nuevo });
      return nuevo;
    }
    return m;
  });
  // "25,000": en español es veinticinco con decimales, pero el modelo pudo usar
  // la coma como separador de miles. No se cambia: se marca.
  for (const m of salida.matchAll(/(?<![\d.,])([1-9]\d{0,2}),(\d{3})(?![\d]|[.,]\d)/g)) {
    marcas.push({ tipo: 'ambiguo', texto: m[0], motivo: '¿Separador de miles o decimales? Verificar el número.' });
  }
  return salida;
}

// ---------- 5. Marcas ----------

export function detectarMarcas(texto: string, marcas: Marca[]): void {
  for (const m of texto.matchAll(RAICES_CON_DIGITO)) {
    marcas.push({ tipo: 'ambiguo', texto: m[0], motivo: `¿"${m[1]}${m[2]}" seguido de ${m[3]}? El modelo pudo pegar el dígito del término al valor.` });
  }
  for (const m of texto.matchAll(/(?<![\d.,])\d+\.\s\d{1,2}(?!\d|[.,]\d)/g)) {
    marcas.push({ tipo: 'ambiguo', texto: m[0], motivo: '¿Decimal partido por un espacio? Verificar el número.' });
  }
  const k = clave(texto);
  for (const frase of FRASES_ALUCINADAS) {
    if (k.includes(frase)) {
      marcas.push({ tipo: 'alucinacion', texto: frase, motivo: 'Frase típica que el modelo inventa sobre silencio o ruido.' });
      break;
    }
  }
  // Bucles: la misma secuencia de 1 a 6 palabras repetida 4 veces o más seguidas.
  const palabras = tokenizar(texto).map((t) => clave(t.texto));
  for (let n = 1; n <= 6; n++) {
    for (let i = 0; i + n * 4 <= palabras.length; i++) {
      const base = palabras.slice(i, i + n).join(' ');
      let rep = 1;
      while (i + (rep + 1) * n <= palabras.length && palabras.slice(i + rep * n, i + (rep + 1) * n).join(' ') === base) rep++;
      if (rep >= 4) {
        marcas.push({ tipo: 'repeticion', texto: base, motivo: `Se repite ${rep} veces seguidas: posible bucle del modelo.` });
        return;
      }
    }
  }
}

// ---------- Pipeline ----------

export function postprocesar(
  texto: string,
  indice: IndiceDiccionario,
  opciones: OpcionesPostproceso = OPCIONES_POR_DEFECTO,
): ResultadoPostproceso {
  const cambios: Cambio[] = [];
  const marcas: Marca[] = [];
  let t = texto.trim();
  if (opciones.puntuacionDictada) t = aplicarPuntuacionDictada(t, cambios);
  t = aplicarDiccionario(t, indice, cambios);
  if (opciones.abreviarUnidades) t = abreviarUnidades(t, cambios);
  if (opciones.comaDecimal) t = normalizarDecimales(t, cambios, marcas);
  detectarMarcas(t, marcas);
  return { texto: t, cambios, marcas };
}
