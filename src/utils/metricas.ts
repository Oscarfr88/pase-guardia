// ============================================================
// Métricas de evaluación del motor de transcripción:
//   - WER (tasa de error de palabras), estricta y normalizada
//   - tasa de acierto en términos médicos
// Funciones puras: se usan en la página /bench y en las pruebas.
// ============================================================

import { clave, sinTildes } from './texto';

// ---------- Números escritos en palabras → dígitos ----------

const VALORES: Record<string, number> = {
  cero: 0, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};
const DECENAS = new Set([30, 40, 50, 60, 70, 80, 90]);

function valorDe(p: string): number | undefined {
  const k = clave(p);
  if (/^\d+$/.test(k)) return Number(k);
  return VALORES[k];
}

/** Convierte secuencias de números en palabras a dígitos ("treinta y cinco" → "35"). */
export function numerosADigitos(palabras: string[]): string[] {
  const salida: string[] = [];
  let i = 0;
  while (i < palabras.length) {
    const v0 = valorDe(palabras[i]);
    const empiezaNumero = v0 !== undefined || clave(palabras[i]) === 'mil';
    if (!empiezaNumero) { salida.push(palabras[i]); i++; continue; }
    let total = 0, actual = 0, j = i, consumio = false, ultimo: number | undefined;
    while (j < palabras.length) {
      const k = clave(palabras[j]);
      if (k === 'mil') {
        total += (actual || 1) * 1000; actual = 0; consumio = true; ultimo = 1000; j++; continue;
      }
      if (k === 'y' && ultimo !== undefined && DECENAS.has(ultimo % 100) && j + 1 < palabras.length) {
        const sig = valorDe(palabras[j + 1]);
        if (sig !== undefined && sig >= 1 && sig <= 9) { actual += sig; ultimo = sig; j += 2; consumio = true; continue; }
        break;
      }
      const v = valorDe(palabras[j]);
      if (v === undefined) break;
      // Dos números seguidos que no se componen ("5 6") son números separados.
      if (consumio && ultimo !== undefined && !(ultimo >= 100 && v < 100) && !(ultimo === 1000)) break;
      actual += v; ultimo = v; consumio = true; j++;
    }
    salida.push(String(total + actual));
    i = j;
  }
  return salida;
}

// ---------- Normalización para comparar ----------

// Abreviaturas que el post-proceso introduce → su forma hablada, para que no cuenten como error.
const EXPANSIONES: [RegExp, string][] = [
  [/\bml\/kg\/h\b/g, 'mililitros por kilo por hora'],
  [/\bmg\/kg\/h\b/g, 'miligramos por kilo por hora'],
  [/\bmcg\/kg\/min\b/g, 'microgramos por kilo por minuto'],
  [/\bmg\/kg\b/g, 'miligramos por kilo'],
  [/\bml\/kg\b/g, 'mililitros por kilo'],
  [/\bml\/h\b/g, 'mililitros por hora'],
  [/\bmg\/h\b/g, 'miligramos por hora'],
  [/\bl\/min\b/g, 'litros por minuto'],
  [/\bmeq\/l\b/g, 'miliequivalentes por litro'],
  [/\bmmhg\b/g, 'milimetros de mercurio'],
  [/\bcmh2o\b/g, 'centimetros de agua'],
  [/\bmcg\b/g, 'microgramos'],
  [/\bml\b/g, 'mililitros'],
  [/\bmg\b/g, 'miligramos'],
  [/\bmm\b/g, 'milimetros'],
  [/\bcm\b/g, 'centimetros'],
  [/\bkg\b/g, 'kilos'],
  [/%/g, ' por ciento'],
];

/**
 * Normalización estándar para WER: minúsculas, sin puntuación, números en dígitos,
 * abreviaturas de unidades expandidas. Conserva las tildes salvo que se pida lo contrario.
 */
export function normalizarParaMetricas(texto: string, { conTildes = true } = {}): string[] {
  let t = texto.normalize('NFC').toLocaleLowerCase('es');
  if (!conTildes) t = sinTildes(t);
  t = t
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2') // 25.000 → 25000
    .replace(/(\d)\.(\d)/g, '$1,$2'); // 0.15 → 0,15
  for (const [re, rep] of EXPANSIONES) t = t.replace(re, ` ${rep} `);
  t = t
    .replace(/(\d),(\d)/g, '$1\u0000$2') // protege la coma decimal
    .replace(/[-–—/]/g, ' ')
    .replace(/[^\p{L}\p{N}\u0000\s]/gu, ' ')
    .replace(/\u0000/g, ',');
  let palabras = t.split(/\s+/).filter(Boolean);
  // "0 coma 15" o "cero coma quince" → "0,15"
  palabras = numerosADigitos(palabras);
  const salida: string[] = [];
  for (let i = 0; i < palabras.length; i++) {
    if (palabras[i] === 'coma' && /^\d+$/.test(salida[salida.length - 1] ?? '') && /^\d+$/.test(palabras[i + 1] ?? '')) {
      salida[salida.length - 1] = `${salida[salida.length - 1]},${palabras[i + 1]}`;
      i++;
      continue;
    }
    salida.push(palabras[i]);
  }
  return salida;
}

// ---------- WER ----------

export interface ResultadoWER {
  wer: number;
  sustituciones: number;
  borrados: number;
  inserciones: number;
  palabrasReferencia: number;
}

export function calcularWER(referencia: string[], hipotesis: string[]): ResultadoWER {
  const n = referencia.length, m = hipotesis.length;
  // d[i][j] = distancia entre ref[0..i) e hip[0..j); se guarda también el tipo de operación.
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const costo = referencia[i - 1] === hipotesis[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
    }
  }
  let i = n, j = m, s = 0, b = 0, ins = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (referencia[i - 1] === hipotesis[j - 1] ? 0 : 1)) {
      if (referencia[i - 1] !== hipotesis[j - 1]) s++;
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      b++; i--;
    } else {
      ins++; j--;
    }
  }
  return { wer: n ? (s + b + ins) / n : m ? 1 : 0, sustituciones: s, borrados: b, inserciones: ins, palabrasReferencia: n };
}

export function werDeTextos(referencia: string, hipotesis: string, opciones?: { conTildes?: boolean }): ResultadoWER {
  return calcularWER(normalizarParaMetricas(referencia, opciones), normalizarParaMetricas(hipotesis, opciones));
}

// ---------- Términos médicos ----------

function normalizarTerminoTexto(s: string): string {
  return ' ' + s
    .normalize('NFC')
    .toLocaleLowerCase('es')
    .replace(/['’]/g, '')
    .replace(/[-–—/]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ';
}

export interface ResultadoTerminos {
  aciertos: number;
  total: number;
  tasa: number;
  faltantes: string[];
}

/**
 * Proporción de términos esperados que aparecen, escritos correctamente
 * (sin distinguir mayúsculas; con tildes), en la transcripción.
 */
export function aciertoTerminos(terminos: string[], hipotesis: string): ResultadoTerminos {
  const h = normalizarTerminoTexto(hipotesis);
  const faltantes = terminos.filter((t) => !h.includes(normalizarTerminoTexto(t)));
  const total = terminos.length;
  return { aciertos: total - faltantes.length, total, tasa: total ? (total - faltantes.length) / total : 1, faltantes };
}
