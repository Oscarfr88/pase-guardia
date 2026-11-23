# Evaluación de motores de transcripción

**Estado:** ronda 1 publicada, **esperando las mediciones en iPhone 13 y Galaxy S25**.
Este informe se completa con los JSON que exporta la página `/bench` en cada equipo.

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
La ronda 1 suma 804 MB de modelos.

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

Conclusiones de esta prueba:

1. El flujo funciona de punta a punta sin ninguna descarga de terceros.
2. `tiny` cae en bucles de repetición ("2.0.0.0…"). Se agregó el reintento con penalización.
3. El prompt del diccionario mejoró el acierto en términos en esta muestra (50 → 64 %). Hay
   que confirmarlo con voz real.

## 5. Resultados en iPhone 13 (iOS 27.2)

*Pendiente.*

## 6. Resultados en Samsung Galaxy S25

*Pendiente.* El S25 (Snapdragon 8 Elite) es de **gama alta**: representa el mejor caso en
Android, no la gama media que pide el requisito.

## 7. Decisión

*Pendiente de las mediciones.*
