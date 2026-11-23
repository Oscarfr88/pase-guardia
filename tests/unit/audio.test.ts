import { describe, expect, it } from 'vitest';
import { segmentarPorPausas } from '../../src/utils/audio';
import { hayBucle } from '../../src/utils/bucles';

const SR = 16000;

/** "Voz" (ruido) con pausas de silencio en los segundos indicados. */
function senial(segundos: number, pausas: [number, number][]): Float32Array {
  const a = new Float32Array(segundos * SR);
  let x = 12345;
  for (let i = 0; i < a.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    a[i] = ((x / 0x7fffffff) * 2 - 1) * 0.3;
  }
  for (const [ini, fin] of pausas) a.fill(0, ini * SR, fin * SR);
  return a;
}

describe('segmentación por pausas', () => {
  it('corta en los silencios y respeta el máximo de 28 s', () => {
    const tramos = segmentarPorPausas(senial(70, [[20, 20.6], [45, 45.6]]));
    expect(tramos.length).toBe(3);
    for (const t of tramos) expect((t.fin - t.inicio) / SR).toBeLessThanOrEqual(28.01);
    expect(tramos[0].fin / SR).toBeGreaterThan(19.9);
    expect(tramos[0].fin / SR).toBeLessThan(20.7);
    expect(tramos.at(-1)!.fin).toBe(70 * SR);
  });

  it('marca como silencio un tramo sin voz', () => {
    const tramos = segmentarPorPausas(new Float32Array(10 * SR));
    expect(tramos).toEqual([{ inicio: 0, fin: 10 * SR, silencio: true }]);
  });

  it('un audio corto queda en un solo tramo', () => {
    expect(segmentarPorPausas(senial(5, [])).length).toBe(1);
  });
});

describe('detección de bucles', () => {
  it('detecta repeticiones', () => {
    expect(hayBucle([1, 2, 3, 9, 9, 9, 9, 9])).toBe(true);
    expect(hayBucle([5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 7])).toBe(true);
    expect(hayBucle([1, 2, 3, 4, 5, 1, 2, 3])).toBe(false);
  });
});
