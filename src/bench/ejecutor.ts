// Corre la evaluación: una configuración a la vez (un worker por configuración,
// que se termina al final para liberar la memoria del modelo).
import type { Dispatch } from 'react';
import type { AccionBench, ItemResultado, ModoPrompt } from '../context/BenchContext';
import type { ConfigMotor } from '../types';
import { decodificarAudio, FRECUENCIA } from '../utils/audio';
import { aciertoTerminos, werDeTextos } from '../utils/metricas';
import { postprocesar, type IndiceDiccionario } from '../utils/postproceso';
import { ClienteASR } from './clienteASR';
import { REFERENCIAS } from './dictados';
import { hilosRecomendados } from './entorno';

interface Parametros {
  configs: ConfigMotor[];
  dictados: string[];
  audios: Record<string, File>;
  modoPrompt: ModoPrompt;
  terminosSesgo: string[];
  indice: IndiceDiccionario;
  dispatch: Dispatch<AccionBench>;
  cancelado: () => boolean;
}

export async function ejecutarEvaluacion(p: Parametros): Promise<void> {
  const { dispatch } = p;
  const base = new URL(import.meta.env.BASE_URL, location.origin).href;
  const hilos = hilosRecomendados();
  const modos = p.modoPrompt === 'ambos' ? [true, false] : [p.modoPrompt === 'con'];
  dispatch({ tipo: 'inicio' });

  let bloqueo: WakeLockSentinel | null = null;
  try {
    bloqueo = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    /* sin Wake Lock: hay que mantener la pantalla encendida a mano */
  }

  try {
    const audios = new Map<string, Float32Array>();
    for (const id of p.dictados) {
      dispatch({ tipo: 'progreso', texto: `Decodificando dictado ${id}…` });
      audios.set(id, await decodificarAudio(await p.audios[id].arrayBuffer()));
    }

    for (const config of p.configs) {
      if (p.cancelado()) break;
      const cliente = new ClienteASR();
      cliente.onProgreso = (archivo, cargado, total) =>
        dispatch({
          tipo: 'progreso',
          texto: `${config.etiqueta}: cargando ${archivo.split('/').pop()} ${total ? Math.round((100 * cargado) / total) : 0} %`,
        });
      try {
        dispatch({ tipo: 'progreso', texto: `${config.etiqueta}: cargando el modelo…` });
        const { ms, backend } = await cliente.cargar(config, base, hilos);
        dispatch({ tipo: 'carga', carga: { configId: config.id, ms, backend } });
      } catch (err) {
        dispatch({ tipo: 'carga', carga: { configId: config.id, error: String((err as Error).message ?? err) } });
        cliente.terminar();
        continue;
      }

      for (const id of p.dictados) {
        for (const conPrompt of modos) {
          if (p.cancelado()) break;
          const ref = REFERENCIAS[id];
          const audio = audios.get(id)!;
          const base: ItemResultado = { configId: config.id, dictadoId: id, conPrompt, duracionAudio: audio.length / FRECUENCIA, ms: 0, tokensPrompt: 0 };
          dispatch({ tipo: 'enCurso', valor: { configId: config.id, dictadoId: id, conPrompt } });
          cliente.onAvance = (seg, total) =>
            dispatch({ tipo: 'progreso', texto: `${config.etiqueta} · dictado ${id} · ${conPrompt ? 'con' : 'sin'} diccionario · tramo ${seg}/${total}` });
          let item: ItemResultado;
          try {
            const r = await cliente.transcribir(`${config.id}-${id}-${conPrompt}`, audio.slice(), conPrompt ? p.terminosSesgo : []);
            const post = postprocesar(r.texto, p.indice);
            item = {
              ...base,
              ms: r.ms,
              tokensPrompt: r.tokensPrompt,
              reintentos: r.reintentos,
              textoCrudo: r.texto,
              textoPost: post.texto,
              cambios: post.cambios.length,
              marcas: post.marcas,
              werCrudo: werDeTextos(ref.literal, r.texto),
              werPost: werDeTextos(ref.esperado ?? ref.literal, post.texto),
              terminosCrudo: aciertoTerminos(ref.terminos, r.texto),
              terminosPost: aciertoTerminos(ref.terminos, post.texto),
            };
          } catch (err) {
            item = { ...base, error: String((err as Error).message ?? err) };
          }
          dispatch({ tipo: 'resultado', item });
          dispatch({ tipo: 'enCurso', valor: null });
        }
      }
      cliente.terminar();
    }
  } finally {
    await bloqueo?.release().catch(() => undefined);
    dispatch({ tipo: 'fin' });
  }
}

/** Solo descarga y carga cada modelo (sin audio): sirve para diagnosticar el dispositivo. */
export async function probarCarga(configs: ConfigMotor[], dispatch: Dispatch<AccionBench>, cancelado: () => boolean): Promise<void> {
  const base = new URL(import.meta.env.BASE_URL, location.origin).href;
  const hilos = hilosRecomendados();
  dispatch({ tipo: 'inicio' });
  let bloqueo: WakeLockSentinel | null = null;
  try {
    bloqueo = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    /* sin Wake Lock */
  }
  try {
    for (const config of configs) {
      if (cancelado()) break;
      const cliente = new ClienteASR();
      cliente.onProgreso = (archivo, cargado, total) =>
        dispatch({
          tipo: 'progreso',
          texto: `${config.etiqueta}: ${archivo.split('/').pop()} ${total ? Math.round((100 * cargado) / total) : 0} % (${(cargado / 1e6).toFixed(0)} de ${(total / 1e6).toFixed(0)} MB)`,
        });
      try {
        const { ms, backend } = await cliente.cargar(config, base, hilos);
        dispatch({ tipo: 'carga', carga: { configId: config.id, ms, backend } });
      } catch (err) {
        dispatch({ tipo: 'carga', carga: { configId: config.id, error: String((err as Error).message ?? err) } });
      }
      cliente.terminar();
    }
  } finally {
    await bloqueo?.release().catch(() => undefined);
    dispatch({ tipo: 'fin' });
  }
}
