import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import base from '../../src/data/diccionario-base.json';
import type { Diccionario } from '../../src/types';
import {
  aplicarPuntuacionDictada,
  compilarDiccionario,
  postprocesar,
} from '../../src/utils/postproceso';

const dic = base as Diccionario;
const indice = compilarDiccionario(dic);
const pp = (t: string) => postprocesar(t, indice).texto;
const fixture = (n: string, ext: string) =>
  readFileSync(new URL(`../fixtures/dictados/dictado-${n}.${ext}`, import.meta.url), 'utf8').trim();

describe('diccionario: variante → término', () => {
  it('corrige variantes de reconocimiento', () => {
    expect(pp('nor adrenalina a 0,3 gammas')).toBe('noradrenalina a 0,3 gammas');
    expect(pp('PEEP 8, fi o dos 50 %')).toBe('PEEP 8, FiO2 50 %');
    expect(pp('gasometría con ph 7,28 y pe ce o dos 58')).toBe('gasometría con pH 7,28 y pCO2 58');
  });

  it('registra cada cambio para resaltarlo en la revisión', () => {
    const r = postprocesar('inicia vanco micina', indice);
    expect(r.cambios).toContainEqual({ tipo: 'diccionario', desde: 'vanco micina', hacia: 'vancomicina' });
  });

  it('respeta la mayúscula inicial de una frase', () => {
    expect(pp('Nor adrenalina en descenso.')).toBe('Noradrenalina en descenso.');
  });

  it('corrige mayúsculas de siglas y epónimos', () => {
    expect(pp('glasgow 15, peep 5 y vexus grado 1')).toBe('Glasgow 15, PEEP 5 y VExUS grado 1');
  });

  it('prefiere la coincidencia más larga', () => {
    expect(pp('día 4 de ceftazidima avibactam')).toBe('día 4 de ceftazidima-avibactam');
    expect(pp('piperacilina-tazobactam desde el ingreso')).toBe('piperacilina-tazobactam desde el ingreso');
  });

  it('no une palabras separadas por puntuación', () => {
    expect(pp('pa. Fi')).toBe('pa. Fi');
  });

  it('no captura secuencias de letras sueltas', () => {
    expect(pp('relación e a normal')).toBe('relación e a normal');
    expect(pp('relación e sobre a de 0,8')).toBe('relación E/A de 0,8');
  });

  it('no cambia sinónimos ni nombres de otros fármacos', () => {
    expect(pp('metilprednisona 40 mg')).toBe('metilprednisona 40 mg');
    expect(pp('vena cava superior')).toBe('vena cava superior');
    expect(pp('antecedente de diabetes')).toBe('antecedente de diabetes');
  });
});

describe('puntuación dictada', () => {
  const punt = (t: string) => aplicarPuntuacionDictada(t, []);

  it('convierte los comandos básicos', () => {
    expect(punt('Cama 3 punto y aparte Diagnóstico dos puntos shock séptico punto y aparte')).toBe(
      'Cama 3.\nDiagnóstico: shock séptico.',
    );
    expect(punt('estable punto seguido sin vasopresores')).toBe('estable. Sin vasopresores');
  });

  it('respeta "coma" con sentido clínico', () => {
    expect(punt('ingresó en coma con Glasgow de 5')).toBe('ingresó en coma con Glasgow de 5');
    expect(punt('se inició coma barbitúrico con tiopental')).toBe('se inició coma barbitúrico con tiopental');
    expect(punt('estado de coma profundo')).toBe('estado de coma profundo');
  });

  it('distingue la coma decimal', () => {
    expect(punt('noradrenalina a 0 coma 15 gammas')).toBe('noradrenalina a 0,15 gammas');
    expect(punt('noradrenalina a cero coma quince gammas')).toBe('noradrenalina a cero coma quince gammas');
    expect(punt('Fisher 4 coma Hunt y Hess 4')).toBe('Fisher 4, Hunt y Hess 4');
  });

  it('respeta "punto" con sentido propio', () => {
    expect(punt('por encima del punto de corte coma en 4,6')).toBe('por encima del punto de corte, en 4,6');
    expect(punt('sin signos de infección en el punto de inserción')).toBe('sin signos de infección en el punto de inserción');
  });

  it('respeta "dos puntos" cuando no es el signo', () => {
    expect(punt('el Glasgow bajó dos puntos en la noche')).toBe('el Glasgow bajó dos puntos en la noche');
    expect(punt('Plan dos puntos seguir igual')).toBe('Plan: seguir igual');
  });

  it('fusiona la puntuación que ya puso el modelo', () => {
    expect(punt('estable, coma, sin vasopresores.')).toBe('estable, sin vasopresores.');
    expect(punt('Riesgo dos puntos: inestable. Punto y aparte.')).toBe('Riesgo: inestable.');
  });

  it('se puede desactivar', () => {
    expect(postprocesar('estable coma sin drogas', indice, { puntuacionDictada: false, comaDecimal: true, abreviarUnidades: true }).texto).toBe(
      'estable coma sin drogas',
    );
  });
});

describe('unidades y decimales', () => {
  it('abrevia unidades solo después de un número', () => {
    expect(pp('reanimación con 30 mililitros por kilo de cristaloides')).toBe('reanimación con 30 ml/kg de cristaloides');
    expect(pp('diuresis de 0,6 mililitros por kilo por hora')).toBe('diuresis de 0,6 ml/kg/h');
    expect(pp('10 a la 5 unidades formadoras de colonias por mililitro')).toBe('10 a la 5 unidades formadoras de colonias por mililitro');
  });

  it('no abrevia "unidades", "gammas" ni "grados"', () => {
    expect(pp('vasopresina a 0,03 unidades por minuto')).toBe('vasopresina a 0,03 unidades por minuto');
    expect(pp('cabecera a 30 grados y noradrenalina a 0,1 gammas')).toBe('cabecera a 30 grados y noradrenalina a 0,1 gammas');
  });

  it('normaliza el signo de porcentaje', () => {
    expect(pp('FiO2 40%')).toBe('FiO2 40 %');
    expect(pp('FiO2 40 por ciento')).toBe('FiO2 40 %');
  });

  it('usa coma decimal sin tocar miles ni horas', () => {
    expect(pp('pH 7.35')).toBe('pH 7,35');
    expect(pp('milrinona a 0.375 gammas')).toBe('milrinona a 0,375 gammas');
    expect(pp('troponina 25.000')).toBe('troponina 25.000');
    expect(pp('control a las 8.30')).toBe('control a las 8.30');
  });

  it('marca los números ambiguos sin cambiarlos', () => {
    const r = postprocesar('plaquetas 54,000', indice);
    expect(r.texto).toBe('plaquetas 54,000');
    expect(r.marcas[0]).toMatchObject({ tipo: 'ambiguo', texto: '54,000' });
  });
});

describe('marcas para revisión', () => {
  it('señala frases alucinadas sin borrarlas', () => {
    const r = postprocesar('Pendientes: ninguno. Subtítulos realizados por la comunidad de Amara.org', indice);
    expect(r.texto).toContain('Amara.org');
    expect(r.marcas.some((m) => m.tipo === 'alucinacion')).toBe(true);
  });

  it('señala bucles de repetición', () => {
    const r = postprocesar('sin cambios sin cambios sin cambios sin cambios', indice);
    expect(r.marcas.some((m) => m.tipo === 'repeticion')).toBe(true);
  });
});

describe('dictados sintéticos con puntuación hablada', () => {
  for (const n of ['03', '07', '11', '15', '18', '20']) {
    it(`dictado ${n}: el texto literal se convierte en el texto esperado`, () => {
      const literal = fixture(n, 'txt').replace(/\n/g, ' ');
      expect(pp(literal)).toBe(fixture(n, 'esperado.txt'));
    });
  }
});
