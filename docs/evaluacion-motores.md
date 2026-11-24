# Evaluación de motores de transcripción

**Estado:** en el iPhone 13 ya se midieron `tiny` y `base` en WASM; ninguno alcanza la precisión
necesaria. Publicada la **ronda 2** (`base` y `small`, en WASM y WebGPU): **falta medir `small`
en el iPhone**. Por decisión del autor (24/11/2026), no se mide en Android.

## 1. Qué se compara

| ID | Motor | Backend | Modelo | Pesos | Tamaño | Ronda |
|----|-------|---------|--------|-------|-------:|-------|
| `tjs-tiny-wasm` | Transformers.js 4.3 | WASM (SIMD + hilos) | tiny | q8 | 41 MB | 1 |
| `tjs-base-wasm` | Transformers.js 4.3 | WASM | base | q8 | 77 MB | 1 |
| `tjs-tiny-webgpu` | Transformers.js 4.3 | WebGPU | tiny | enc fp16 + dec q4 | 103 MB | 1 |
| `tjs-base-webgpu` | Transformers.js 4.3 | WebGPU | base | enc fp16 + dec q4 | 165 MB | 1 |
| `tjs-small-webgpu` | Transformers.js 4.3 | WebGPU | small | enc fp16 + dec q4 | 410 MB | 1 |
| `tjs-small-wasm` | Transformers.js 4.3 | WASM | small | q8 | 249 MB | 1-bis |
| whisper.cpp | whisper.cpp (Emscripten) | WASM (SIMD + hilos) | tiny / base / small | q5_1 | 32 / 60 / 190 MB | 1-bis |

El sitio de GitHub Pages admite hasta 1 GB, así que las configuraciones se reparten en rondas.
La ronda 1 sumó 804 MB de modelos. La **ronda 2** (24/11/2026) saca `tiny` (descartado) y suma
`small` en WASM: `base` y `small` en WASM y WebGPU, 906 MB.

Cada configuración se mide **con y sin** el prompt de sesgo del diccionario (80 términos base
con `sesgo`, recortados a 150 tokens).

## 2. Método

- **Dictados:** los 20 sintéticos de `tests/fixtures/dictados`, leídos por el autor con el
  iPhone 13 (Notas de voz). Cribado: 01, 03, 07, 12 y 16. Completo: los 20.
- **Segmentación:** cortes en las pausas (máximo 28 s por tramo); los tramos sin voz no se
  envían al modelo.
- **Reintento por bucle:** si un tramo termina en una repetición o agota los tokens, se
  reintenta una vez con penalización de repeticiones. Se informa la cantidad de reintentos.
- **WER del modelo:** salida cruda contra el texto literal leído.
- **WER final:** salida post-procesada contra el texto esperado. Es el mismo texto literal,
  salvo en los 6 dictados con puntuación hablada, donde los comandos ya están convertidos en
  signos.
- **Normalización para el WER:** minúsculas, sin puntuación, números en dígitos ("cero coma
  quince" = "0,15"), abreviaturas de unidades expandidas ("ml/kg" = "mililitros por kilo").
  Se conservan las tildes.
- **Acierto en términos médicos:** proporción de los términos esperados de cada dictado
  (`.terminos.txt`, 15 a 28 por dictado) que aparecen escritos correctamente. Se comparan
  sin distinguir mayúsculas ni guiones, pero con tildes.
- **Tiempo:** segundos de procesamiento por minuto de audio, sin contar la carga del modelo
  (informada aparte, con calentamiento incluido).

## 3. Umbrales propuestos (a fijar con el autor después del cribado)

| Métrica | Propuesta |
|---------|-----------|
| WER final | ≤ 12 % |
| Acierto en términos médicos (final) | ≥ 90 % |
| Tiempo en el equipo de referencia | ≤ 30 s por minuto de audio |
| Carga del modelo (en tibio) | ≤ 10 s |

## 4. Prueba funcional en la Mac (no es la evaluación)

El 23/11/2026 se verificó el flujo completo en una Mac M4 (Chromium, WebGPU Metal, 4 hilos WASM
con aislamiento de origen logrado por el service worker). Se usaron 3 dictados con **voz
sintética del sistema** (Paulina, español de México), que no representa el dictado real.

| Configuración | Prompt | WER modelo | Términos (final) | s / min audio |
|---|---|---:|---:|---:|
| base · WebGPU | con | 22,2 % | 63,6 % | 3,6 |
| base · WebGPU | sin | 25,5 % | 50,0 % | 3,5 |
| tiny · WASM | con | 65,3 % | 19,6 % | 3,1 |
| tiny · WASM | sin | 81,1 % | 10,7 % | 2,8 |

Segunda prueba, con el reintento por bucle y la misma voz sintética (dictado 01, con prompt):

| Configuración | WER final | Términos | Tiempo (110 s de audio) | Carga |
|---|---:|---:|---:|---:|
| small · WebGPU | **5,7 %** | 18/22 | 12,4 s | 2,9 s |
| base · WASM (4 hilos) | 17,0 % | 14/22 | 9,5 s | 1,7 s |
| tiny · WASM (4 hilos) | 36,3 % | 7/22 | 8,9 s | 1,9 s |

Conclusiones de esta prueba:

1. **El flujo funciona de punta a punta** sin ninguna descarga de terceros, con hilos WASM
   gracias al aislamiento que logra el service worker en un servidor sin encabezados (como
   GitHub Pages).
2. **`tiny` no es utilizable**: cae en bucles de repetición ("2.0.0.0…"). El reintento con
   penalización los corta, pero el error sigue siendo alto.
3. **`small` es claramente superior** en precisión. Falta saber si entra en la memoria del
   iPhone 13 y cuánto tarda en cada teléfono.
4. El prompt del diccionario mejoró el acierto en términos en esta muestra (50 → 64 % con
   `base`). Hay que confirmarlo con voz real.
5. **Whisper interpreta a medias la puntuación dictada.** Escribe "punto y aparte" como
   ". y aparte", "punto seguido" como ".seguido" y "dos puntos" como "2." o "2 puntos". Se
   agregaron reglas para esas formas: en el dictado 07 con `small`, el WER final bajó de
   36,7 % a 9,4 % sin cambiar el modelo.
6. **Riesgo con los números**: el modelo pegó el dígito de "FiO2" al valor ("fío 230 %" por
   "FiO2 30 %") y partió decimales ("0. 2"). La app no los corrige solos: los **marca para
   revisión**. Es un argumento más para que cada paciente se confirme a mano.

## 5. Resultados en iPhone 13 (iOS 27.2)

### Primera corrida (24/11/2026), dictados de cribado leídos por el autor

Archivo: [`resultados/iphone13-ronda1-2026-11-24.json`](resultados/iphone13-ronda1-2026-11-24.json).

**Equipo:** Safari 27.2, 4 núcleos (3 hilos WASM, aislamiento de origen logrado), WebGPU
disponible ("apple", `shader-f16`, buffer máximo 716 MB), cuota de almacenamiento 41 GB.

**Carga de modelos:**

| Configuración | Resultado |
|---|---|
| tiny · WASM | cargó en 39,7 s (incluye la descarga de 44 MB) |
| base · WASM | **falló**: "Load failed" |
| tiny · WebGPU | **falló**: "Error en el worker" (sin detalle) |
| base · WebGPU | **falló**: "Load failed" |
| small · WebGPU | **falló**: "Load failed" |

**`tiny` · WASM con voz real** (5 dictados):

| Prompt | WER modelo | WER final | Términos (final) | s / min audio |
|---|---:|---:|---:|---:|
| con | 103 % | 118 % | 2,9 % | 16,8 |
| sin | 89 % | 96 % | 1,0 % | 14,9 |

El audio llega bien (la transcripción sigue fonéticamente al dictado: "lastico" por láctico,
"asopesina" por vasopresina), pero **`tiny` no reconoce la terminología**. Queda descartado.

**Causa de las fallas de carga.** "Load failed" es el error de red de Safari. Fallaron todos los
archivos de 54 MB o más; pasaron solo los de `tiny` (hasta 31 MB). El service worker reenviaba
las descargas de modelos para agregarles los encabezados de aislamiento, y Safari corta esas
respuestas largas.

**Corrección (24/11/2026):**
- Los modelos ya no pasan por el service worker (no necesitan los encabezados: son del mismo origen).
- Las descargas se reintentan y se **reanudan con pedidos por rango** si la conexión se corta
  (probado con una prueba automática que corta la red a mitad de la descarga).
- Los errores del worker ahora se informan con detalle.
- Se agregó el botón **"Probar solo la carga"** para verificar los modelos sin audio.

### Segunda corrida (24/11/2026), con la descarga corregida

Archivo: [`resultados/iphone13-ronda1-2026-11-24-b.json`](resultados/iphone13-ronda1-2026-11-24-b.json).
En esta corrida se probó `base` · WASM; las configuraciones WebGPU no se volvieron a correr (sus
errores en el archivo son los de la primera corrida).

**`base` · WASM ahora carga** en 27,8 s (incluida la descarga de 80 MB). La corrección de la
descarga funciona en Safari.

| Prompt | WER modelo | WER final | Términos (final) | s / min audio |
|---|---:|---:|---:|---:|
| con | 50,5 % | 55,9 % | 17,5 % | 19,5 |
| sin | 57,6 % | 64,4 % | 9,7 % | 17,5 |

Por dictado (con prompt), el WER del modelo va de 41 % (16) a 66 % (12, con ruido). El prompt del
diccionario ayuda en todos los dictados (entre 2 y 11 puntos menos de WER, el doble de términos),
pero no alcanza.

**Conclusión:** `base` es rápido en el iPhone (≈ 0,3 veces la duración del audio), pero con voz real
**no alcanza la precisión necesaria**. Ejemplos: "procalcitorino", "cateteria de la arterial
radioiliquierto" y otra vez "fio 250 %" por "FiO2 50 %". Todo depende de si `small` funciona en el
iPhone 13.

### Tercera corrida (ronda 2)

*Pendiente:* `small` en WebGPU y en WASM, y `base` en WebGPU.

## 6. Android

Por decisión del autor (24/11/2026) no se mide en Android.

## 7. Decisión

*Pendiente de las mediciones.*
