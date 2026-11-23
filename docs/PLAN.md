# Pase de Guardia UTI — Plan de la etapa 1

**Estado:** aprobado con las respuestas del 23/11/2026 (ver §12) · **Repo:** `Oscarfr88/pase-guardia` (público)

> Etapa 1: solo documentación. Todavía no hay código ni Pages.

---

## 0. Decisiones que necesito que apruebes

| # | Tema | Propuesta | Alternativa |
|---|------|-----------|-------------|
| D1 | Formato del pase | **I-PASS adaptado** (§4). Las 9 secciones mínimas se agrupan en I-P-A-S. La "S" de síntesis del receptor queda afuera porque la hace quien recibe el pase. | SBAR |
| D2 | Cómo se estructura | **Determinístico, sin IA generativa.** Marcadores hablados ("Antecedentes: …") y grabación directa dentro de una sección. Lo que no tiene marcador va a "Sin asignar" y el médico lo ubica. | Clasificador ML (descartado: puede ubicar mal el texto y no se puede auditar) |
| D3 | Motor de transcripción | Se decide **midiendo** 3 candidatos × 3 tamaños (§3). Hipótesis previa: Transformers.js + WebGPU con `small` donde haya WebGPU, y `base` en WASM como respaldo. | — |
| D4 | Sesgo de vocabulario | Prompt inicial de Whisper (máx. 224 tokens, primero los términos del usuario) + reemplazos determinísticos del diccionario. El efecto del prompt se mide con y sin él. | Solo reemplazos |
| D5 | Cifrado | AES-GCM 256. Una clave de datos aleatoria (DEK) envuelta por una clave derivada de la contraseña con PBKDF2-SHA-256, 600.000 iteraciones y sal de 16 bytes. | Argon2id vía WASM (más resistente a fuerza bruta, suma una dependencia) |
| D6 | Contraseña | Mínimo 8 caracteres, con indicador de fortaleza y recomendación de usar una frase de 3–4 palabras. | PIN (lo desaconsejo: se rompe offline en minutos) |
| D7 | Audio | Captura PCM 16 kHz mono con AudioWorklet, cifrada en bloques de 5 s. Por defecto se **borra al cerrar el paciente**, con un tope de 24 h (configurable: inmediato / al cerrar / 24 h / 72 h). | MediaRecorder (los códecs difieren entre iOS y Android) |
| D8 | Exportación | `.docx` con la librería `docx` (MIT) y texto plano. En iOS instalado usa la hoja de compartir del sistema ("Guardar en Archivos"), porque ahí la descarga directa de un Blob no funciona bien. | Solo descarga |
| D9 | Pacientes sin revisar | El `.docx` incluye solo pacientes **cerrados**. Hay una opción explícita para incluir los no revisados, que salen con el rótulo "BORRADOR — NO REVISADO". | Bloquear la exportación |
| D10 | Stack | React 18 + TS + Tailwind 3.4 con la misma config que informes-pocus. **Vite 8 + vite-plugin-pwa 2 + Vitest 5**: Vite 5 ya no tiene soporte y Vitest 5 exige Vite ≥ 6.4. | Vite 5 idéntico (sin Vitest actual) |
| D11 | Modelo en el build | Se baja una vez de Hugging Face con el commit fijado, se verifica el SHA-256 y se sube como asset de un **Release del propio repo**. El CI lo toma de ahí, vuelve a verificar el hash y lo copia a `dist/`. En tiempo de ejecución se descarga **solo desde el mismo origen**. | CI baja directo de Hugging Face |
| D12 | Licencia | **Apache-2.0** (§8). Se publica **sin archivo LICENSE** hasta la revisión legal: el README dice "licencia propuesta, pendiente de revisión; hasta entonces, todos los derechos reservados". **Confirmado por el autor el 23/11/2026.** | MIT · AGPL-3.0 |
| D13 | Retención de turnos | Los turnos se borran solos a los **14 días** (configurable: 7 / 14 / 30 días / nunca). | Sin borrado automático |
| D14 | Corrector ortográfico | `spellcheck="false"` por defecto en los campos clínicos, porque el corrector "mejorado" de Chrome envía el texto a Google. Configurable. | Dejar el del navegador |

---

## 1. Revisión de informes-pocus: qué copio y qué cambia

Revisé el código de `Oscarfr88/informes-pocus` y su `deploy.yml`.

**Se copia tal cual:**
- React 18 + TypeScript estricto (`strict`, `noUnusedLocals`, `noUnusedParameters`), `moduleResolution: bundler`, `tsconfig.node.json`.
- Tailwind con `darkMode: 'class'`, paleta `clinical`, sombras `soft`/`glow`, animaciones `fade-in`/`pop`; modo nocturno por defecto con conmutador en el encabezado.
- Estado centralizado con Context + `useReducer` (`estadoInicial` exportado, acción `loadState`).
- Carpetas `types/`, `data/` (datos separados de la UI), `context/`, `utils/` (lógica pura), `components/` y `components/ui/` (Card, TextArea, OptionGroup, etc.).
- `vite-plugin-pwa` con `registerType: 'autoUpdate'`, el manifiesto, `base: '/pase-guardia/'`, los íconos generados con `scripts/gen-icons.mjs` (sharp) y los meta tags de iOS y safe-area.
- README en español con la misma estructura: descripción, Stack, tabla de módulos, árbol de Estructura, Puesta en marcha, Exportación.
- Workflow de Pages con la misma estructura (build → `upload-pages-artifact` → `deploy-pages`, `concurrency: pages`, permisos).

**Cambia, por requisitos de este proyecto:**

| informes-pocus | pase-guardia | Motivo |
|---|---|---|
| Inter desde Google Fonts | Inter empaquetada (`@fontsource-variable/inter`, OFL) | Sin fuentes remotas |
| Datos en `localStorage` en claro | IndexedDB cifrado | Privacidad (§6) |
| `generateSW` | `injectManifest` con service worker propio | Caché del modelo aparte; COOP/COEP si se usan hilos |
| `orientation: 'portrait'` | `orientation: 'any'` | Vertical y horizontal |
| Sin pruebas | Vitest (unidad) + Playwright (E2E) | Criterios de aceptación |
| Workflow: Node 20, solo build | Node 22, **test → modelo → build → chequeo de tamaño → deploy** | Node 20 terminó su soporte en abril de 2026; pruebas obligatorias |
| Sin licencia | Licencia propuesta + términos en borrador | Requisito |
---

## 2. Arquitectura

```
┌──────────────────────── Hilo principal (React) ────────────────────────┐
│ SesionContext (bloqueo, clave en memoria)                              │
│ PaseContext + useReducer (turnos, pacientes, tomas, secciones,         │
│                           diccionario, ajustes; descifrados en memoria)│
│   ├─ utils/almacen.ts ──► IndexedDB: solo sobres {id, tipo, iv, ct}     │
│   ├─ Grabador: AudioWorklet → PCM 16 kHz → bloques cifrados            │
│   ├─ utils/postproceso.ts  (puntuación dictada, diccionario, formato)  │
│   ├─ utils/estructurar.ts  (marcadores → secciones I-PASS)             │
│   └─ utils/exportDocx.ts / exportTexto.ts                              │
└──────────────┬─────────────────────────────────────────────────────────┘
               │ postMessage (audio descifrado, transferido; sin copia)
┌──────────────▼──────────────┐      ┌──────────────────────────────────┐
│ workers/asr.worker.ts       │      │ Service worker propio            │
│  VAD → Whisper → segmentos  │◄────►│  precache: solo interfaz          │
│  (motor elegido en etapa 2) │      │  caché "modelo-vN": solo pesos    │
└─────────────────────────────┘      │  nunca toca datos clínicos        │
                                     └──────────────────────────────────┘
```

- **Todo pasa en el dispositivo.** Cuando la app arranca no hace ninguna petición fuera de su origen. La CSP (`connect-src 'self'`) lo garantiza técnicamente (§6).
- **Flujo de una toma:** grabar → finalizar → la toma entra en la cola → el worker transcribe → post-proceso → estructuración → revisión. Mientras se transcribe, el médico puede pasar al paciente siguiente.
- **Al bloquear la sesión:** se termina el worker (libera el audio de la memoria), se vacía el estado de React y se descarta la clave. Las tomas que estaban en cola se reanudan al desbloquear, porque el audio quedó guardado cifrado.
- **Etapas 2 y 3 sin persistencia:** hasta que exista el cifrado (etapa 4), la app no guarda nada; trabaja solo en memoria.

---

## 3. Motor de transcripción

### 3.1 Candidatos (todos en un Web Worker)

| ID | Motor | Backend | Sesgo por prompt | Notas |
|----|-------|---------|------------------|-------|
| A | Transformers.js 4.3 (Apache-2.0) + pesos ONNX | **WebGPU** | Sí, vía `decoder_input_ids` con `<|startofprev|>` (el pipeline no lo trae; verificado en el código de la v4.3.2) | No necesita SharedArrayBuffer |
| B | Transformers.js 4.3 | WASM (SIMD; hilos si hay aislamiento) | Igual que A | Respaldo universal |
| C | whisper.cpp (MIT) compilado con Emscripten | WASM (SIMD + hilos) | Sí, `initial_prompt` nativo (requiere binding propio) | Sin hilos es lento; los hilos piden COOP/COEP |

**Hilos en GitHub Pages:** Pages no permite configurar los encabezados COOP/COEP. Se pueden inyectar desde el service worker (la técnica de `coi-serviceworker`, la misma que usa el demo de whisper.cpp). Solo lo activo si la medición muestra que conviene.

**WebGPU en iOS:** viene habilitado por defecto desde Safari 26 (iOS/iPadOS 26). Los equipos que no actualizan a iOS 26 quedan en WASM. Hay que medir los límites de memoria y de tamaño de buffer en el iPhone real.

**Equipo de referencia iOS: iPhone 13** (A15 Bionic, 4 GB de RAM).
- Es compatible con iOS 26, así que puede usar WebGPU si está actualizado.
- Con 4 GB de RAM, `small` en WebGPU (~410 MB de pesos más las activaciones) puede exceder el límite de memoria de Safari. **`base` es el candidato más realista** en este equipo. `small` se prueba igual, y si falla queda documentado.
- Hay un reporte no verificado de que WebGPU en iOS exige un iPhone 15 Pro o posterior. Se confirma o se descarta midiendo en el 13.

### 3.2 Tamaños (archivos reales en Hugging Face, medidos hoy)

| Modelo | WASM (enc + dec int8) | WebGPU (enc fp16 + dec q4) | whisper.cpp q5_1 |
|--------|----------------------|----------------------------|------------------|
| tiny | 10 + 31 = **41 MB** | 17 + 87 = **103 MB** | **32 MB** |
| base | 23 + 54 = **77 MB** | 41 + 124 = **165 MB** | **60 MB** |
| small | 92 + 157 = **249 MB** | 177 + 233 = **410 MB** | **190 MB** |

- El límite de Pages es de **1 GB por sitio publicado** y 10 min por deploy. La matriz completa (~1,3 GB) no entra de una vez, así que la evaluación se hace en **dos rondas**, cada una por debajo de 1 GB.
- En producción va **un modelo** (o dos: uno WebGPU y un respaldo WASM), y cada dispositivo descarga solo el que le corresponde.
- Los archivos de más de 100 MB no pueden ir en git. Los provee el CI desde el Release (D11) y un script hace fallar el build si `dist/` supera los 950 MB.
- El ancho de banda de Pages tiene un tope blando de 100 GB/mes: con un modelo de 410 MB alcanza para unas 240 instalaciones por mes. Sobra para uso personal entre colegas.

### 3.3 Protocolo de medición (etapa 2)

- **Página `/bench`**, que se publica junto con la app. Carga los audios **desde el dispositivo con un selector de archivos**: los audios nunca se suben al repo ni a Pages. Corre cada configuración y exporta un JSON de resultados, sin audio, que me pasás.
- **Métricas:**
  - WER estricto y WER normalizado (minúsculas, sin puntuación, con tildes), antes y después del post-proceso.
  - Tasa de acierto en términos médicos: proporción de los términos esperados de cada dictado que aparecen en forma canónica.
  - RTF (tiempo de transcripción / duración del audio) y segundos por minuto de audio.
  - Carga del modelo en frío y en tibio.
  - Fallos por memoria.
  - Cada métrica con y sin prompt.
- **Ronda 1 (cribado):** 5 dictados × todas las configuraciones viables. Se descarta lo que tenga RTF > 2 o se cuelgue.
- **Ronda 2:** los 20 dictados × 2–3 finalistas × iPhone y Android.
- **Umbrales tentativos** (se fijan con vos después de la ronda 1): WER normalizado post-procesado ≤ 12 %; acierto en términos médicos ≥ 90 %; ≤ 30 s de procesamiento por minuto de audio en el equipo de referencia; carga en tibio ≤ 10 s.
- **Entregable:** `docs/evaluacion-motores.md`, con tablas por plataforma y la decisión fundamentada.

### 3.4 Segmentación y artefactos

- **VAD:** Silero VAD (MIT, ~2 MB, corre en el mismo onnxruntime) para cortar en las pausas en lugar de ventanas fijas de 30 s. Se mide contra segmentación fija con solapamiento.
- **Alucinaciones conocidas de Whisper en español sobre silencio** ("Subtítulos realizados por la comunidad de Amara.org", "Gracias por ver"): se **marcan** para revisión y no se borran en silencio.
- **Parámetros:** idioma forzado `es`, tarea `transcribe`.

### 3.5 Post-procesamiento (determinístico, cada cambio queda resaltado en la revisión)

1. **Puntuación dictada:** "punto y aparte", "punto seguido", "nueva línea", "dos puntos", "abre/cierra paréntesis", "coma".
   - **Riesgo clínico:** "coma" (estado de coma) y "punto" (punto de corte, punto de inserción). La conversión sigue reglas de exclusión: no convierte "coma" después de "en", "estado de", "Glasgow…".
   - Los casos ambiguos se dejan como están y se resaltan.
   - Se puede desactivar y usar solo la puntuación automática de Whisper.
2. **Diccionario:** variante → término canónico.
   - La coincidencia ignora mayúsculas y tildes, respeta los límites de palabra y aplica primero la variante más larga.
   - Ejemplos: "nor adrenalina" → noradrenalina; "fi o dos" → FiO2; "ph" → pH.
3. **Formato (configurable):** coma decimal (0,5); unidades abreviadas ("mililitros por hora" → ml/h). **No se convierten unidades clínicas** ("gammas" queda "gammas").

Cada toma guarda el texto crudo del modelo, el texto post-procesado y la versión del diccionario con que se procesó.

---

## 4. Estructuración del pase (I-PASS adaptado)

| I-PASS | Sección de la app (orden del documento) | Marcadores hablados (inicio de frase) |
|--------|------------------------------------------|----------------------------------------|
| **I** — Severidad | Riesgo de deterioro (texto dictado + selector opcional *estable / vigilar / inestable*, vacío por defecto y elegido solo por el médico) | "riesgo", "riesgo de deterioro", "gravedad" |
| **P** — Resumen del paciente | 1. Diagnóstico principal y motivo de internación | "diagnóstico", "motivo de internación/ingreso" |
| | 2. Antecedentes relevantes | "antecedentes" |
| | 3. Evolución | "evolución" |
| | 4. Soporte → ventilatorio · vasopresor/inotrópico · sedoanalgesia · accesos y dispositivos · otras drogas | "soporte", "ventilatorio", "hemodinamia", "sedoanalgesia", "accesos", "drogas" |
| | 5. Microbiología y antibióticos | "microbiología", "cultivos", "antibióticos" |
| | 6. Laboratorio e imágenes | "laboratorio", "imágenes" |
| **A** — Acciones | 7. Pendientes | "pendientes" |
| **S** — Conciencia situacional | 8. Plan y contingencias | "plan", "contingencia" |
| — | Sin asignar (temporal) | — |

**Reglas:**
- Un marcador vale solo al **inicio de una frase o de una toma**, seguido de ":", "," o pausa. Con la forma "sección X" funciona en cualquier lugar.
- El texto anterior al primer marcador va a la sección desde la que se grabó, o a "Sin asignar".
- Para **cerrar un paciente**, "Sin asignar" tiene que estar vacío o marcado expresamente como "Otros".
- La app **nunca completa ni sugiere** contenido. Una sección vacía aparece como *(no dictado)*, una meta-etiqueta en cursiva, no un dato clínico. No hay autocompletado clínico.
- **Varias tomas** se agregan en orden cronológico. Cada fragmento conserva su procedencia (toma + rango de texto) para el anexo literal.
- **Estados del paciente:** sin tomas → transcribiendo → en revisión → **cerrado**, que exige la confirmación "Revisé el contenido". Editar un paciente cerrado lo vuelve a "en revisión".
- **Pruebas:** los 20 dictados sintéticos sirven de fixtures. Para cada uno se espera la asignación por sección.

---

## 5. Diccionario personalizado

**Formato** (`pase-guardia/diccionario`, versión 1):

```json
{
  "formato": "pase-guardia/diccionario", "version": 1,
  "terminos": [
    { "id": "…", "termino": "noradrenalina", "variantes": ["nor adrenalina", "nora drenalina"],
      "categoria": "farmacos", "origen": "base", "sesgo": true }
  ]
}
```

- **Categorías:** fármacos · escalas · ventilación · gasometría y laboratorio · ecografía/POCUS · microbiología · procedimientos · dispositivos y vías · abreviaturas y unidades · diagnósticos y síndromes (esta última la agrego como propuesta).
- **Carga inicial:** unos 700 términos, entre ellos SOFA, APACHE II, Glasgow, RASS, CAM-ICU, FATE, RUSH, eFAST, VExUS, TAPSE, VTI y VCI. **La armo yo y la revisás vos** antes de la etapa 3.
- **Agregar desde la transcripción:** la transcripción se muestra como palabras tocables. Al tocar una palabra o frase se abre una hoja con término correcto, variante (la forma mal reconocida), categoría y Guardar.
  - Si el término ya existe, se **fusionan las variantes** en lugar de duplicarlo.
  - Si la variante apunta a otro término, se avisa del conflicto.
- **Sin recargar:** cada transcripción nueva toma el diccionario vigente en ese momento (versión incremental).
- **Transcripciones anteriores:** no cambian. Solo cambian con "Reaplicar diccionario a esta toma"; si las secciones ya fueron editadas a mano, antes se muestra la diferencia y se pide confirmación.
- **Prompt de sesgo:** primero los términos del usuario (los más recientes), después los términos base con `sesgo: true`, hasta unos 150 tokens.
- **Importar/exportar:** archivo `.json`. Al importar se valida el esquema y se fusiona sin duplicar.
- Nada se usa para entrenar modelos: no hay entrenamiento ni envío de datos.

---

## 6. Almacenamiento y privacidad

**Cifrado (D5):**
- La DEK (AES-GCM 256) es aleatoria, se genera en el primer uso y queda envuelta con la KEK derivada por PBKDF2.
- Cambiar la contraseña re-envuelve la DEK sin volver a cifrar los datos.
- Cada registro lleva un IV aleatorio de 96 bits y AAD = id + tipo, para que no se puedan intercambiar registros.
- La clave es un `CryptoKey` **no extraíble** que vive solo en memoria.

**Qué queda en claro en IndexedDB:** solo `id` aleatorio, `tipo`, `iv`, texto cifrado, la sal y la DEK envuelta. **Ni siquiera la cama o el alias quedan en claro.**

**Fuera de IndexedDB:**
- `localStorage`: solo el tema (claro/oscuro).
- Cache Storage: solo la interfaz y los pesos del modelo.

**Bloqueo (configurable):**
- Botón "Bloquear".
- Por inactividad (1 / 5 / 15 / 30 min).
- Al salir de la app (inmediato o tras N min).
- Bloquear no borra nada.
- Contraseña incorrecta: espera progresiva entre intentos.

**Borrado total:** IndexedDB + `localStorage`, con la opción de borrar también el modelo descargado. Doble confirmación.

**Primer uso:**
- El aviso, con aceptación explícita: herramienta de documentación personal; el médico es responsable de lo que firma y de revisar cada documento; no reemplaza la historia clínica institucional; no fue evaluada como producto médico regulado.
- La explicación de que **sin contraseña no hay recuperación**.
- La creación de la contraseña.
- La descarga del modelo, mostrando el tamaño y recomendando Wi-Fi.
- La prueba de micrófono.

**CSP estricta**, por `<meta>` porque Pages no permite encabezados:

```
default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self';
connect-src 'self'; img-src 'self' data: blob:; style-src 'self'; font-src 'self';
media-src 'self' blob:; manifest-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'
```

Si algún motor necesita `blob:` en `worker-src`, se documenta y se justifica. `frame-ancestors` no funciona en `<meta>`, así que se agrega un bloqueo por JS si la app se abre dentro de un iframe.

**Mitigaciones adicionales:**
- Al pasar a segundo plano se tapa el contenido, para que no quede en la captura del selector de apps (de mejor esfuerzo).
- Al copiar texto se avisa que el portapapeles puede sincronizarse con otros equipos (Portapapeles Universal de Apple, Gboard).
- El campo alias advierte que no se usen nombres ni DNI.

**Exportación:**
- La pantalla advierte que el archivo queda en el dispositivo, en claro, y que su guardado es responsabilidad del médico.
- Nombre del archivo: `pase-AAAA-MM-DD-franja.docx`, sin identificadores.
- Los metadatos del `.docx` (autor, "modificado por") van vacíos.

**Lo que el diseño no cubre** (va en el README):
- Un dispositivo comprometido o con malware.
- Los datos en memoria mientras la sesión está desbloqueada.
- Las contraseñas débiles frente a un ataque offline.
- Los `.docx` ya exportados.
- Los registros de acceso de GitHub Pages: GitHub ve la IP de quien descarga la app y el modelo. Por ahí no pasan datos clínicos.

**Repositorio:**
- `.gitignore` que excluye audios (`*.wav *.m4a *.mp3 *.aac *.ogg *.opus *.webm *.flac *.caf *.pcm`), `*.docx`, bases locales, modelos (`*.onnx *.bin *.gguf`, `public/modelos/`), `.env*`, `coverage/`, `test-results/` y resultados crudos del bench.
- Un paso del CI falla si se versiona alguna extensión prohibida.

---

## 7. Pruebas y verificación

| Criterio | Cómo se verifica |
|----------|------------------|
| Estructuración, diccionario, cifrado, docx | Vitest. El docx se genera, se descomprime con `fflate` y se verifican el XML bien formado, los encabezados por sección, la tabla resumen y el texto |
| `.docx` abre en Word | Manual en Word (Mac y móvil) |
| Sin conexiones salientes | Playwright (Chromium + WebKit) registra **todas** las peticiones del flujo completo; falla si alguna sale del origen o si hay violaciones de CSP. Se corre también con la red cortada después de instalar. En los equipos: modo avión + pase completo; opcionalmente PCAPdroid (Android) o el Informe de privacidad de apps (iOS) |
| Funciona offline | Playwright `setOffline(true)` después de que se instala el service worker; transcripción con `tiny` en el CI |
| Sin datos legibles tras bloquear | Prueba E2E con "cadenas canario": se crea un paciente con textos únicos, se bloquea, se vuelcan IndexedDB, Cache Storage, `localStorage` y `sessionStorage`, y se buscan los canarios en claro y en base64. Debe dar cero |
| Palabra nueva reconocida sin recargar | E2E: se agrega una variante desde la UI y se procesa el siguiente audio de prueba (micrófono falso de Chromium con WAV) |
| Pase simulado de 3 pacientes en iOS y Android | Checklist guiado que corrés vos en los equipos; yo lo pruebo antes en el Simulador de iOS y en desktop |
| Ningún dato real | Solo dictados sintéticos (los textos van en `tests/fixtures`; los audios, nunca) + chequeo de extensiones en el CI |

---

## 8. Licencia y términos (borrador para revisión legal)

**Recomendación: Apache-2.0.**
- Es permisiva.
- Tiene cláusulas explícitas de **ausencia de garantía y limitación de responsabilidad** (secciones 7 y 8).
- Otorga licencia de patentes.
- **No otorga uso del nombre** (sección 6): un fork modificado, por ejemplo uno que envíe datos a un servidor, no puede presentarse como esta app.
- Obliga a marcar los archivos modificados.
- Es la misma licencia de Transformers.js.

**Alternativas:**
- **MIT:** más simple, pero sin cláusula de nombre ni de patentes.
- **AGPL-3.0:** obliga a quien aloje una versión modificada a publicar su código (útil para auditar la privacidad de los forks), pero restringe el reúso.

**Importante:** un archivo `LICENSE` en un repo público concede la licencia en el acto, y esa concesión no se puede revocar para las copias ya obtenidas. Por eso propongo publicar **sin `LICENSE`** hasta la revisión legal (D12).

**Licencias de terceros, verificadas:**

| Componente | Licencia |
|------------|----------|
| Pesos de Whisper | MIT (repo original de OpenAI) / Apache-2.0 (tarjeta del modelo en Hugging Face); ambas permiten redistribuir con aviso. La conversión ONNX de onnx-community no declara licencia propia: en la etapa 2 se verifica la del archivo exacto y se informa en el README |
| Transformers.js | Apache-2.0 |
| onnxruntime-web | MIT |
| whisper.cpp | MIT |
| docx | MIT |
| idb | ISC |
| React | MIT |
| lucide | ISC |
| Inter | OFL-1.1 |

Se incluye una pantalla "Licencias de terceros".

**Borrador de `TERMINOS-BORRADOR.md`** (índice; el texto completo lo redacto al aprobarse el plan):
1. Naturaleza: herramienta personal de documentación que transcribe y estructura lo dictado y no genera contenido clínico.
2. No es un producto médico evaluado ni registrado ante ANMAT ni ante otra autoridad. No reemplaza la historia clínica institucional.
3. Responsabilidad del médico: revisar cada documento y responder por lo que firma o transmite. Pueden existir errores de transcripción.
4. Datos: el procesamiento es local y el autor no recibe ni accede a ningún dato. El usuario es responsable del dispositivo, la contraseña y los archivos exportados, y de cumplir la normativa aplicable: Ley 25.326 (los datos de salud son datos sensibles), Ley 26.529 y las normas de su institución. La pérdida de la contraseña implica la pérdida de los datos.
5. Recomendación de no consignar identificadores.
6. Sin garantía; limitación de responsabilidad en la medida que permita la ley.
7. Disponibilidad: sin garantía de continuidad; los registros de acceso del hosting.
8. Ley aplicable y jurisdicción: a definir por asesoría legal.
9. Aceptación en la pantalla de primer uso.

*No soy abogado: es un punto de partida para tu asesoría legal.*

---

## 9. Estructura del repositorio

```
pase-guardia/
├── .github/workflows/deploy.yml     # test → modelo (Release + SHA-256) → build → tamaño → Pages
├── index.html                        # CSP <meta>, meta iOS, safe-area
├── package.json · vite.config.ts · tailwind.config.js · postcss.config.js
├── tsconfig.json · tsconfig.node.json · vitest.config.ts · playwright.config.ts
├── modelos.json                      # manifiesto: archivo, origen, commit HF, sha256, bytes, licencia
├── scripts/  gen-icons.mjs · obtener-modelo.mjs · verificar-tamano.mjs · verificar-repo.mjs
├── public/icons/ · public/modelos/ (vacío en git; lo llena el CI)
├── src/
│   ├── main.tsx · App.tsx · index.css · sw.ts
│   ├── types/index.ts
│   ├── data/   secciones.ts (I-PASS) · marcadores.ts · puntuacion.ts · diccionario-base.json · avisos.ts
│   ├── context/ PaseContext.tsx · SesionContext.tsx
│   ├── utils/  cripto.ts · almacen.ts · audio.ts · postproceso.ts · diccionario.ts
│   │           estructurar.ts · exportDocx.ts · exportTexto.ts · bloqueo.ts · metricas.ts (WER)
│   ├── workers/ asr.worker.ts · captura-pcm.worklet.ts · motores/
│   ├── bench/   (página de evaluación)
│   └── components/
│       ├── ui/  Card · BotonGrande · Hoja · TextArea · OptionGroup · Toggle · Confirmar
│       └── PrimerUso · Desbloqueo · Turno · Paciente · Grabador · Revision · Resumen · Diccionario · Ajustes
├── tests/  unit/ · e2e/ · fixtures/dictados/ (solo texto sintético)
├── docs/   PLAN.md · evaluacion-motores.md · guia-de-uso.md
├── README.md · TERMINOS-BORRADOR.md · (LICENSE tras la revisión legal) · .gitignore
```

---

## 10. Pantallas (etapa 4)

- **Pantallas:** Primer uso → Desbloqueo → **Turno** (tarjetas por cama/alias con estado, cantidad de tomas y riesgo) → **Paciente** (grabador grande Iniciar/Pausar/Finalizar, lista de tomas, secciones editables, transcripción tocable) → **Resumen del turno** (tabla + exportar) → Diccionario → Ajustes.
- **Táctil:** objetivos de ≥ 48 px.
- **Tablet en horizontal:** dos columnas (lista + detalle).
- **Nuevo turno:** puede copiar solo las camas y los alias del turno anterior, nunca el contenido.
- **Grabación:**
  - Wake Lock mientras se graba, para que no se apague la pantalla.
  - Pausa automática si entra una llamada o la app pasa a segundo plano.
  - Indicador de nivel de audio.

---

## 11. Etapas

| Etapa | Contenido | Te muestro |
|-------|-----------|------------|
| **1** | Este plan. Al aprobarse: creo el repo público con el README (aviso + licencia propuesta "pendiente de revisión legal"), `TERMINOS-BORRADOR.md`, `.gitignore` y `docs/PLAN.md`. **Sin código y sin Pages.** | Repo creado |
| **2** | Esqueleto (Vite/React/TS/Tailwind/PWA/CSP/service worker), worker ASR con los 3 candidatos, página `/bench`, diccionario base y post-proceso con pruebas. **Habilito Pages** (con el README ya completo) para medir en los teléfonos; vos corrés el bench; yo escribo el informe. Fijamos umbrales y modelo | Informe de motores + diccionario base para revisar |
| **3** | Estructuración I-PASS, marcadores, revisión básica; pruebas con los 20 dictados | Estructuración sobre los dictados |
| **4** | Interfaz completa, cifrado + IndexedDB, bloqueo, primer uso, exportación docx/texto, E2E | App usable en el teléfono |
| **5** | Aceptación completa, tráfico saliente, almacenamiento tras bloquear, Word, deploy final, README, guía de una página, licencia | Checklist de aceptación |

---

## 12. Respuestas (23/11/2026)

1. **Equipos:**
   - **iOS:** iPhone 13 con **iOS 27.2**. Tiene WebGPU (Safari lo trae desde la versión 26), así que se miden ambos caminos, WebGPU y WASM.
   - **Android:** **Samsung Galaxy S25** (Snapdragon 8 Elite, gama alta). El requisito pedía un equipo de gama media; el informe de evaluación va a aclarar que el S25 representa el **mejor caso** en Android y no la gama media. **Pendiente:** versión de Chrome.
2. **Dictados:** los guiones los redacta el equipo de desarrollo (están en `tests/fixtures/dictados/`) y los lee y graba el autor. La guía está en `docs/guia-dictados-prueba.md`.
3. **Licencia:** Apache-2.0, que fue la recomendada. Se publica **sin archivo `LICENSE`** hasta la revisión legal.
4. **Pages en la etapa 2:** autorizado.

---

## Fuentes

- [WebGPU is now supported in major browsers — web.dev](https://web.dev/blog/webgpu-supported-major-browsers)
- [WebGPU in iOS 26 — App Developer Magazine](https://appdevelopermagazine.com/webgpu-in-ios-26/)
- [GitHub Pages limits — GitHub Docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [actions/upload-pages-artifact](https://github.com/actions/upload-pages-artifact)
- [Allow setting COOP and COEP headers in GitHub Pages — discusión #13309](https://github.com/orgs/community/discussions/13309)
- [Use-case for Prompting Whisper in Transformers.js](https://rasgaard.github.io/posts/whisper-prompt-js.html)
- Tamaños de los modelos: API de Hugging Face (`onnx-community/whisper-{tiny,base,small}`, `ggerganov/whisper.cpp`), consultada el 23/11/2026.
- Versiones y licencias de las dependencias: registro de npm, consultado el 23/11/2026.
