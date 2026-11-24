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

export async function descargaResistente(url: string, init?: RequestInit): Promise<Response> {
  const primera = await fetchConReintentos(url, init);
  if (!primera.ok || !primera.body) return primera;
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
    },
  });
  return new Response(cuerpo, { status: 200, statusText: 'OK', headers: primera.headers });
}
