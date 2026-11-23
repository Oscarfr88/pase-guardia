import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aciertoTerminos, calcularWER, normalizarParaMetricas, numerosADigitos, werDeTextos } from '../../src/utils/metricas';

describe('números en palabras', () => {
  it('convierte a dígitos', () => {
    expect(numerosADigitos('treinta y cinco'.split(' '))).toEqual(['35']);
    expect(numerosADigitos('veinticinco mil'.split(' '))).toEqual(['25000']);
    expect(numerosADigitos('dos mil cuatrocientos'.split(' '))).toEqual(['2400']);
    expect(numerosADigitos('ciento ochenta'.split(' '))).toEqual(['180']);
    expect(numerosADigitos('cinco seis'.split(' '))).toEqual(['5', '6']);
    expect(numerosADigitos('un paciente'.split(' '))).toEqual(['un', 'paciente']);
  });
});

describe('normalización para WER', () => {
  it('equipara formas habladas y escritas', () => {
    const iguales: [string, string][] = [
      ['FiO2 50 %', 'fio2 cincuenta por ciento'],
      ['noradrenalina a 0,15 gammas', 'noradrenalina a cero coma quince gammas'],
      ['troponina 25.000', 'troponina veinticinco mil'],
      ['30 ml/kg de cristaloides', 'treinta mililitros por kilo de cristaloides'],
      ['pH 7.35', 'ph 7,35'],
      ['piperacilina-tazobactam', 'piperacilina tazobactam'],
    ];
    for (const [a, b] of iguales) expect(normalizarParaMetricas(a)).toEqual(normalizarParaMetricas(b));
  });

  it('conserva las tildes por defecto', () => {
    expect(werDeTextos('colistín', 'colistin').wer).toBe(1);
    expect(werDeTextos('colistín', 'colistin', { conTildes: false }).wer).toBe(0);
  });
});

describe('WER', () => {
  it('cuenta sustituciones, borrados e inserciones', () => {
    expect(calcularWER(['a', 'b', 'c'], ['a', 'b', 'c']).wer).toBe(0);
    expect(calcularWER(['a', 'b', 'c'], ['a', 'x', 'c'])).toMatchObject({ sustituciones: 1, borrados: 0, inserciones: 0 });
    expect(calcularWER(['a', 'b', 'c'], ['a', 'c'])).toMatchObject({ borrados: 1 });
    expect(calcularWER(['a', 'b'], ['a', 'b', 'c'])).toMatchObject({ inserciones: 1, wer: 0.5 });
  });
});

describe('acierto en términos médicos', () => {
  it('exige la forma correcta (con tildes), sin distinguir mayúsculas ni guiones', () => {
    const r = aciertoTerminos(['FiO2', 'piperacilina-tazobactam', 'colistín'], 'fio2 60 % y piperacilina tazobactam, colistin');
    expect(r.aciertos).toBe(2);
    expect(r.faltantes).toEqual(['colistín']);
  });
});

describe('dictados sintéticos', () => {
  const dir = new URL('../fixtures/dictados/', import.meta.url);
  for (let n = 1; n <= 20; n++) {
    const nn = String(n).padStart(2, '0');
    it(`dictado ${nn}: todos los términos esperados figuran en el texto de referencia`, () => {
      const texto = readFileSync(new URL(`dictado-${nn}.txt`, dir), 'utf8');
      const terminos = readFileSync(new URL(`dictado-${nn}.terminos.txt`, dir), 'utf8').split('\n').filter(Boolean);
      expect(aciertoTerminos(terminos, texto).faltantes).toEqual([]);
    });
  }
});
