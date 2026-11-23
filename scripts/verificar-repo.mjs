// Falla si en el repositorio se versionó algún archivo prohibido: audios, documentos
// exportados, bases locales, modelos o archivos de entorno.
import { execSync } from 'node:child_process';

const PROHIBIDOS = /\.(wav|wave|mp3|m4a|mp4|aac|ogg|oga|opus|webm|flac|caf|aiff?|amr|3gp|pcm|raw|docx?|odt|rtf|pdf|db|sqlite3?|idb|leveldb|ldb|har|onnx|onnx_data|ort|bin|gguf|ggml|safetensors|pt|tflite)$|(^|\/)\.env(\.|$)/i;
const archivos = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
const malos = archivos.filter((f) => PROHIBIDOS.test(f) && !f.endsWith('.env.example'));
if (malos.length) {
  console.error('✘ Archivos que no deben estar en el repositorio:\n' + malos.map((m) => '  ' + m).join('\n'));
  process.exit(1);
}
console.log(`✔ ${archivos.length} archivos versionados, ninguno prohibido.`);
