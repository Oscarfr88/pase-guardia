import { afterEach, describe, expect, it, vi } from 'vitest';
import { descargaResistente } from '../../src/utils/descargaResistente';

const datos = new Uint8Array(1000).map((_, i) => i % 251);

/** Respuesta cuyo cuerpo entrega `hasta` bytes y después se corta (simula "Load failed"). */
function respuestaQueSeCorta(desde: number, hasta: number, status = 200): Response {
  let enviado = false;
  const cuerpo = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      if (!enviado) { enviado = true; ctrl.enqueue(datos.slice(desde, hasta)); return; }
      if (hasta < datos.length) ctrl.error(new TypeError('Load failed'));
      else ctrl.close();
    },
  });
  return new Response(cuerpo, { status, headers: { 'content-length': String(datos.length - desde) } });
}

async function leerTodo(r: Response): Promise<Uint8Array> {
  return new Uint8Array(await r.arrayBuffer());
}

afterEach(() => vi.unstubAllGlobals());

describe('descarga resistente de modelos', () => {
  it('reanuda con un pedido por rango cuando la conexión se corta', async () => {
    const pedidos: (string | null)[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const rango = (init?.headers as Record<string, string> | undefined)?.Range ?? null;
      pedidos.push(rango);
      if (!rango) return respuestaQueSeCorta(0, 400);
      const desde = Number(rango.match(/bytes=(\d+)-/)![1]);
      return respuestaQueSeCorta(desde, 1000, 206);
    }));
    const r = await descargaResistente('/pase-guardia/modelos/x.onnx');
    expect(await leerTodo(r)).toEqual(datos);
    expect(pedidos).toEqual([null, 'bytes=400-']);
  });

  it('si el servidor ignora el rango, descarta lo ya recibido', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => (n++ === 0 ? respuestaQueSeCorta(0, 300) : respuestaQueSeCorta(0, 1000))));
    expect(await leerTodo(await descargaResistente('/pase-guardia/modelos/x.onnx'))).toEqual(datos);
  });

  it('reintenta si el primer pedido falla antes de empezar', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (n++ < 2) throw new TypeError('Load failed');
      return respuestaQueSeCorta(0, 1000);
    }));
    expect(await leerTodo(await descargaResistente('/pase-guardia/modelos/x.onnx'))).toEqual(datos);
  }, 10000);
});
