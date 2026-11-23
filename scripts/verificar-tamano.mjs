// Falla si el sitio publicado supera el margen de seguridad respecto del límite
// de 1 GB de GitHub Pages.
import { readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIMITE = 950 * 1e6;
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
let total = 0;
const grandes = [];
(function recorrer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) recorrer(p);
    else {
      const b = statSync(p).size;
      total += b;
      if (b > 20e6) grandes.push([p.slice(dist.length + 1), b]);
    }
  }
})(dist);
for (const [p, b] of grandes.sort((a, b) => b[1] - a[1])) console.log(`  ${(b / 1e6).toFixed(1).padStart(7)} MB  ${p}`);
console.log(`Tamaño del sitio: ${(total / 1e6).toFixed(1)} MB (límite de seguridad ${LIMITE / 1e6} MB; GitHub Pages: 1 GB)`);
if (total > LIMITE) {
  console.error('✘ El sitio supera el límite de seguridad.');
  process.exit(1);
}
