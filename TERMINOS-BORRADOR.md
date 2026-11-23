# Términos de uso — BORRADOR

> **Borrador pendiente de revisión legal. No está vigente.**
> Redactado como punto de partida técnico: no es asesoramiento jurídico. Los campos entre
> corchetes `[ ]` los completa la asesoría legal. Al final hay notas con los puntos que conviene revisar.

**Aplicación:** Pase de Guardia UTI (en adelante, "la Aplicación")
**Titular:** [NOMBRE DEL TITULAR] (en adelante, "el Autor")
**Versión del borrador:** 0.1 — 23/11/2026

---

## 1. Qué es la Aplicación

1.1. La Aplicación es una herramienta de **documentación personal** para profesionales médicos.
Permite dictar un resumen de pase de guardia, transcribirlo en el propio dispositivo y ordenarlo
en secciones para su revisión, edición y exportación.

1.2. La Aplicación **no genera contenido clínico**. No diagnostica, no indica tratamientos, no
calcula dosis, no interpreta resultados y no completa ni sugiere información clínica. Se limita a
transcribir y ordenar lo que el usuario dicta.

1.3. La Aplicación **no es un producto médico evaluado ni registrado** ante la Administración
Nacional de Medicamentos, Alimentos y Tecnología Médica (ANMAT) ni ante ninguna otra autoridad
sanitaria.

1.4. La Aplicación **no reemplaza la historia clínica** ni ningún otro registro institucional u
obligatorio. No es una herramienta de ninguna institución ni servicio de salud.

## 2. Responsabilidad del usuario

2.1. El usuario debe ser un profesional de la salud habilitado y usa la Aplicación bajo su
exclusiva responsabilidad profesional.

2.2. La transcripción automática **puede contener errores**: palabras mal reconocidas, omisiones,
cifras o unidades incorrectas, o texto asignado a una sección equivocada. **El usuario debe
revisar cada documento** antes de confirmarlo, firmarlo, transmitirlo o usarlo para cualquier fin.

2.3. El usuario es el único responsable del contenido que dicta, edita, confirma, exporta, firma o
comparte.

2.4. El usuario es responsable de cumplir la normativa aplicable a la información de salud que
maneja, en particular la Ley 25.326 de Protección de los Datos Personales (los datos de salud son
datos sensibles), la Ley 26.529 de Derechos del Paciente, Historia Clínica y Consentimiento
Informado, y las normas y políticas de la institución donde trabaja.

2.5. Se recomienda **no consignar datos identificatorios** de pacientes (nombre, DNI, número de
historia clínica, fecha de nacimiento, domicilio, etc.), ni en los campos de identificación ni en
el dictado. La Aplicación está diseñada para identificar a los pacientes solo por cama o alias.

## 3. Datos y privacidad

3.1. Todo el procesamiento (grabación, transcripción, estructuración, almacenamiento y
exportación) ocurre **en el dispositivo del usuario**. La Aplicación no envía audio, texto ni
ningún otro dato a servidores del Autor ni de terceros. **El Autor no recibe, no almacena y no
tiene acceso** a la información que el usuario registra.

3.2. Los datos se guardan en el dispositivo cifrados con una clave derivada de la contraseña que
elige el usuario. **Si la contraseña se pierde, los datos no se pueden recuperar.** Ni el Autor ni
nadie más puede restablecerla.

3.3. El usuario es responsable de:
(a) la seguridad física y lógica de su dispositivo;
(b) la confidencialidad de su contraseña;
(c) los archivos que exporte (por ejemplo, `.docx` o texto copiado al portapapeles), que **quedan
sin cifrar** fuera de la Aplicación;
(d) las copias de seguridad que considere necesarias.

3.4. La Aplicación se descarga desde un servicio de alojamiento de terceros (GitHub Pages). Como
cualquier sitio web, ese servicio puede registrar datos técnicos de acceso (por ejemplo, dirección
IP y tipo de navegador) al descargar la Aplicación o el modelo de transcripción. Por esa vía no se
transmiten datos clínicos.

3.5. Ni los dictados ni el diccionario personal se usan para entrenar modelos de ningún tipo.

## 4. Ausencia de garantía

4.1. La Aplicación se ofrece **"tal como está" y "según disponibilidad"**, en forma gratuita y sin
garantías de ningún tipo, expresas ni implícitas. Esto incluye, entre otras, garantías de exactitud
de la transcripción, idoneidad para un fin determinado, disponibilidad continua o ausencia de errores.

4.2. El Autor puede modificar, suspender o discontinuar la Aplicación en cualquier momento, sin
obligación de aviso previo.

## 5. Limitación de responsabilidad

5.1. En la máxima medida permitida por la ley aplicable, el Autor no responde por daños directos o
indirectos derivados del uso o de la imposibilidad de uso de la Aplicación. Esto incluye, entre
otros, los daños derivados de errores de transcripción, pérdida de datos, decisiones clínicas o
acceso no autorizado al dispositivo del usuario.

5.2. [Ajustar según el alcance que admita la ley aplicable — ver notas.]

## 6. Propiedad intelectual y licencia

6.1. El código fuente se publica en `github.com/Oscarfr88/pase-guardia`. La licencia propuesta es
Apache-2.0, pendiente de revisión legal. Hasta que se adopte formalmente, todos los derechos están
reservados.

6.2. La Aplicación usa componentes de terceros (entre ellos, el modelo de reconocimiento de voz
Whisper) con sus propias licencias, que se detallan en la sección "Licencias de terceros" de la
Aplicación y en el README del repositorio.

## 7. Aceptación

7.1. El usuario acepta estos términos al marcar la casilla de aceptación en la pantalla de primer
uso. Si no los acepta, no debe usar la Aplicación.

7.2. Si los términos cambian, la Aplicación pide aceptarlos de nuevo.

## 8. Ley aplicable y jurisdicción

8.1. [A definir por la asesoría legal. Propuesta inicial: leyes de la República Argentina;
tribunales ordinarios de la ciudad de Córdoba.]

---

## Notas para la revisión legal

1. **Encuadre regulatorio (ANMAT).** Confirmar que una herramienta que solo transcribe y ordena el
   dictado del médico, sin funciones de diagnóstico, cálculo ni recomendación, no queda alcanzada
   por la normativa de productos médicos ni de software como producto médico. Confirmar también
   si conviene mantener la mención expresa de "no registrada".
2. **Ley 25.326.** El Autor no recibe ni trata datos: todo queda en el dispositivo del usuario.
   Evaluar si de todos modos corresponde alguna obligación del Autor (por ejemplo, de información)
   o si el usuario es el único responsable del tratamiento.
3. **Ley 26.529 / historia clínica.** Revisar la redacción de "no reemplaza la historia clínica"
   y si el documento exportado puede considerarse parte de ella cuando el médico lo incorpora.
4. **Alcance de la limitación de responsabilidad.** El Código Civil y Comercial (art. 1743)
   restringe las cláusulas de dispensa anticipada de responsabilidad. Revisar qué redacción es
   válida para una herramienta gratuita y de código abierto, y si aplica la Ley 24.240 de Defensa
   del Consumidor.
5. **Licencia.** La propuesta es Apache-2.0 (permisiva; con cláusulas de ausencia de garantía y
   limitación de responsabilidad; licencia de patentes; no autoriza el uso del nombre; obliga a
   marcar las modificaciones). Alternativas: MIT o AGPL-3.0. Confirmar la compatibilidad con las
   licencias de las dependencias (todas permisivas: MIT, Apache-2.0, ISC y OFL-1.1 para la tipografía).
6. **Repositorio público sin licencia.** Hasta que se agregue el archivo `LICENSE` rigen todos los
   derechos reservados. Igualmente, los Términos de Servicio de GitHub conceden a sus usuarios el
   derecho de ver y bifurcar (fork) repositorios públicos dentro de la plataforma.
7. **Forma de aceptación.** Casilla en la pantalla de primer uso con registro local (fecha y
   versión aceptada). Evaluar si es suficiente.
