// ============================================================
// Descarga de modelos tolerante a cortes de red (redes móviles, Wi-Fi de hospital).
// Devuelve una Response cuyo cuerpo se reanuda solo, con un pedido por rango
// (Range), si la conexión se corta a mitad de camino. No guarda copias extra en
// memoria: los bloques pasan directo a quien lee la respuesta.
// ============================================================

const MAX_INTENTOS = 6;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchConReintentos(url: string, init?: RequestInit): Promise<Response> {
  let ultimo: unknown;
  for (let i = 1; i <= MAX_INTENTOS; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      ultimo = e;
      await espera(800 * i);
    }
  }
  throw new Error(`No se pudo descargar ${url.split('/').slice(-2).join('/')}: ${String((ultimo as Error)?.message ?? ultimo)}`);
}

// Pesos del modelo (.onnx), con dos cuidados para no agotar la memoria del iPhone:
//  1. Transformers.js pide cada archivo una vez solo para leer su tamaño, sin leer
//     el cuerpo. Con un GET, Safari igual baja el archivo entero y lo retiene: el
//     modelo se descargaba dos veces a la vez. Por eso se responde con los
//     encabezados de un HEAD y el GET empieza recién cuando alguien lee el cuerpo.
//  2. Los pesos se descargan de a uno (Transformers.js pide codificador y
//     decodificador a la vez): así no se suman los dos búferes en tránsito.
let turno: Promise<void> = Promise.resolve();
const esPeso = (url: string) => /\.onnx(?:$|\?)/.test(url);

export async function descargaResistente(url: string, init?: RequestInit): Promise<Response> {
  if (!esPeso(url)) return descargar(url, init);

  const cabecera = await fetchConReintentos(url, { ...init, method: 'HEAD' });
  if (!cabecera.ok) return cabecera;

  let lector: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let liberar: () => void = () => undefined;
  const cuerpo = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      try {
        if (!lector) {
          const anterior = turno;
          turno = new Promise<void>((r) => (liberar = r));
          await anterior;
          const r = await descargar(url, init, () => liberar());
          if (!r.ok || !r.body) throw new Error(`HTTP ${r.status} al descargar ${url.split('/').pop()}`);
          lector = r.body.getReader();
        }
        const { done, value } = await lector.read();
        if (done) ctrl.close();
        else ctrl.enqueue(value);
      } catch (e) {
        liberar();
        ctrl.error(e);
      }
    },
    cancel(motivo) {
      lector?.cancel(motivo).catch(() => undefined);
      liberar();
    },
  }, { highWaterMark: 0 }); // 0: no lee por adelantado (si no, el GET arrancaría solo)
  return new Response(cuerpo, { status: 200, statusText: 'OK', headers: cabecera.headers });
}

async function descargar(url: string, init?: RequestInit, alTerminar: () => void = () => undefined): Promise<Response> {
  const primera = await fetchConReintentos(url, init);
  if (!primera.ok || !primera.body) {
    alTerminar();
    return primera;
  }
  const total = Number(primera.headers.get('content-length')) || 0;
  let lector = primera.body.getReader();
  let recibido = 0;
  let descartar = 0; // si el servidor ignora el rango, se saltean los bytes ya entregados
  let intentos = 0;

  const cuerpo = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      for (;;) {
        try {
          const { done, value } = await lector.read();
          if (done) {
            if (total && recibido < total) throw new Error(`descarga incompleta (${recibido} de ${total} bytes)`);
            ctrl.close();
            alTerminar();
            return;
          }
          let bloque = value;
          if (descartar > 0) {
            const n = Math.min(descartar, bloque.byteLength);
            descartar -= n;
            bloque = bloque.subarray(n);
            if (!bloque.byteLength) continue;
          }
          recibido += bloque.byteLength;
          ctrl.enqueue(bloque);
          return;
        } catch (e) {
          if (++intentos > MAX_INTENTOS) {
            ctrl.error(new Error(`Se cortó la descarga de ${url.split('/').pop()} y no se pudo reanudar: ${String((e as Error)?.message ?? e)}`));
            alTerminar();
            return;
          }
          await espera(1000 * intentos);
          try {
            const r = await fetch(url, { headers: { Range: `bytes=${recibido}-` } });
            if (r.status === 206 && r.body) {
              lector = r.body.getReader();
            } else if (r.ok && r.body) {
              lector = r.body.getReader();
              descartar = recibido;
            }
          } catch {
            /* sigue sin red: el próximo ciclo vuelve a intentar */
          }
        }
      }
    },
    cancel(motivo) {
      lector.cancel(motivo).catch(() => undefined);
      alTerminar();
    },
  });
  return new Response(cuerpo, { status: 200, statusText: 'OK', headers: primera.headers });
}
