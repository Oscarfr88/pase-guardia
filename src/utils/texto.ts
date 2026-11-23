// ============================================================
// Utilidades de texto compartidas por el post-proceso y las métricas.
// Funciones puras, sin dependencias del navegador.
// ============================================================

/** Minúsculas y sin tildes (la ñ se conserva). */
export function sinTildes(s: string): string {
  return s
    .normalize('NFD')
    .replace(/ñ/g, '\u0000') // protege la ñ
    .replace(/Ñ/g, '\u0001')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'ñ')
    .replace(/\u0001/g, 'Ñ')
    .normalize('NFC');
}

/** Clave de comparación: minúsculas, sin tildes. */
export function clave(s: string): string {
  return sinTildes(s).toLowerCase();
}

export interface Token {
  texto: string;
  inicio: number; // índice en el texto original
  fin: number; // exclusivo
}

// Una "palabra": letras y dígitos, con apóstrofo interno (King's). Guiones, barras
// y signos son separadores.
const RE_TOKEN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export function tokenizar(texto: string): Token[] {
  const tokens: Token[] = [];
  for (const m of texto.matchAll(RE_TOKEN)) {
    tokens.push({ texto: m[0], inicio: m.index!, fin: m.index! + m[0].length });
  }
  return tokens;
}

/** Separa una frase en las claves de sus palabras (para armar índices de variantes). */
export function clavesDePalabras(frase: string): string[] {
  return tokenizar(frase).map((t) => clave(t.texto));
}

export function esNumeroEnDigitos(s: string): boolean {
  return /^\d+$/.test(s);
}

const PALABRAS_NUMERO = new Set([
  'cero', 'uno', 'una', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho',
  'diecinueve', 'veinte', 'veintiuno', 'veintiuna', 'veintidos', 'veintitres', 'veinticuatro',
  'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve', 'treinta', 'cuarenta',
  'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa', 'cien', 'ciento', 'doscientos',
  'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos',
  'novecientos', 'mil',
]);

/** ¿Es un número escrito en palabras? (comparación sin tildes) */
export function esPalabraNumero(s: string): boolean {
  return PALABRAS_NUMERO.has(clave(s));
}

export function esNumero(s: string): boolean {
  return esNumeroEnDigitos(s) || esPalabraNumero(s);
}

export function capitalizar(s: string): string {
  return s.length ? s[0].toLocaleUpperCase('es') + s.slice(1) : s;
}

export function empiezaConMayuscula(s: string): boolean {
  return s.length > 0 && s[0] !== s[0].toLocaleLowerCase('es');
}

export function tieneMayusculas(s: string): boolean {
  return s !== s.toLocaleLowerCase('es');
}
