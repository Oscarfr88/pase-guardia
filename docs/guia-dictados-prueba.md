# Guía para preparar los 20 dictados de prueba

Con estos dictados se mide el motor de transcripción (etapa 2) y se prueba la estructuración (etapa 3).
Tienen que ser **totalmente inventados**.

## 1. Reglas de privacidad (obligatorias)

- **Casos 100 % ficticios.** No usar pacientes reales, ni siquiera "disfrazados" o con datos cambiados.
- Sin nombres, DNI, número de historia clínica, fechas de nacimiento, domicilios ni nombres de
  colegas o instituciones. Identificar solo por cama o alias inventado ("cama 4", "el señor de la 7").
- **Grabar en un lugar sin otras voces.** Si se agrega ruido de fondo, que sea sin conversaciones
  (monitores, alarmas, ventilación), para que no quede grabada información real de la unidad.
- Los audios **nunca se suben al repositorio**. Los textos de referencia sí se versionan como
  fixtures (son sintéticos).

## 2. Qué archivos entregar por cada dictado

| Archivo | Contenido |
|---------|-----------|
| `dictado-01.m4a` | El audio. Una grabación = una toma. |
| `dictado-01.txt` | **Texto de referencia exacto**: lo que efectivamente se dijo, palabra por palabra. Si al leer te equivocás o cambiás una palabra, corregí el `.txt` para que coincida con el audio (o volvé a grabar). |
| `dictado-01.terminos.txt` | Los términos médicos del dictado, **uno por línea, en su forma correcta** (p. ej., `FiO2`, `noradrenalina`, `VExUS`, `piperacilina-tazobactam`). Sirve para medir la tasa de acierto en términos médicos. |

Guardalos **fuera del repositorio**, en una carpeta hermana como `../pase-guardia-dictados/`.

## 3. Cómo grabar

- **Equipo:** el iPhone 13, con la app **Notas de voz**, en la calidad por defecto ("Comprimido",
  `.m4a`). La calidad "Sin pérdida" puede no decodificarse en Android.
  Yo los convierto a WAV 16 kHz en la Mac (con `afconvert`, que viene con macOS) para que todos
  los motores reciban exactamente el mismo audio.
- **Distancia:** el teléfono a 20–30 cm de la boca, como lo usarías en la guardia.
- **Ritmo:** el de un pase real, ni lento ni "de locutor".
- **Muletillas:** evitá "eh" y "este". Si se escapa una, anotala en el `.txt` o volvé a grabar.
- **Duración:** entre 1 y 3 minutos cada uno.

## 4. Qué tiene que cubrir el conjunto de 20

**Estructura:**

| Cantidad | Tipo |
|---|---|
| 14 | Con **marcadores hablados** al comienzo de cada sección: "Diagnóstico: …", "Antecedentes: …", "Evolución: …", "Soporte: …" (con "ventilatorio", "hemodinamia", "sedoanalgesia", "accesos", "drogas"), "Microbiología: …", "Laboratorio: …", "Imágenes: …", "Pendientes: …", "Riesgo: …", "Plan: …". Variá el orden entre dictados. |
| 3 | **Sin marcadores** (texto corrido, como un pase espontáneo). |
| 3 | Con marcadores, **pero con alguna sección dictada dos veces** o volviendo a una sección anterior ("volviendo a pendientes: …"). |

**Puntuación dictada:**
- En unos 6 dictados, decí la puntuación: "punto y aparte", "punto seguido", "coma", "dos puntos", "nueva línea".
- Incluí a propósito al menos **2 usos clínicos de "coma"** (p. ej., "ingresó en coma") y
  **2 de "punto"** (p. ej., "punto de corte", "punto de inserción"). Así se prueban las reglas de exclusión.

**Terminología.** En total, que aparezcan al menos una vez:

| Grupo | Términos |
|---|---|
| Vasopresores e inotrópicos | noradrenalina, vasopresina, adrenalina, dobutamina, milrinona |
| Sedoanalgesia y relajantes | propofol, midazolam, fentanilo, remifentanilo, dexmedetomidina, ketamina, rocuronio, cisatracurio |
| Antibióticos | piperacilina-tazobactam, meropenem, vancomicina, colistín, ceftazidima-avibactam, linezolid, ampicilina-sulbactam |
| Escalas | SOFA, APACHE II, Glasgow, RASS, CAM-ICU |
| Ventilación | PEEP, FiO2, volumen tidal (o corriente), presión meseta, driving pressure, PaFi, prono, modo controlado por volumen o presión |
| Gasometría y laboratorio | pH, pCO2, PaO2, bicarbonato, láctico, exceso de base, procalcitonina, PCR |
| Ecografía y POCUS | FATE, RUSH, eFAST, VExUS, TAPSE, VTI, vena cava inferior, líneas B |
| Microbiología | hemocultivos, urocultivo, minibal o BAL, KPC, BLEE, Acinetobacter, SAMR |
| Dispositivos y vías | CVC (yugular o subclavio), catéter arterial, tubo endotraqueal, traqueostomía, SNG, sonda vesical, drenaje pleural |

**Números con unidades.** Dosis y valores con decimales, por ejemplo: "noradrenalina a 0,3 gammas",
"láctico 3,2", "PEEP 10", "FiO2 60 %", "diuresis 0,5 mililitros por kilo por hora".

**Ruido.** Unos 6 de los 20 con ruido de fondo **sin voces** (ver §1).

## 5. Guiones ya redactados

Los 20 guiones están en [`tests/fixtures/dictados/`](../tests/fixtures/dictados/README.md) y cumplen
esta cobertura. Revisalos, adaptalos a tu forma de dictar (si cambiás algo, actualizá el `.txt`)
y grabalos.
