// Descarga los archivos de modelo listados en modelos.json y verifica su SHA-256.
//
//   node scripts/obtener-modelos.mjs                    → ronda actual, desde el Release del repo
//   node scripts/obtener-modelos.mjs --ronda ronda-1-bis
//   node scripts/obtener-modelos.mjs --solo tjs-base-wasm,tjs-base-webgpu
//   node scripts/obtener-modelos.mjs --desde-hf --todas --plano dir/   (para publicar el Release)
//
// En tiempo de ejecución la app nunca descarga de terceros: los modelos se sirven
// desde el mismo origen (GitHub Pages). Este script corre solo en el build.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifiesto = JSON.parse(readFileSync(resolve(raiz, 'modelos.json'), 'utf8'));
const REPO_GITHUB = 'Oscarfr88/pase-guardia';
const SUFIJO = { fp32: '', fp16: '_fp16', q8: '_quantized', int8: '_int8', q4: '_q4' };

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes(n);
const ronda = opt('--ronda') ?? manifiesto.rondaActual;
const solo = opt('--solo')?.split(',');
const plano = opt('--plano');
const destino = resolve(raiz, plano ?? opt('--destino') ?? 'public/modelos');
const desdeHF = flag('--desde-hf');

export function archivosDeConfig(c) {
  if (c.motor === 'whispercpp') return manifiesto.archivos.filter((a) => a.ruta === `${c.carpeta}/${c.archivo}`);
  const onnx = [`onnx/encoder_model${SUFIJO[c.dtype.encoder_model]}.onnx`, `onnx/decoder_model_merged${SUFIJO[c.dtype.decoder_model_merged]}.onnx`];
  return manifiesto.archivos.filter((a) => a.ruta.startsWith(`${c.carpeta}/`) && (!a.archivo.startsWith('onnx/') || onnx.includes(a.archivo)));
}

const configs = manifiesto.configuraciones.filter((c) => (flag('--todas') || c.rondas.includes(ronda)) && (!solo || solo.includes(c.id)));
if (!configs.length) throw new Error('No hay configuraciones para descargar.');
const archivos = [...new Map(configs.flatMap(archivosDeConfig).map((a) => [a.ruta, a])).values()];
const nombreAsset = (a) => a.ruta.replaceAll('/', '__');

async function sha256DeArchivo(ruta) {
  const h = createHash('sha256');
  await pipeline(createReadStream(ruta), new Transform({ transform(ch, _e, cb) { h.update(ch); cb(); } }));
  return h.digest('hex');
}

let total = 0;
for (const a of archivos) {
  const salida = resolve(destino, plano ? nombreAsset(a) : a.ruta);
  if (existsSync(salida) && statSync(salida).size === a.bytes && (await sha256DeArchivo(salida)) === a.sha256) {
    total += a.bytes;
    continue;
  }
  const url = desdeHF
    ? `https://huggingface.co/${a.repo}/resolve/${a.revision}/${a.archivo}`
    : `https://github.com/${REPO_GITHUB}/releases/download/${manifiesto.release}/${nombreAsset(a)}`;
  mkdirSync(dirname(salida), { recursive: true });
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`No se pudo descargar ${url} (${r.status})`);
  const h = createHash('sha256');
  await pipeline(Readable.fromWeb(r.body), new Transform({ transform(ch, _e, cb) { h.update(ch); cb(null, ch); } }), createWriteStream(salida));
  const sha = h.digest('hex');
  if (sha !== a.sha256) {
    rmSync(salida);
    throw new Error(`SHA-256 incorrecto en ${a.ruta}: esperado ${a.sha256}, obtenido ${sha}`);
  }
  total += a.bytes;
  console.log(`✔ ${a.ruta} (${(a.bytes / 1e6).toFixed(1)} MB)`);
}
console.log(`✔ ${archivos.length} archivos verificados (${(total / 1e6).toFixed(1)} MB) en ${destino}`);
