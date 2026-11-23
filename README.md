# Pase de Guardia UTI — dictado y estructuración del pase

> **Estado: en desarrollo (etapa 1 de 5).** Todavía no hay una versión utilizable.
> Este repositorio contiene por ahora el plan, el aviso de responsabilidad y el borrador de términos.

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
- **Sin telemetría**, analítica, CDN, fuentes remotas ni verificación de licencia. Una
  política de seguridad de contenido (CSP) estricta bloquea cualquier conexión fuera del propio origen.
- **Datos cifrados** en IndexedDB con AES-GCM. La clave se deriva de una contraseña del
  usuario (PBKDF2). **Si se pierde la contraseña, los datos no se pueden recuperar.**
- **Sin identificadores:** los pacientes se identifican por cama o alias. No se piden nombre,
  DNI, número de historia clínica ni fecha de nacimiento.
- El service worker guarda en caché **solo la interfaz y el modelo de transcripción**.
- Los `.docx` se generan en el dispositivo y se guardan solo por acción del usuario.
  Una vez exportados quedan sin cifrar, y su resguardo es responsabilidad del médico.
- Ni los dictados ni el diccionario se usan para entrenar modelos.
- Lo único que ve GitHub (el hosting) es el registro de acceso normal de cualquier sitio web
  (IP y navegador de quien descarga la app y el modelo). Por ahí no pasan datos clínicos.

## Stack (planificado)

- **React 18 + TypeScript** (Vite)
- **Tailwind CSS** con modo nocturno (clase `dark`)
- **lucide-react** para iconografía
- Estado centralizado con **Context + useReducer**
- **vite-plugin-pwa** (instalable, funciona sin conexión)
- Transcripción con **Whisper** en un Web Worker (WebGPU o WebAssembly; el motor y el tamaño
  de modelo se eligen midiendo en iPhone y Android en la etapa 2)
- **docx** para generar el `.docx` en el navegador
- **Vitest** (pruebas unitarias) y **Playwright** (pruebas de extremo a extremo)

## Módulos (planificados)

| Módulo | Contenido |
| --- | --- |
| **Turno** | Lista de pacientes del turno por cama o alias, con su estado de revisión. |
| **Grabación** | Iniciar, pausar y finalizar; varias tomas por paciente. |
| **Transcripción** | Whisper en el dispositivo, sesgado con el diccionario activo; corrección de variantes y de notaciones (p. ej., "fi o dos" → FiO2). |
| **Estructuración I-PASS** | Severidad (riesgo de deterioro) · Resumen (diagnóstico y motivo de internación, antecedentes, evolución, soporte, microbiología y antibióticos, laboratorio e imágenes) · Acciones (pendientes) · Plan y contingencias. Se asigna por marcadores hablados, sin IA generativa. |
| **Revisión** | Edición manual. Ningún paciente queda como definitivo sin la confirmación del médico. |
| **Resumen y exportación** | `.docx` editable con encabezados por sección y tabla de pacientes; texto plano; anexo opcional con la transcripción literal. |
| **Diccionario** | Terminología de terapia intensiva editable (JSON). Se agregan términos desde la propia transcripción. Importación y exportación. |
| **Seguridad** | Cifrado, bloqueo configurable, borrado automático de audios, borrado total. |

## Estructura

Ver la estructura completa planificada en [docs/PLAN.md](docs/PLAN.md#9-estructura-del-repositorio).

```
pase-guardia/
├── README.md · TERMINOS-BORRADOR.md · .gitignore
└── docs/
    ├── PLAN.md                    # plan, decisiones y etapas
    └── guia-dictados-prueba.md    # cómo preparar los dictados sintéticos de evaluación
```

## Puesta en marcha (npm/Vite)

Disponible a partir de la etapa 2. Va a requerir **Node.js 22+**.

## Administración del diccionario

Se documenta en la etapa 2. Formato previsto: JSON con término, variantes y categoría
([docs/PLAN.md §5](docs/PLAN.md#5-diccionario-personalizado)).

## Limitaciones conocidas por dispositivo

Preliminares; se completan con las mediciones de la etapa 2.

- **iOS (Safari):**
  - WebGPU requiere iOS 26. Los equipos sin iOS 26 transcriben por WebAssembly, que es más lento.
  - La grabación se detiene si se bloquea la pantalla o la app pasa a segundo plano.
  - Instalada como app, la descarga de archivos se hace por la hoja de compartir del sistema
    ("Guardar en Archivos").
- **Android (Chrome):** el soporte de WebGPU y su rendimiento dependen del chip gráfico del equipo.
- **Todos:**
  - La primera vez hay que descargar el modelo de transcripción (decenas a cientos de MB; se
    recomienda Wi-Fi).
  - El navegador puede liberar almacenamiento si el dispositivo se queda sin espacio.

## Modelo de transcripción y licencias de terceros

Whisper (OpenAI) se publica con licencia MIT en su repositorio original y con Apache-2.0 en su
tarjeta de modelo de Hugging Face. La licencia del archivo exacto que se distribuya se verifica
y se informa aquí en la etapa 2, junto con las licencias de las demás dependencias.

## Datos de prueba

Este repositorio **no contiene ni va a contener datos reales de pacientes**. Los dictados de
evaluación son **sintéticos**. Sus audios nunca se versionan: el `.gitignore` excluye audios,
exportaciones, bases locales, modelos y archivos de entorno.

## Etapas del desarrollo

| Etapa | Contenido | Estado |
| --- | --- | --- |
| 1 | Plan, decisiones, revisión de la estructura de referencia | ✅ |
| 2 | Motor de transcripción en el navegador, evaluación en iOS y Android, diccionario | — |
| 3 | Estructuración del pase | — |
| 4 | Interfaz móvil, cifrado, exportación a `.docx` | — |
| 5 | Pruebas, despliegue, documentación, revisión de licencia | — |
