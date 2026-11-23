// Genera modelos.json: qué archivos de modelo se usan, de qué revisión exacta de
// Hugging Face salen y su SHA-256. Se corre a mano cuando se cambia un modelo.
// Los .onnx (LFS) traen su SHA-256 en la API; los JSON chicos se descargan y se hashean.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const REPOS = {
  'whisper-tiny': 'onnx-community/whisper-tiny',
  'whisper-base': 'onnx-community/whisper-base',
  'whisper-small': 'onnx-community/whisper-small',
};
const SUFIJO = { fp32: '', fp16: '_fp16', q8: '_quantized', int8: '_int8', q4: '_q4' };
const JSONS = ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json'];

const C = (id, etiqueta, dispositivo, modelo, enc, dec, rondas) => ({
  id, etiqueta, motor: 'transformers', dispositivo, modelo, carpeta: `whisper-${modelo}`,
  dtype: { encoder_model: enc, decoder_model_merged: dec }, rondas,
});
const configuraciones = [
  C('tjs-tiny-wasm', 'Transformers.js · WASM · tiny (q8)', 'wasm', 'tiny', 'q8', 'q8', ['ronda-1']),
  C('tjs-base-wasm', 'Transformers.js · WASM · base (q8)', 'wasm', 'base', 'q8', 'q8', ['ronda-1']),
  C('tjs-tiny-webgpu', 'Transformers.js · WebGPU · tiny (fp16 + q4)', 'webgpu', 'tiny', 'fp16', 'q4', ['ronda-1']),
  C('tjs-base-webgpu', 'Transformers.js · WebGPU · base (fp16 + q4)', 'webgpu', 'base', 'fp16', 'q4', ['ronda-1']),
  C('tjs-small-webgpu', 'Transformers.js · WebGPU · small (fp16 + q4)', 'webgpu', 'small', 'fp16', 'q4', ['ronda-1']),
  C('tjs-small-wasm', 'Transformers.js · WASM · small (q8)', 'wasm', 'small', 'q8', 'q8', ['ronda-1-bis']),
];

async function api(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

const archivos = new Map();
for (const [carpeta, repo] of Object.entries(REPOS)) {
  const info = await api(`https://huggingface.co/api/models/${repo}`);
  const revision = info.sha;
  const arbol = [
    ...(await api(`https://huggingface.co/api/models/${repo}/tree/${revision}`)),
    ...(await api(`https://huggingface.co/api/models/${repo}/tree/${revision}/onnx`)),
  ];
  const porRuta = new Map(arbol.map((x) => [x.path, x]));
  const necesarios = new Set(JSONS);
  for (const c of configuraciones.filter((c) => c.carpeta === carpeta)) {
    necesarios.add(`onnx/encoder_model${SUFIJO[c.dtype.encoder_model]}.onnx`);
    necesarios.add(`onnx/decoder_model_merged${SUFIJO[c.dtype.decoder_model_merged]}.onnx`);
  }
  for (const archivo of necesarios) {
    const x = porRuta.get(archivo);
    if (!x) throw new Error(`No existe ${repo}/${archivo}`);
    let sha256 = x.lfs?.oid;
    if (!sha256) {
      const r = await fetch(`https://huggingface.co/${repo}/resolve/${revision}/${archivo}`);
      sha256 = createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');
    }
    archivos.set(`${carpeta}/${archivo}`, { ruta: `${carpeta}/${archivo}`, repo, archivo, revision, sha256, bytes: x.lfs?.size ?? x.size });
  }
  console.log(`✔ ${repo} @ ${revision.slice(0, 10)}`);
}

const manifiesto = {
  rondaActual: 'ronda-1',
  release: 'modelos-v1',
  licencias: {
    'Whisper (OpenAI)': 'MIT (repositorio openai/whisper); Apache-2.0 (tarjeta del modelo en Hugging Face)',
    'Conversión ONNX (onnx-community)': 'Sin licencia propia declarada; hereda la del modelo original',
  },
  configuraciones,
  archivos: [...archivos.values()].sort((a, b) => a.ruta.localeCompare(b.ruta)),
};
writeFileSync(new URL('../modelos.json', import.meta.url), JSON.stringify(manifiesto, null, 2) + '\n');
const mb = (b) => (b / 1e6).toFixed(1);
for (const r of ['ronda-1', 'ronda-1-bis']) {
  const rutas = new Set();
  for (const c of configuraciones.filter((c) => c.rondas.includes(r))) {
    for (const a of manifiesto.archivos.filter((a) => a.ruta.startsWith(c.carpeta + '/') && (!a.ruta.includes('/onnx/') ||
      a.ruta.endsWith(`encoder_model${SUFIJO[c.dtype.encoder_model]}.onnx`) || a.ruta.endsWith(`decoder_model_merged${SUFIJO[c.dtype.decoder_model_merged]}.onnx`)))) rutas.add(a.ruta);
  }
  const total = manifiesto.archivos.filter((a) => rutas.has(a.ruta)).reduce((s, a) => s + a.bytes, 0);
  console.log(`${r}: ${rutas.size} archivos, ${mb(total)} MB`);
}
