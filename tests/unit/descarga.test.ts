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

const soloEncabezados = () => new Response(null, { status: 200, headers: { 'content-length': String(datos.length) } });

/** Simula la red: los HEAD devuelven solo encabezados; los GET, lo que diga `get`. */
function simularRed(get: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const pedidos: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    const rango = (init?.headers as Record<string, string> | undefined)?.Range;
    pedidos.push(`${metodo} ${url.split('/').pop()}${rango ? ` ${rango}` : ''}`);
    return metodo === 'HEAD' ? soloEncabezados() : get(url, init);
  }));
  return pedidos;
}

async function leerTodo(r: Response): Promise<Uint8Array> {
  return new Uint8Array(await r.arrayBuffer());
}

afterEach(() => vi.unstubAllGlobals());

describe('descarga resistente de modelos', () => {
  it('reanuda con un pedido por rango cuando la conexión se corta', async () => {
    const pedidos = simularRed(async (_url, init) => {
      const rango = (init?.headers as Record<string, string> | undefined)?.Range;
      if (!rango) return respuestaQueSeCorta(0, 400);
      return respuestaQueSeCorta(Number(rango.match(/bytes=(\d+)-/)![1]), 1000, 206);
    });
    const r = await descargaResistente('/pase-guardia/modelos/x.onnx');
    expect(await leerTodo(r)).toEqual(datos);
    expect(pedidos).toEqual(['HEAD x.onnx', 'GET x.onnx', 'GET x.onnx bytes=400-']);
  });

  it('si el servidor ignora el rango, descarta lo ya recibido', async () => {
    let n = 0;
    simularRed(() => (n++ === 0 ? respuestaQueSeCorta(0, 300) : respuestaQueSeCorta(0, 1000)));
    expect(await leerTodo(await descargaResistente('/pase-guardia/modelos/x.onnx'))).toEqual(datos);
  });

  it('reintenta si el primer pedido falla antes de empezar', async () => {
    let n = 0;
    simularRed(() => {
      if (n++ < 2) throw new TypeError('Load failed');
      return respuestaQueSeCorta(0, 1000);
    });
    expect(await leerTodo(await descargaResistente('/pase-guardia/modelos/x.onnx'))).toEqual(datos);
  }, 10000);

  it('si solo se leen los encabezados, no descarga el archivo', async () => {
    // Así consulta Transformers.js el tamaño de cada archivo antes de cargarlo.
    const pedidos = simularRed(() => respuestaQueSeCorta(0, 1000));
    const r = await descargaResistente('/pase-guardia/modelos/x.onnx');
    expect(r.headers.get('content-length')).toBe('1000');
    await new Promise((res) => setTimeout(res, 20));
    expect(pedidos).toEqual(['HEAD x.onnx']);
  });

  it('descarga los pesos de a uno aunque se pidan a la vez', async () => {
    // El cuerpo de "a" no termina hasta que la prueba lo suelta.
    let soltarA!: () => void;
    const finA = new Promise<void>((r) => (soltarA = r));
    const pedidos = simularRed((url) => {
      if (!url.endsWith('a.onnx')) return respuestaQueSeCorta(0, 1000);
      let paso = 0;
      return new Response(
        new ReadableStream<Uint8Array>({
          async pull(ctrl) {
            if (paso++ === 0) return ctrl.enqueue(datos.slice());
            await finA;
            ctrl.close();
          },
        }),
        { headers: { 'content-length': String(datos.length) } },
      );
    });
    const [a, b] = await Promise.all([
      descargaResistente('/pase-guardia/modelos/a.onnx'),
      descargaResistente('/pase-guardia/modelos/b.onnx'),
    ]);
    const lecturaA = leerTodo(a); // a empieza a leer primero: tiene el turno
    const lectorB = b.body!.getReader();
    const primeroB = lectorB.read(); // b espera
    await new Promise((res) => setTimeout(res, 20));
    expect(pedidos).toEqual(['HEAD a.onnx', 'HEAD b.onnx', 'GET a.onnx']);
    soltarA();
    expect(await lecturaA).toEqual(datos);
    expect((await primeroB).done).toBe(false); // recién al terminar a, empieza b
    expect(pedidos).toEqual(['HEAD a.onnx', 'HEAD b.onnx', 'GET a.onnx', 'GET b.onnx']);
    while (!(await lectorB.read()).done) { /* termina b y libera el turno */ }
  });

  it('los archivos chicos (JSON) se piden directamente', async () => {
    const pedidos = simularRed(() => respuestaQueSeCorta(0, 1000));
    expect(await leerTodo(await descargaResistente('/pase-guardia/modelos/config.json'))).toEqual(datos);
    expect(pedidos).toEqual(['GET config.json']);
  });
});
