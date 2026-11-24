import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ArrowLeft, CheckCircle2, Cpu, Download, FileAudio, HardDriveDownload, Moon, Play, Share2, Square, Sun, Trash2, TriangleAlert, XCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Boton } from '../components/ui/Boton';
import { useBench, type ModoPrompt } from '../context/BenchContext';
import base from '../data/diccionario-base.json';
import type { Diccionario } from '../types';
import { terminosParaSesgo } from '../utils/diccionario';
import { configsDeLaRonda, MANIFIESTO, megabytesDeConfig } from '../utils/modelos';
import { compilarDiccionario } from '../utils/postproceso';
import { useTema } from '../utils/tema';
import { CRIBADO, idDeArchivo, TODOS } from './dictados';
import { detectarEntorno, hilosRecomendados, type Entorno } from './entorno';
import { ejecutarEvaluacion, probarCarga } from './ejecutor';
import { num, pct, resumir } from './resumen';

const diccionario = base as Diccionario;
const indice = compilarDiccionario(diccionario);
const sesgo = terminosParaSesgo(diccionario);
const CONFIGS = configsDeLaRonda();

function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function BenchApp() {
  const [oscuro, alternarTema] = useTema();
  const { estado, dispatch } = useBench();
  const [entorno, setEntorno] = useState<Entorno | null>(null);
  const cancelar = useRef(false);

  useEffect(() => {
    detectarEntorno().then(setEntorno);
  }, []);

  const resumen = useMemo(() => resumir(estado.resultados, estado.cargas), [estado.resultados, estado.cargas]);
  const conAudio = estado.seleccionDictados.filter((id) => estado.audios[id]);
  const configsElegidas = CONFIGS.filter((c) => estado.seleccionConfigs.includes(c.id));

  function elegirAudios(e: ChangeEvent<HTMLInputElement>) {
    const archivos: Record<string, File> = {};
    for (const f of Array.from(e.target.files ?? [])) {
      const id = idDeArchivo(f.name);
      if (id) archivos[id] = f;
    }
    dispatch({ tipo: 'audios', archivos });
    e.target.value = '';
  }

  async function ejecutar() {
    cancelar.current = false;
    await ejecutarEvaluacion({
      configs: configsElegidas,
      dictados: conAudio,
      audios: estado.audios,
      modoPrompt: estado.modoPrompt,
      terminosSesgo: sesgo,
      indice,
      dispatch,
      cancelado: () => cancelar.current,
    });
  }

  function exportar(compartir: boolean) {
    const fecha = new Date().toISOString().slice(0, 16).replace(':', '');
    const nombre = `bench-${MANIFIESTO.rondaActual}-${fecha}.json`;
    const json = JSON.stringify(
      { formato: 'pase-guardia/bench', version: 1, fecha: new Date().toISOString(), ronda: MANIFIESTO.rondaActual, entorno, resumen, cargas: estado.cargas, resultados: estado.resultados },
      null,
      2,
    );
    const archivo = new File([json], nombre, { type: 'application/json' });
    if (compartir && navigator.canShare?.({ files: [archivo] })) {
      navigator.share({ files: [archivo], title: nombre }).catch(() => undefined);
    } else descargar(nombre, json);
  }

  const etiqueta = (id: string) => CONFIGS.find((c) => c.id === id)?.etiqueta ?? id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-100 to-clinical-50 text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <a href={import.meta.env.BASE_URL} className="inline-flex min-h-12 items-center gap-2 text-sm font-medium text-clinical-700 dark:text-clinical-300">
            <ArrowLeft size={18} /> Inicio
          </a>
          <h1 className="text-[16px] font-bold tracking-tight">Evaluación de motores</h1>
          <button type="button" onClick={alternarTema} aria-label="Cambiar tema" className="grid min-h-12 min-w-12 place-items-center rounded-xl border border-slate-300/80 dark:border-slate-600/80">
            {oscuro ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 shrink-0" size={20} />
          <p>
            Usá solo los <strong>dictados sintéticos</strong>. Los audios se procesan en este dispositivo y no se envían a
            ningún lado. Durante la prueba mantené la pantalla encendida y esta página en primer plano.
          </p>
        </div>

        <Card title="Este dispositivo" subtitle={`Ronda ${MANIFIESTO.rondaActual}`}>
          {!entorno ? (
            <p className="text-sm text-slate-500">Detectando…</p>
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
              <Dato k="WebGPU" v={entorno.webgpu.disponible ? `sí · ${entorno.webgpu.adaptador}` : `no${entorno.webgpu.error ? ` (${entorno.webgpu.error})` : ''}`} />
              <Dato k="shader-f16" v={entorno.webgpu.disponible ? (entorno.webgpu.f16 ? 'sí' : 'no') : '—'} />
              <Dato k="Hilos WASM" v={`${hilosRecomendados()} de ${entorno.nucleos} núcleos${entorno.aisladoOrigen ? '' : ' (sin aislamiento: 1 hilo)'}`} />
              <Dato k="Memoria" v={entorno.memoriaGB ? `${entorno.memoriaGB} GB (aprox.)` : 'no informada'} />
              <Dato k="Almacenamiento" v={entorno.almacenamiento ? `${entorno.almacenamiento.usoMB} de ${entorno.almacenamiento.cuotaMB} MB` : '—'} />
              <Dato k="Navegador" v={entorno.agente} pequeño />
            </dl>
          )}
        </Card>

        <Card title="1. Audios de los dictados" subtitle="Nombres dictado-01 … dictado-20 (wav o m4a)">
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-clinical-600 px-4 font-semibold text-white hover:bg-clinical-700">
            <FileAudio size={18} /> Elegir audios
            <input type="file" accept="audio/*,.m4a,.wav,.mp3" multiple className="hidden" onChange={elegirAudios} />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => dispatch({ tipo: 'seleccionarDictados', ids: CRIBADO })}>Cribado (5)</Boton>
            <Boton variante="secundario" onClick={() => dispatch({ tipo: 'seleccionarDictados', ids: TODOS })}>Los 20</Boton>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
            {TODOS.map((id) => {
              const elegido = estado.seleccionDictados.includes(id);
              const tiene = Boolean(estado.audios[id]);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => dispatch({ tipo: 'alternarDictado', id })}
                  className={`min-h-12 rounded-xl border text-sm font-semibold ${elegido ? 'border-clinical-500 bg-clinical-50 text-clinical-800 dark:bg-clinical-500/15 dark:text-clinical-200' : 'border-slate-300 text-slate-400 dark:border-slate-700'}`}
                  aria-pressed={elegido}
                >
                  {id}
                  <span className={`block text-[10px] ${tiene ? 'text-emerald-600' : 'text-slate-400'}`}>{tiene ? 'audio ✓' : 'sin audio'}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Seleccionados con audio: {conAudio.length} de {estado.seleccionDictados.length}.
          </p>
        </Card>

        <Card title="2. Configuraciones" subtitle="Se cargan de a una; cada modelo se descarga desde este mismo sitio">
          <div className="space-y-2">
            {CONFIGS.map((c) => {
              const sinGPU = c.dispositivo === 'webgpu' && entorno !== null && !entorno.webgpu.disponible;
              return (
                <label key={c.id} className={`flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 ${sinGPU ? 'opacity-50' : ''}`}>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-clinical-600"
                    checked={estado.seleccionConfigs.includes(c.id)}
                    disabled={sinGPU}
                    onChange={() => dispatch({ tipo: 'alternarConfig', id: c.id })}
                  />
                  <Cpu size={16} className="shrink-0 text-slate-400" />
                  <span className="flex-1 text-sm">{c.etiqueta}</span>
                  <span className="text-xs text-slate-500">{num(megabytesDeConfig(c), 0)} MB</span>
                </label>
              );
            })}
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Prompt con el diccionario ({sesgo.length} términos con sesgo)</p>
            <div className="inline-flex overflow-hidden rounded-xl border border-slate-300 dark:border-slate-600">
              {(['con', 'sin', 'ambos'] as ModoPrompt[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => dispatch({ tipo: 'modoPrompt', modo: m })}
                  className={`min-h-12 px-4 text-sm font-medium ${estado.modoPrompt === m ? 'bg-clinical-600 text-white' : ''}`}
                  aria-pressed={estado.modoPrompt === m}
                >
                  {m === 'con' ? 'Con' : m === 'sin' ? 'Sin' : 'Ambos'}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card title="3. Ejecutar">
          <div className="flex flex-wrap gap-2">
            {!estado.ejecutando ? (
              <>
                <Boton icono={<Play size={18} />} disabled={!conAudio.length || !configsElegidas.length} onClick={ejecutar}>
                  Iniciar ({configsElegidas.length} config. × {conAudio.length} dictados)
                </Boton>
                <Boton
                  variante="secundario"
                  icono={<HardDriveDownload size={18} />}
                  disabled={!configsElegidas.length}
                  onClick={() => {
                    cancelar.current = false;
                    void probarCarga(configsElegidas, dispatch, () => cancelar.current);
                  }}
                >
                  Probar solo la carga
                </Boton>
              </>
            ) : (
              <Boton variante="peligro" icono={<Square size={18} />} onClick={() => (cancelar.current = true)}>
                Detener después del actual
              </Boton>
            )}
          </div>
          {estado.progreso && <p className="mt-3 font-mono text-xs text-slate-600 dark:text-slate-300">{estado.progreso}</p>}
          {estado.cargas.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {estado.cargas.map((c) => (
                <li key={c.configId} className="flex items-start gap-2">
                  {c.error ? <XCircle size={16} className="mt-0.5 shrink-0 text-rose-600" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />}
                  <span>
                    {etiqueta(c.configId)}:{' '}
                    {c.error ? <span className="text-rose-600">{c.error}</span> : <>cargó en {num((c.ms ?? 0) / 1000)} s ({c.backend})</>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Resultados" subtitle="WER ponderado por palabras · términos médicos escritos correctamente">
          <p className="mb-3 text-xs text-slate-500">
            <strong>Modelo</strong>: salida cruda de Whisper contra el texto literal leído. <strong>Final</strong>: después del
            post-proceso (diccionario, puntuación dictada, unidades) contra el texto esperado. En los dictados con
            puntuación hablada las referencias difieren, así que las dos columnas no se restan.
          </p>
          {!resumen.length ? (
            <p className="text-sm text-slate-500">Todavía no hay resultados.</p>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Configuración</th>
                    <th className="px-2">Prompt</th>
                    <th className="px-2">Carga</th>
                    <th className="px-2">WER modelo</th>
                    <th className="px-2">WER final</th>
                    <th className="px-2">Términos modelo</th>
                    <th className="px-2">Términos final</th>
                    <th className="px-2">s / min audio</th>
                    <th className="px-2">n</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map((f) => (
                    <tr key={`${f.configId}-${f.conPrompt}`} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-2 py-2">{etiqueta(f.configId)}<span className="block text-[11px] text-slate-500">{f.backend}</span></td>
                      <td className="px-2">{f.conPrompt ? 'con' : 'sin'}</td>
                      <td className="px-2">{num(f.cargaS)} s</td>
                      <td className="px-2">{pct(f.werCrudo)}</td>
                      <td className="px-2 font-semibold">{pct(f.werPost)}</td>
                      <td className="px-2">{pct(f.terminosCrudo)}</td>
                      <td className="px-2 font-semibold">{pct(f.terminosPost)}</td>
                      <td className="px-2">{num(f.segundosPorMinuto)}</td>
                      <td className="px-2">{f.dictados}{f.fallos ? <span className="text-rose-600"> +{f.fallos} fallo(s)</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Boton variante="secundario" icono={<Download size={18} />} disabled={!estado.resultados.length} onClick={() => exportar(false)}>Descargar JSON</Boton>
            <Boton variante="secundario" icono={<Share2 size={18} />} disabled={!estado.resultados.length} onClick={() => exportar(true)}>Compartir</Boton>
            <Boton variante="secundario" icono={<Trash2 size={18} />} disabled={!estado.resultados.length || estado.ejecutando} onClick={() => confirm('¿Borrar todos los resultados?') && dispatch({ tipo: 'borrarResultados' })}>Borrar</Boton>
          </div>
        </Card>

        {estado.resultados.length > 0 && (
          <Card title="Detalle por dictado">
            <div className="space-y-2">
              {[...estado.resultados].sort((a, b) => a.dictadoId.localeCompare(b.dictadoId) || a.configId.localeCompare(b.configId)).map((r) => (
                <details key={`${r.configId}-${r.dictadoId}-${r.conPrompt}`} className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <summary className="cursor-pointer text-sm">
                    <strong>{r.dictadoId}</strong> · {etiqueta(r.configId)} · {r.conPrompt ? 'con' : 'sin'} prompt ·{' '}
                    {r.error ? <span className="text-rose-600">{r.error}</span> : <>WER final {pct(r.werPost!.wer)} · términos {r.terminosPost!.aciertos}/{r.terminosPost!.total} · {num(r.ms / 1000)} s{r.reintentos ? ` · ${r.reintentos} reintento(s) por bucle` : ''}</>}
                  </summary>
                  {!r.error && (
                    <div className="mt-2 space-y-2 text-sm">
                      <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">{r.textoPost}</p>
                      {r.terminosPost!.faltantes.length > 0 && <p className="text-xs text-rose-600">Términos no reconocidos: {r.terminosPost!.faltantes.join(', ')}</p>}
                      {r.marcas!.length > 0 && <p className="text-xs text-amber-600">Marcas: {r.marcas!.map((m) => `${m.tipo} (${m.texto})`).join(' · ')}</p>}
                    </div>
                  )}
                </details>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

function Dato({ k, v, pequeño }: { k: string; v: string; pequeño?: boolean }) {
  return (
    <div className={pequeño ? 'sm:col-span-2' : ''}>
      <dt className="inline font-medium">{k}: </dt>
      <dd className={`inline ${pequeño ? 'break-all text-xs text-slate-500' : ''}`}>{v}</dd>
    </div>
  );
}
