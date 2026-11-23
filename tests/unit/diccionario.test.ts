import { describe, expect, it } from 'vitest';
import base from '../../src/data/diccionario-base.json';
import type { Diccionario } from '../../src/types';
import {
  agregarTermino,
  exportarDiccionario,
  importarDiccionario,
  terminosParaSesgo,
  validarDiccionario,
} from '../../src/utils/diccionario';
import { compilarDiccionario, postprocesar } from '../../src/utils/postproceso';

const dic = base as Diccionario;
const vacio: Diccionario = { formato: 'pase-guardia/diccionario', version: 1, terminos: [] };

describe('diccionario base', () => {
  it('es válido: sin duplicados ni variantes que apunten a dos términos', () => {
    const { ok, problemas } = validarDiccionario(dic);
    expect(problemas).toEqual([]);
    expect(ok).toBe(true);
  });

  it('cubre todas las categorías pedidas', () => {
    const categorias = new Set(dic.terminos.map((t) => t.categoria));
    for (const c of ['farmacos', 'escalas', 'ventilacion', 'gasometria_laboratorio', 'ecografia_pocus', 'microbiologia', 'procedimientos', 'dispositivos_vias']) {
      expect(categorias.has(c as never)).toBe(true);
    }
    for (const t of ['SOFA', 'APACHE II', 'Glasgow', 'RASS', 'CAM-ICU', 'FATE', 'RUSH', 'eFAST', 'VExUS', 'TAPSE', 'VTI', 'vena cava inferior']) {
      expect(dic.terminos.some((x) => x.termino === t)).toBe(true);
    }
  });
});

describe('alta de términos desde la interfaz', () => {
  it('crea un término nuevo e incrementa la versión', () => {
    const r = agregarTermino(vacio, { termino: 'cefiderocol', variantes: ['cefi de rocol'], categoria: 'farmacos' });
    expect(r.accion).toBe('creado');
    expect(r.diccionario.version).toBe(2);
    expect(r.termino).toMatchObject({ termino: 'cefiderocol', variantes: ['cefi de rocol'], origen: 'usuario', sesgo: true });
  });

  it('no duplica: si el término existe (sin importar mayúsculas ni tildes), fusiona las variantes', () => {
    const r1 = agregarTermino(dic, { termino: 'NORADRENALINA', variantes: ['nor adrenalína', 'noradre nalina'], categoria: 'farmacos' });
    expect(r1.accion).toBe('fusionado');
    expect(r1.diccionario.terminos.filter((t) => t.termino.toLowerCase() === 'noradrenalina')).toHaveLength(1);
    expect(r1.termino.variantes).toContain('noradre nalina');
    // "nor adrenalína" ya existía (sin tilde): no se repite
    expect(r1.termino.variantes.filter((v) => v.startsWith('nor adrenal'))).toHaveLength(1);

    const r2 = agregarTermino(r1.diccionario, { termino: 'noradrenalina', variantes: ['noradre nalina'], categoria: 'farmacos' });
    expect(r2.accion).toBe('sin_cambios');
    expect(r2.diccionario).toBe(r1.diccionario);
  });

  it('rechaza una variante que ya corrige otro término', () => {
    const r = agregarTermino(dic, { termino: 'adrenalina', variantes: ['nor adrenalina'], categoria: 'farmacos' });
    expect(r.conflictos).toEqual([{ variante: 'nor adrenalina', terminoExistente: 'noradrenalina' }]);
  });

  it('no modifica el diccionario original (las transcripciones previas no cambian)', () => {
    const antes = JSON.stringify(dic);
    agregarTermino(dic, { termino: 'Tazobactam', variantes: [], categoria: 'farmacos' });
    expect(JSON.stringify(dic)).toBe(antes);
  });

  it('la palabra agregada se aplica en la siguiente transcripción', () => {
    const textoModelo = 'se rotó a cefi de rocol';
    const antes = postprocesar(textoModelo, compilarDiccionario(dic)).texto;
    const { diccionario } = agregarTermino(dic, { termino: 'cefiderocol', variantes: ['cefi de rocol'], categoria: 'farmacos' });
    const despues = postprocesar(textoModelo, compilarDiccionario(diccionario)).texto;
    expect(antes).toBe('se rotó a cefi de rocol');
    expect(despues).toBe('se rotó a cefiderocol');
  });
});

describe('importación y exportación', () => {
  it('exporta y vuelve a importar sin cambios', () => {
    const { diccionario, agregados, fusionados } = importarDiccionario(vacio, exportarDiccionario(dic));
    expect(agregados).toBe(dic.terminos.length);
    expect(fusionados).toBe(0);
    expect(diccionario.terminos.map((t) => t.termino)).toEqual(dic.terminos.map((t) => t.termino));
  });

  it('fusiona un archivo importado sin duplicar', () => {
    const archivo = JSON.stringify({
      formato: 'pase-guardia/diccionario',
      version: 3,
      terminos: [
        { termino: 'Noradrenalina', variantes: ['noradrenalína x'], categoria: 'farmacos', origen: 'usuario', sesgo: true },
        { termino: 'remimazolam', variantes: ['remi mazolam'], categoria: 'farmacos', origen: 'usuario', sesgo: true },
      ],
    });
    const r = importarDiccionario(dic, archivo);
    expect(r.agregados).toBe(1);
    expect(r.fusionados).toBe(1);
    expect(r.diccionario.terminos.length).toBe(dic.terminos.length + 1);
  });

  it('rechaza archivos inválidos', () => {
    expect(() => importarDiccionario(dic, 'no es json')).toThrow(/JSON/);
    expect(() => importarDiccionario(dic, JSON.stringify({ formato: 'otro', terminos: [] }))).toThrow(/formato/);
    expect(() =>
      importarDiccionario(dic, JSON.stringify({ formato: 'pase-guardia/diccionario', terminos: [{ termino: 'x', variantes: [], categoria: 'inventada' }] })),
    ).toThrow(/categoría/);
  });
});

describe('prompt de sesgo', () => {
  it('prioriza los términos del usuario, del más reciente al más antiguo', () => {
    let d = dic;
    d = agregarTermino(d, { termino: 'remimazolam', variantes: [], categoria: 'farmacos' }).diccionario;
    d = agregarTermino(d, { termino: 'cefiderocol x', variantes: [], categoria: 'farmacos' }).diccionario;
    const lista = terminosParaSesgo(d);
    expect(lista.slice(0, 2)).toEqual(['cefiderocol x', 'remimazolam']);
    expect(lista).toContain('noradrenalina');
    expect(lista).not.toContain('dopamina'); // base sin sesgo
  });
});
