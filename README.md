# Pase de Guardia UTI — dictado y estructuración del pase

> **Estado: en desarrollo (etapa 2 de 5).** Todavía **no** se puede usar para pases reales.
> Por ahora el sitio publica la **evaluación de motores de transcripción** con dictados sintéticos.

PWA de uso **personal** para médicos de Terapia Intensiva. El médico dicta el pase de cada
paciente y la app lo transcribe **en el propio dispositivo**, lo ordena en secciones (formato
I-PASS adaptado) y lo deja listo para revisar, editar y exportar a `.docx` o a texto plano.
Reemplaza el pase manuscrito personal.

La app **no genera contenido clínico**: solo transcribe y ordena lo que el médico dictó.
Ninguna sección se completa ni se sugiere automáticamente.

No es una herramienta de ningún servicio ni institución.

---

## ⚠️ Aviso de responsabilidad

- Es una **herramienta de documentación personal**.
- **El médico es responsable de lo que firma** y de revisar cada documento antes de usarlo.
  La transcripción automática puede tener errores.
- **No reemplaza la historia clínica institucional.**
- **No fue evaluada ni registrada como producto médico** ante ANMAT ni ante ninguna otra
  autoridad regulatoria.
- Se ofrece **sin garantía de ningún tipo**. Ver el [borrador de términos de uso](TERMINOS-BORRADOR.md).

## Licencia

**Licencia propuesta: [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), pendiente de
revisión legal.**

Hasta que esa revisión concluya y se agregue el archivo `LICENSE`, **no se concede ninguna
licencia sobre este código: todos los derechos reservados.** El repositorio es público para
transparencia y auditoría. Los Términos de Servicio de GitHub permiten igualmente verlo y
bifurcarlo dentro de GitHub.

Términos de uso: [TERMINOS-BORRADOR.md](TERMINOS-BORRADOR.md) (borrador, pendiente de revisión legal).

## Privacidad (principios de diseño)

- **Sin servidor propio.** Es un sitio estático servido por GitHub Pages.
- **Todo ocurre en el navegador:** grabación, transcripción, estructuración, almacenamiento
  y exportación. El audio y el texto **nunca se envían a ningún servidor**.
- **Sin telemetría**, analítica, CDN, fuentes remotas ni verificación de licencia. La
  [política de seguridad de contenido](vite.config.ts) (`connect-src 'self'`) bloquea
  técnicamente cualquier conexión fuera del propio origen.
- **El modelo de transcripción se descarga del mismo sitio**, nunca de un tercero. El runtime
  de ONNX (que Transformers.js bajaría por defecto de un CDN) va empaquetado en el build.
- **Datos cifrados** en IndexedDB con AES-GCM. La clave se deriva de una contraseña del
  usuario (PBKDF2). **Si se pierde la contraseña, los datos no se pueden recuperar.** *(etapa 4)*
- **Sin identificadores:** los pacientes se identifican por cama o alias. No se piden nombre,
  DNI, número de historia clínica ni fecha de nacimiento.
- El service worker guarda en caché **solo la interfaz y el modelo**.
- Los `.docx` se generan en el dispositivo y se guardan solo por acción del usuario.
  Una vez exportados quedan sin cifrar, y su resguardo es responsabilidad del médico.
- Ni los dictados ni el diccionario se usan para entrenar modelos.
- Lo único que ve GitHub (el hosting) es el registro de acceso normal de cualquier sitio web
  (IP y navegador de quien descarga la app y el modelo). Por ahí no pasan datos clínicos.

## Stack

- **React 18 + TypeScript** (Vite 8)
- **Tailwind CSS 3** con modo nocturno (clase `dark`) · tipografía Inter empaquetada (sin fuentes remotas)
- **lucide-react** para iconografía
- Estado centralizado con **Context + useReducer**
- **vite-plugin-pwa** con service worker propio (`src/sw.ts`): precaché de la interfaz y
  aislamiento de origen (COOP/COEP) para usar hilos de WebAssembly en GitHub Pages
- **Whisper** con **Transformers.js 4** (ONNX Runtime Web) en un Web Worker, en **WebGPU** o
  **WebAssembly**. El motor y el tamaño de modelo se eligen midiendo en iPhone y Android
  ([informe](docs/evaluacion-motores.md)).
- **Vitest** (pruebas unitarias). *Playwright y `docx` se suman en las etapas 4 y 5.*

## Módulos

| Módulo | Contenido | Etapa |
| --- | --- | --- |
| **Transcripción** | Whisper en el dispositivo, segmentado en las pausas, sesgado con el diccionario (prompt inicial) y con reintento ante bucles de repetición. | 2 ✅ |
| **Post-proceso** | Diccionario (variante → término), puntuación dictada ("punto y aparte", "coma"…, sin tocar el "coma" clínico ni la coma decimal), unidades después de un número, coma decimal. Cada cambio queda registrado para resaltarlo en la revisión; lo dudoso se marca y no se toca. | 2 ✅ |
| **Diccionario** | ~500 términos de terapia intensiva en JSON editable; alta sin duplicados; importación y exportación. | 2 ✅ |
| **Evaluación de motores** | Página `/bench`: WER, acierto en términos médicos y tiempo por minuto de audio en el propio dispositivo. | 2 ✅ |
| **Estructuración I-PASS** | Severidad (riesgo de deterioro) · Resumen (diagnóstico y motivo de internación, antecedentes, evolución, soporte, microbiología y antibióticos, laboratorio e imágenes) · Acciones (pendientes) · Plan y contingencias. Por marcadores hablados, sin IA generativa. | 3 |
| **Turno, grabación y revisión** | Pacientes por cama o alias, varias tomas, edición y confirmación del médico. | 4 |
| **Seguridad** | Cifrado, bloqueo configurable, borrado automático de audios, borrado total. | 4 |
| **Exportación** | `.docx` editable con encabezados y tabla de pacientes; texto plano; anexo literal opcional. | 4 |

## Estructura

```
pase-guardia/
├── index.html · bench/index.html          # app y página de evaluación (CSP inyectada en el build)
├── vite.config.ts · vitest.config.ts · tailwind.config.js · tsconfig*.json
├── modelos.json                            # modelos: revisión de Hugging Face, SHA-256, tamaños, rondas
├── scripts/
│   ├── obtener-modelos.mjs                 # descarga y verifica los modelos (Release del repo o HF)
│   ├── actualizar-manifiesto.mjs           # regenera modelos.json
│   ├── verificar-tamano.mjs · verificar-repo.mjs
│   └── gen-icons.mjs
├── src/
│   ├── main.tsx · App.tsx · index.css · sw.ts
│   ├── types/index.ts
│   ├── data/      diccionario-base.json · reglasTexto.ts · categorias.ts · avisos.ts
│   ├── context/   BenchContext.tsx
│   ├── utils/     postproceso.ts · diccionario.ts · metricas.ts · audio.ts · bucles.ts · texto.ts …
│   ├── workers/   asr.worker.ts · motores/transformers.ts
│   ├── bench/     página de evaluación
│   └── components/ui/
├── tests/
│   ├── unit/                               # Vitest
│   └── fixtures/dictados/                  # 20 dictados sintéticos (solo texto)
└── docs/  PLAN.md · evaluacion-motores.md · guia-dictados-prueba.md
```

## Puesta en marcha (npm/Vite)

Requiere **Node.js 22+** (incluye npm). Verificar con `node --version`.

```bash
# 1. Instalar dependencias
npm install

# 2. Descargar los modelos (verifica el SHA-256 de cada archivo).
#    En desarrollo, desde Hugging Face en la revisión fijada; podés limitar a algunas configuraciones:
npm run modelos -- --desde-hf --solo tjs-base-wasm,tjs-base-webgpu

# 3. Pruebas
npm test

# 4. Entorno de desarrollo (http://localhost:5177/pase-guardia/)
npm run dev

# 5. Build de producción y verificación de tamaño
npm run build && node scripts/verificar-tamano.mjs
```

Los modelos (`public/modelos/`) no se versionan. En el despliegue, el workflow los toma del
Release [`modelos-v1`](../../releases/tag/modelos-v1) de este repositorio y verifica cada SHA-256.

## Evaluación de motores

1. Abrir `https://oscarfr88.github.io/pase-guardia/bench/` en el teléfono.
2. Elegir los audios `dictado-01` … `dictado-20` (ver la [guía](docs/guia-dictados-prueba.md)).
3. Elegir configuraciones y correr. Mantener la pantalla encendida.
4. Exportar el JSON de resultados (no contiene audio).

Metodología y resultados: [docs/evaluacion-motores.md](docs/evaluacion-motores.md).

## Administración del diccionario

El diccionario es un JSON (`src/data/diccionario-base.json` para la base; cada usuario tendrá el suyo):

```json
{
  "formato": "pase-guardia/diccionario",
  "version": 1,
  "terminos": [
    { "id": "b-0001", "termino": "noradrenalina", "variantes": ["nor adrenalina", "nora drenalina"],
      "categoria": "farmacos", "origen": "base", "sesgo": true }
  ]
}
```

- **`termino`**: la forma correcta. **`variantes`**: cómo lo transcribe mal el modelo.
- **Regla de oro:** una variante solo corrige un **error de reconocimiento de las mismas palabras**
  (espacios, tildes, letras deletreadas: "fi o dos" → FiO2). **Nunca** sinónimos, expansiones ni
  abreviaturas ("norepinefrina", "vena cava" → "vena cava inferior", "diabetes" → "DBT"): eso
  cambiaría lo que dijo el médico. El generador del diccionario lo verifica.
- **`sesgo`**: si el término entra en el prompt inicial del modelo (hasta ~150 tokens; primero
  los términos agregados por el usuario).
- **`categoria`**: `farmacos`, `escalas`, `ventilacion`, `gasometria_laboratorio`,
  `ecografia_pocus`, `microbiologia`, `procedimientos`, `dispositivos_vias`, `abreviaturas`,
  `diagnosticos_sindromes`, `otros`.
- Agregar una palabra que ya existe (sin importar mayúsculas ni tildes) **no la duplica**: se
  fusionan las variantes. Una variante que ya corrige otro término se rechaza.
- Las palabras nuevas se aplican **desde la siguiente transcripción**; las anteriores no cambian
  salvo pedido explícito. *(La interfaz para agregarlas desde la transcripción llega en la etapa 4.)*

## Limitaciones conocidas por dispositivo

Preliminares; se completan con las mediciones de la etapa 2.

- **iOS (Safari):**
  - WebGPU requiere iOS 26 o posterior. Sin WebGPU, la transcripción corre en WebAssembly (más lenta).
  - Con 4 GB de RAM (iPhone 13), los modelos grandes pueden exceder la memoria de Safari.
  - La grabación se detiene si se bloquea la pantalla o la app pasa a segundo plano.
  - Instalada como app, la descarga de archivos se hace por la hoja de compartir ("Guardar en Archivos").
- **Android (Chrome):** el soporte de WebGPU y su rendimiento dependen del chip gráfico.
- **Todos:**
  - La primera vez hay que descargar el modelo (decenas a cientos de MB; se recomienda Wi-Fi).
  - El primer ingreso recarga la página una vez para habilitar los hilos de WebAssembly.
  - `tiny` no es utilizable: en pruebas preliminares cae en bucles de repetición.

## Modelo de transcripción y licencias de terceros

| Componente | Licencia |
| --- | --- |
| Whisper (OpenAI), pesos `tiny`/`base`/`small` | MIT ([openai/whisper](https://github.com/openai/whisper)); Apache-2.0 en la tarjeta del modelo de Hugging Face |
| Conversión ONNX ([onnx-community](https://huggingface.co/onnx-community)) | Sin licencia propia declarada; hereda la del modelo |
| Transformers.js | Apache-2.0 |
| ONNX Runtime Web | MIT |
| React · Vite · Tailwind CSS · vite-plugin-pwa · Workbox | MIT |
| lucide-react | ISC |
| Inter (tipografía) | SIL Open Font License 1.1 |

Revisiones exactas y SHA-256 de cada archivo de modelo: [`modelos.json`](modelos.json).

## Datos de prueba

Este repositorio **no contiene ni va a contener datos reales de pacientes**. Los dictados de
evaluación son **sintéticos** ([tests/fixtures/dictados](tests/fixtures/dictados/README.md)). Sus
audios nunca se versionan: el `.gitignore` excluye audios, exportaciones, bases locales, modelos
y archivos de entorno, y el CI falla si alguno aparece en el repositorio.

## Etapas del desarrollo

| Etapa | Contenido | Estado |
| --- | --- | --- |
| 1 | Plan, decisiones, revisión de la estructura de referencia | ✅ |
| 2 | Motor de transcripción en el navegador, evaluación en iOS y Android, diccionario | en curso |
| 3 | Estructuración del pase | — |
| 4 | Interfaz móvil, cifrado, exportación a `.docx` | — |
| 5 | Pruebas, despliegue, documentación, revisión de licencia | — |
