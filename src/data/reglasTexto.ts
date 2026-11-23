// ============================================================
// Reglas determinísticas del post-proceso (datos, separados de la lógica).
// Todas las claves van en minúsculas y sin tildes (ver utils/texto.ts → clave()).
// ============================================================

// ---------- Puntuación dictada ----------

export interface ComandoPuntuacion {
  /** Palabras del comando (claves). */
  palabras: string[];
  /** Signo que se inserta. '\n' = salto de línea. */
  signo: string;
}

// Ordenados de más largo a más corto: se aplica siempre la coincidencia más larga.
export const COMANDOS_PUNTUACION: ComandoPuntuacion[] = [
  { palabras: ['punto', 'y', 'aparte'], signo: '.\n' },
  { palabras: ['punto', 'y', 'seguido'], signo: '.' },
  { palabras: ['punto', 'y', 'coma'], signo: ';' },
  { palabras: ['abre', 'parentesis'], signo: '(' },
  { palabras: ['cierra', 'parentesis'], signo: ')' },
  { palabras: ['punto', 'aparte'], signo: '.\n' },
  { palabras: ['punto', 'seguido'], signo: '.' },
  { palabras: ['punto', 'final'], signo: '.' },
  { palabras: ['dos', 'puntos'], signo: ':' },
  { palabras: ['nueva', 'linea'], signo: '\n' },
  { palabras: ['nuevo', 'renglon'], signo: '\n' },
  { palabras: ['nuevo', 'parrafo'], signo: '\n' },
  { palabras: ['coma'], signo: ',' },
  { palabras: ['punto'], signo: '.' },
];

/**
 * "coma" con sentido clínico: no se convierte en signo.
 * Antes de: "en coma", "estado de coma", "salió del coma", "un coma"…
 */
export const COMA_CLINICA_ANTES = new Set([
  'en', 'de', 'del', 'un', 'el', 'al', 'su', 'nuevo', 'estado', 'profundo',
]);
/** Después de: "coma barbitúrico", "coma inducido", "coma vigil"… */
export const COMA_CLINICA_DESPUES = new Set([
  'barbiturico', 'inducido', 'farmacologico', 'profundo', 'vigil', 'hiperosmolar',
  'mixedematoso', 'hepatico', 'uremico', 'diabetico', 'metabolico', 'estructural',
  'superficial', 'irreversible', 'depasse', 'grado', 'glasgow',
]);

/** "punto" con sentido propio: "el punto de corte", "punto de inserción", "punto máximo"… */
export const PUNTO_PROPIO_ANTES = new Set([
  'el', 'un', 'del', 'al', 'este', 'ese', 'cada', 'primer', 'mismo', 'otro', 'su', 'buen', 'mal',
]);
export const PUNTO_PROPIO_DESPUES = new Set([
  'de', 'del', 'maximo', 'minimo', 'medio', 'ciego', 'cardinal', 'critico', 'gatillo', 'g',
]);

/** "dos puntos" que no es el signo: "el Glasgow bajó dos puntos", "dos puntos de Glasgow". */
export const DOS_PUNTOS_PROPIO_ANTES = new Set([
  'bajo', 'subio', 'cayo', 'aumento', 'descendio', 'mejoro', 'empeoro', 'perdio', 'gano',
  'sumo', 'resto', 'de', 'en', 'a', 'los', 'unos', 'otros', 'solo',
]);
export const DOS_PUNTOS_PROPIO_DESPUES = new Set(['de', 'del', 'en', 'menos', 'mas', 'por', 'respecto']);

// ---------- Unidades (solo inmediatamente después de un número en dígitos) ----------
// No se abrevian "unidades" (U se confunde con 0 o 4, ISMP), "gammas", "grados",
// ni las unidades de tiempo sueltas.

export interface ReglaUnidad {
  palabras: string[];
  abreviatura: string;
}

const U = (frase: string, abreviatura: string): ReglaUnidad => ({
  palabras: frase.split(' '),
  abreviatura,
});

export const UNIDADES: ReglaUnidad[] = [
  U('mililitros por kilo por hora', 'ml/kg/h'),
  U('mililitros por kilogramo por hora', 'ml/kg/h'),
  U('miligramos por kilo por hora', 'mg/kg/h'),
  U('miligramos por kilogramo por hora', 'mg/kg/h'),
  U('microgramos por kilo por minuto', 'mcg/kg/min'),
  U('microgramos por kilogramo por minuto', 'mcg/kg/min'),
  U('microgramos por kilo por hora', 'mcg/kg/h'),
  U('miligramos por kilo por dia', 'mg/kg/día'),
  U('miligramos por kilo', 'mg/kg'),
  U('miligramos por kilogramo', 'mg/kg'),
  U('mililitros por kilo', 'ml/kg'),
  U('mililitros por kilogramo', 'ml/kg'),
  U('mililitros por hora', 'ml/h'),
  U('miligramos por hora', 'mg/h'),
  U('microgramos por hora', 'mcg/h'),
  U('microgramos por minuto', 'mcg/min'),
  U('litros por minuto', 'l/min'),
  U('miliequivalentes por litro', 'mEq/l'),
  U('milimoles por litro', 'mmol/l'),
  U('miligramos por decilitro', 'mg/dl'),
  U('gramos por decilitro', 'g/dl'),
  U('milimetros de mercurio', 'mmHg'),
  U('centimetros de agua', 'cmH2O'),
  U('por ciento', '%'),
  U('mililitros', 'ml'),
  U('mililitro', 'ml'),
  U('miligramos', 'mg'),
  U('miligramo', 'mg'),
  U('microgramos', 'mcg'),
  U('microgramo', 'mcg'),
  U('gramos', 'g'),
  U('gramo', 'g'),
  U('milimetros', 'mm'),
  U('milimetro', 'mm'),
  U('centimetros', 'cm'),
  U('centimetro', 'cm'),
  U('kilogramos', 'kg'),
  U('kilos', 'kg'),
  U('miliequivalentes', 'mEq'),
];

// ---------- Marcas para revisión (la app no las borra) ----------

/** Frases que Whisper suele "alucinar" en español sobre silencio o ruido. */
export const FRASES_ALUCINADAS = [
  'subtitulos realizados por la comunidad de amara.org',
  'subtitulos por la comunidad de amara.org',
  'amara.org',
  'gracias por ver el video',
  'gracias por ver',
  'suscribete al canal',
  'suscribete',
  'no olvides suscribirte',
  'dale like',
  'subtitulado por',
  'transcripcion realizada por',
];
