// Lectura del manifiesto de modelos (modelos.json, en la raíz del repo).
import manifiesto from '../../modelos.json';
import type { ArchivoModelo, ConfigMotor, ManifiestoModelos } from '../types';

export const MANIFIESTO = manifiesto as ManifiestoModelos;

const SUFIJO: Record<string, string> = { fp32: '', fp16: '_fp16', q8: '_quantized', int8: '_int8', q4: '_q4' };

export function archivosDeConfig(c: ConfigMotor): ArchivoModelo[] {
  const onnx = [
    `onnx/encoder_model${SUFIJO[c.dtype.encoder_model]}.onnx`,
    `onnx/decoder_model_merged${SUFIJO[c.dtype.decoder_model_merged]}.onnx`,
  ];
  return MANIFIESTO.archivos.filter(
    (a) => a.ruta.startsWith(`${c.carpeta}/`) && (!a.archivo.startsWith('onnx/') || onnx.includes(a.archivo)),
  );
}

export function megabytesDeConfig(c: ConfigMotor): number {
  return archivosDeConfig(c).reduce((s, a) => s + a.bytes, 0) / 1e6;
}

/** Configuraciones cuyos archivos están publicados en este despliegue (ronda actual). */
export function configsDeLaRonda(): ConfigMotor[] {
  return MANIFIESTO.configuraciones.filter((c) => c.rondas.includes(MANIFIESTO.rondaActual));
}
