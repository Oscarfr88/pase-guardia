// ============================================================
// Tipos centrales del Pase de Guardia UTI
// ============================================================

// ---------- Diccionario personalizado ----------

export type CategoriaTermino =
  | 'farmacos'
  | 'escalas'
  | 'ventilacion'
  | 'gasometria_laboratorio'
  | 'ecografia_pocus'
  | 'microbiologia'
  | 'procedimientos'
  | 'dispositivos_vias'
  | 'abreviaturas'
  | 'diagnosticos_sindromes'
  | 'otros';

export type OrigenTermino = 'base' | 'usuario';

export interface Termino {
  id: string;
  /** Forma correcta, tal como debe quedar escrita. */
  termino: string;
  /** Formas incorrectas o alternativas que se reemplazan por `termino`. */
  variantes: string[];
  categoria: CategoriaTermino;
  origen: OrigenTermino;
  /** Si se incluye en el prompt de sesgo del modelo de transcripción. */
  sesgo: boolean;
  /** Aclaración opcional (p. ej., una variante ambigua). */
  nota?: string;
}

export interface Diccionario {
  formato: 'pase-guardia/diccionario';
  version: number;
  terminos: Termino[];
}

// ---------- Post-procesamiento ----------

export type TipoCambio = 'diccionario' | 'puntuacion' | 'decimal' | 'unidad';

/** Cada modificación automática queda registrada para resaltarla en la revisión. */
export interface Cambio {
  tipo: TipoCambio;
  desde: string;
  hacia: string;
}

export type TipoMarca = 'alucinacion' | 'repeticion' | 'ambiguo';

/** Fragmentos que la app no modifica pero señala para que el médico los revise. */
export interface Marca {
  tipo: TipoMarca;
  texto: string;
  motivo: string;
}

export interface OpcionesPostproceso {
  /** Convierte "punto y aparte", "coma", "dos puntos"… en signos. */
  puntuacionDictada: boolean;
  /** 0.35 → 0,35 (solo cuando no es ambiguo). */
  comaDecimal: boolean;
  /** "30 mililitros por kilo" → "30 ml/kg" (solo después de un número). */
  abreviarUnidades: boolean;
}

export interface ResultadoPostproceso {
  texto: string;
  cambios: Cambio[];
  marcas: Marca[];
}

// ---------- Motor de transcripción ----------

export type IdMotor = 'transformers' | 'whispercpp';
export type Dispositivo = 'webgpu' | 'wasm';
export type TamanoModelo = 'tiny' | 'base' | 'small';

export interface ConfigMotor {
  id: string;
  etiqueta: string;
  motor: IdMotor;
  dispositivo: Dispositivo;
  modelo: TamanoModelo;
  /** Carpeta del modelo dentro de /modelos/. */
  carpeta: string;
  /** Transformers.js: precisión de cada parte del modelo ONNX. */
  dtype?: { encoder_model: string; decoder_model_merged: string };
  /** whisper.cpp: archivo único del modelo (formato ggml) dentro de la carpeta. */
  archivo?: string;
  rondas: string[];
}

export interface ArchivoModelo {
  ruta: string; // relativa a /modelos/
  repo: string;
  archivo: string;
  revision: string;
  sha256: string;
  bytes: number;
}

export interface ManifiestoModelos {
  rondaActual: string;
  release: string;
  licencias: Record<string, string>;
  configuraciones: ConfigMotor[];
  archivos: ArchivoModelo[];
}

export interface Segmento {
  inicio: number; // segundos
  fin: number;
  texto: string;
}

export interface ResultadoTranscripcion {
  texto: string;
  segmentos: Segmento[];
  ms: number;
  tokensPrompt: number;
  /** Tramos que se reintentaron por bucle de repetición. */
  reintentos: number;
}

// Mensajes entre la página y el worker de transcripción
export type MensajeAlWorker =
  | { tipo: 'cargar'; config: ConfigMotor; base: string; hilos: number }
  | { tipo: 'transcribir'; id: string; audio: Float32Array; terminosSesgo: string[] }
  | { tipo: 'liberar' };

export type MensajeDelWorker =
  | { tipo: 'progreso'; archivo: string; cargado: number; total: number }
  | { tipo: 'listo'; ms: number; backend: string }
  | { tipo: 'avance'; id: string; segmento: number; total: number }
  | { tipo: 'resultado'; id: string; resultado: ResultadoTranscripcion }
  | { tipo: 'error'; id?: string; mensaje: string };
