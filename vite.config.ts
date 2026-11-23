import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

// base '/pase-guardia/' → GitHub Pages project site (oscarfr88.github.io/pase-guardia).
const BASE = '/pase-guardia/';

// Política de seguridad de contenido. GitHub Pages no permite enviar encabezados HTTP,
// así que va como <meta>. Solo en el build: el servidor de desarrollo usa scripts inline.
// connect-src 'self' impide técnicamente cualquier conexión fuera del propio origen.
export const CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self'",
  "font-src 'self'",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

function csp(): Plugin {
  return {
    name: 'pase-guardia:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    csp(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false, // se registra a mano en utils/registroSW.ts (aislamiento de origen)
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'Pase de Guardia UTI',
        short_name: 'Pase UTI',
        description:
          'Dictado y estructuración del pase de guardia en Terapia Intensiva. Todo ocurre en el dispositivo.',
        lang: 'es',
        theme_color: '#0e7490',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        scope: BASE,
        start_url: BASE,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2,wasm,webmanifest}'],
        // Los modelos tienen su propia descarga; los alfabetos que no se usan, tampoco se precachean.
        globIgnores: ['modelos/**', 'assets/inter-{cyrillic,greek,vietnamese}*'],
        maximumFileSizeToCacheInBytes: 32 * 1024 * 1024, // runtime ONNX (~27 MB)
      },
    }),
  ],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        bench: fileURLToPath(new URL('./bench/index.html', import.meta.url)),
      },
    },
  },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  server: {
    port: 5177,
    open: false,
    host: true,
    // Aislamiento de origen también en desarrollo (habilita hilos WASM).
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
