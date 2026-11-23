import type { CategoriaTermino } from '../types';

export const CATEGORIAS: { id: CategoriaTermino; etiqueta: string }[] = [
  { id: 'farmacos', etiqueta: 'Fármacos' },
  { id: 'escalas', etiqueta: 'Escalas' },
  { id: 'ventilacion', etiqueta: 'Ventilación' },
  { id: 'gasometria_laboratorio', etiqueta: 'Gasometría y laboratorio' },
  { id: 'ecografia_pocus', etiqueta: 'Ecografía y POCUS' },
  { id: 'microbiologia', etiqueta: 'Microbiología' },
  { id: 'procedimientos', etiqueta: 'Procedimientos' },
  { id: 'dispositivos_vias', etiqueta: 'Dispositivos y vías' },
  { id: 'abreviaturas', etiqueta: 'Abreviaturas y siglas' },
  { id: 'diagnosticos_sindromes', etiqueta: 'Diagnósticos y síndromes' },
  { id: 'otros', etiqueta: 'Otros' },
];
