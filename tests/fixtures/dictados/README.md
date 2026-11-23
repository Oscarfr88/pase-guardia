# Dictados de prueba (sintéticos)

Son 20 casos **totalmente ficticios** de UTI. Sirven para medir el motor de transcripción (etapa 2)
y para probar la estructuración (etapa 3). Los preparó el equipo de desarrollo siguiendo
[docs/guia-dictados-prueba.md](../../../docs/guia-dictados-prueba.md). El médico los revisa, los
adapta a su forma de dictar y los graba.

**Los audios nunca se suben a este repositorio**: el `.gitignore` los excluye.

## Archivos por dictado

| Archivo | Para qué sirve |
|---------|----------------|
| `dictado-NN.txt` | El guion que se lee, y a la vez la **referencia literal** de lo que se dice. Si al grabar cambiás una palabra, corregí este archivo para que coincida con el audio. |
| `dictado-NN.terminos.txt` | Los términos médicos esperados, en su forma correcta (tasa de acierto en términos). |
| `dictado-NN.esperado.txt` | Solo en los dictados con puntuación hablada: el texto final esperado después del post-proceso (puntuación convertida, unidades abreviadas). |
| `indice.json` | Tipo, puntuación, ruido y escenario de cada dictado. |

## Cómo leerlos

- **Ritmo de pase real**, con el teléfono a 20–30 cm.
- **Números:** leelos como los dirías normalmente. "0,15 gammas" se lee "cero coma quince gammas";
  "25.000" se lee "veinticinco mil".
- **Dictados SIN puntuación hablada:** los signos de puntuación del texto **no se dicen**. Son pausas.
- **Dictados CON puntuación hablada** (03, 07, 11, 15, 18, 20): el texto no tiene signos. Decí
  **tal cual** las palabras "punto y aparte", "punto seguido", "dos puntos" y "coma".
  Fijate que en esos mismos textos también hay "coma" con sentido clínico ("ingresó en coma",
  "coma barbitúrico"), "coma" decimal ("0,15") y "punto" con sentido propio ("punto de corte",
  "punto de inserción"). Están a propósito, para probar que la app no los convierta en signos.
- **Ruido de fondo** (04, 08, 12, 16, 19, 20): grabalos con ruido **sin voces** (monitores,
  alarmas, ventilación). Ver la guía.

## Resumen

| # | Tipo | Puntuación hablada | Ruido | Escenario |
|---|------|:--:|:--:|-----------|
| 01 | marcadores | | | Shock séptico de foco abdominal (postoperatorio) |
| 02 | marcadores | | | SDRA grave por neumonía, decúbito prono |
| 03 | marcadores | ✓ | | Recuperación de paro cardíaco, control de temperatura |
| 04 | marcadores | | ✓ | TEC grave con monitoreo de PIC |
| 05 | marcadores (orden alterado) | | | Cetoacidosis diabética |
| 06 | marcadores | | | IAM con shock cardiogénico y balón de contrapulsación |
| 07 | marcadores | ✓ | | Estado de mal epiléptico ("ingresó en coma") |
| 08 | marcadores | | ✓ | Pancreatitis aguda grave con hipertensión intraabdominal |
| 09 | marcadores | | | EPOC exacerbado en ventilación no invasiva |
| 10 | marcadores | | | Hemorragia digestiva alta variceal en cirrosis |
| 11 | marcadores | ✓ | | HSA con vasoespasmo ("coma barbitúrico") |
| 12 | marcadores | | ✓ | Politraumatizado, eFAST y RUSH |
| 13 | marcadores | | | Sepsis urinaria por KPC en trasplantado renal |
| 14 | marcadores (orden alterado) | | | Postoperatorio de revascularización miocárdica |
| 15 | sin marcadores | ✓ | | NAV por SAMR ("punto de corte") |
| 16 | sin marcadores | | ✓ | TEP de alto riesgo con trombolisis |
| 17 | sin marcadores | | | Falla hepática aguda por paracetamol |
| 18 | sección repetida | ✓ | | Shock hemorrágico postoperatorio ("punto de inserción") |
| 19 | sección repetida | | ✓ | Neumonía por influenza A en ECMO |
| 20 | sección repetida | ✓ | ✓ | Guillain-Barré en ventilación mecánica |

Son unas 3.800 palabras en total: entre 1 y 1,5 minutos por dictado, unos 30 minutos de grabación.

## Entrega de los audios

Guardalos **fuera del repositorio**, en una carpeta hermana `../pase-guardia-dictados/`, con los
nombres `dictado-01.m4a` … `dictado-20.m4a`.
