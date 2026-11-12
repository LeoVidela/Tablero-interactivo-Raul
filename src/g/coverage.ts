/* Cobertura de datos: para cada indicador, si el número que se ve es real (viene de la base), parcial o de demostración.
   Lo usan el detalle de cada indicador, el panel «Fuente de datos» y el asistente. */
import { isRealCell, SNAP, SOURCE } from '../data/source';
import { DERIVED, UNIT_NAMES, type UnitFilter, type UnitName, unitsOf } from './data';
import { METRICS, type MetricKey, type Target } from './metrics';

export type Cov = 'real' | 'parcial' | 'demo';

/** De qué campos del snapshot depende cada indicador. Los que empiezan con «hr.» salen de rrhh_mensual; «taller.ot» son las OT. */
const NEEDS: Record<MetricKey, string[]> = {
  cumpl: DERIVED.cumpl, reg: ['reg'], kmExec: ['kmExec'], disp: DERIVED.disp, oper: ['oper'], out: ['out'], aux: ['aux'], aus: ['aus'], cob: ['cob'],
  sin: ['sin'], exc: ['exc'], cost: ['cost'], inc: ['inc'], margin: DERIVED.margin, pax: ['pax'], ipk: DERIVED.ipk,
  otOpen: ['otOpen'], otClosed: ['otClosed'], prevDone: ['prevDone'], prevPend: ['prevPend'], reinc: ['reinc'], repTime: ['repTime'], personal: ['personal'], horas: ['horas'],
  lts: ['lts'], kmpl: DERIVED.kmpl, gastoRep: ['taller.ot'], gastoTot: ['taller.ot'], costoMantKm: ['taller.ot', 'kmExec'],
  incid: ['seg.incidentes'], lesion: ['seg.lesionados'], sinResp: ['seg.responsabilidad'],
  activos: ['hr.activos'], altas: ['hr.altas'], bajas: ['hr.bajas'], ausDias: ['hr.ausDias'], artDias: ['hr.artDias'], carpDias: ['hr.carpDias'],
};
/** Indicadores que el tablero calcula desde las OT: con OT reales de la base, son reales aunque no vengan en «mensual». */
const FROM_OT = new Set(['otOpen', 'otClosed', 'prevDone', 'prevPend', 'reinc', 'repTime', 'personal', 'horas']);

const fieldReal = (f: string, u: UnitName, m: number) => (f === 'taller.ot' ? isRealCell('taller.ot', u, 11) : isRealCell(f, u, m) || (FROM_OT.has(f) && isRealCell('taller.ot', u, 11)));

/** Estado del indicador para una unidad (o todas) y un mes de la ventana. */
export function coverage(k: MetricKey, unit: UnitFilter, m: number): Cov {
  const us = unitsOf(unit); const needs = NEEDS[k];
  let ok = 0;
  for (const u of us) if (needs.every((f) => fieldReal(f, u, m))) ok++;
  return ok === us.length ? 'real' : ok > 0 ? 'parcial' : 'demo';
}
export const COV_LABEL: Record<Cov, string> = { real: 'Dato real', parcial: 'Real en algunas bases', demo: 'Dato de demostración' };
/** Qué bases tienen el dato real (para explicar un «parcial»). */
export const realBases = (k: MetricKey, m: number) => UNIT_NAMES.filter((u) => NEEDS[k].every((f) => fieldReal(f, u, m)));

const MODS: Target[] = ['Tráfico', 'Flota', 'Taller', 'RRHH', 'Combustible', 'Seguridad'];
export interface Avance { pct: number; real: number; parcial: number; demo: number; total: number; porModulo: { modulo: Target; pct: number; real: number; parcial: number; demo: number; total: number }[] }
/** Avance hacia «cero demo»: real cuenta 1, parcial 0,5 y demo 0, sobre los indicadores del catálogo, en el último mes. */
export function avance(m = 11): Avance {
  const keys = Object.keys(METRICS) as MetricKey[];
  const score = (ks: MetricKey[]) => { let real = 0, parcial = 0, demo = 0; ks.forEach((k) => { const c = coverage(k, 'Todos', m); if (c === 'real') real++; else if (c === 'parcial') parcial++; else demo++; }); return { real, parcial, demo, total: ks.length, pct: ks.length ? ((real + parcial * 0.5) / ks.length) * 100 : 0 }; };
  const all = score(keys);
  const mods = [...MODS, 'Resumen' as Target].map((modulo) => ({ modulo, ...score(keys.filter((k) => METRICS[k].module === modulo)) })).filter((x) => x.total > 0);
  return { ...all, porModulo: mods };
}

/** Datos que todavía no tienen fuente: qué falta, para qué sirve y quién lo tiene. Es la lista de trabajo para llegar a cero demo. */
export interface Faltante { modulo: Target | 'Pañol' | 'Económico'; dato: string; completa: string; area: string; bloque: string }
export const FALTANTES: Faltante[] = [
  { modulo: 'Tráfico', dato: 'Km productivos, teóricos y de enlace por día de San Luis y Villa Mercedes', completa: 'KM ejecutados, cumplimiento, costo por km', area: 'Sistemas (Micronauta / GPS)', bloque: 'trafico_dia' },
  { modulo: 'Tráfico', dato: 'Pasajeros por día y por línea (SUBE) de Comodoro, San Luis y Villa Mercedes', completa: 'Pasajeros, IPK', area: 'Tráfico de cada base · Sistemas', bloque: 'trafico_dia · trafico_linea_mes' },
  { modulo: 'Tráfico', dato: 'Servicios programados vs. realizados por línea', completa: 'Regularidad, servicios cubiertos, puntualidad', area: 'Sistemas (Micronauta)', bloque: 'trafico_dia.servicios_prog / servicios_real' },
  { modulo: 'Tráfico', dato: 'Foto horaria del día (km acumulados, coches en calle, velocidad)', completa: 'Tráfico en vivo', area: 'Sistemas (scraping Micronauta)', bloque: 'trafico_hora' },
  { modulo: 'Seguridad', dato: 'Excesos de velocidad por coche, chofer y día', completa: 'Excesos de velocidad', area: 'Sistemas (alertas del GPS)', bloque: 'exceso_velocidad' },
  { modulo: 'Seguridad', dato: 'Expedientes de siniestros e incidentes de Córdoba, San Luis y Villa Mercedes', completa: 'Siniestros, incidentes, lesionados, responsabilidad, reincidencia', area: 'Seguridad / Legales', bloque: 'siniestro' },
  { modulo: 'Seguridad', dato: 'Montos reclamados, reconocidos y cobrados por expediente', completa: 'Seguimiento económico de siniestros', area: 'Legales', bloque: 'siniestro.monto' },
  { modulo: 'Económico', dato: 'Costos operativos por mes y base (sueldos, combustible, repuestos, seguros, otros)', completa: 'Costo por km, margen por km', area: 'Contabilidad', bloque: 'finanzas_mes (costo:…)' },
  { modulo: 'Económico', dato: 'Recaudación y subsidios cobrados por mes', completa: 'Ingreso por km, margen por km', area: 'Contabilidad / Administración', bloque: 'finanzas_mes (ingreso:…)' },
  { modulo: 'Económico', dato: 'Objetivos de gerencia por indicador y base', completa: 'Semáforos y metas del tablero', area: 'Gerencia', bloque: 'src/g/data.ts · OBJ' },
  { modulo: 'Taller', dato: 'Horas hombre por OT (inicio, fin y mecánico)', completa: 'Horas de taller, tiempo por OT, productividad', area: 'Taller', bloque: 'ot.horas' },
  { modulo: 'Flota', dato: 'Auxilios en calle (fecha, coche, motivo)', completa: 'Auxilios en vía', area: 'Taller (botón SOS / guardia)', bloque: 'auxilio' },
  { modulo: 'Flota', dato: 'Vencimientos de VTV, seguro y habilitación por coche', completa: 'Vencimientos de VTV', area: 'Administración de flota', bloque: 'vencimiento' },
  { modulo: 'Combustible', dato: 'Precio por litro de cada compra y medición del tanque con regla', completa: 'Costo de combustible, nivel medido, mermas', area: 'Compras · Combustible', bloque: 'comb_ingreso · comb_aforo' },
  { modulo: 'Pañol', dato: 'Maestro de stock de Córdoba, Comodoro y San Luis (espejo de DB_Inventario)', completa: 'Stock valorizado, bajo mínimo, cobertura', area: 'Sistemas', bloque: 'panol_stock' },
  { modulo: 'Pañol', dato: 'Presión de inflado y número de fuego único por cubierta', completa: 'Presión fuera de rango, vida de cada cubierta', area: 'Taller (gomería)', bloque: 'cubierta · cubierta_medicion' },
  { modulo: 'RRHH', dato: 'Nómina con legajo, sector, puesto y fecha de ingreso', completa: 'Personal activo, apertura por área, antigüedad', area: 'RR.HH. (API de Flitmo)', bloque: 'personal · rrhh_mes' },
  { modulo: 'RRHH', dato: 'Altas, bajas, ausencias, carpetas médicas, ART y sanciones por legajo', completa: 'Altas, bajas, ausentismo, días de ART y de carpetas', area: 'RR.HH. (API de Flitmo)', bloque: 'rrhh_novedad' },
  { modulo: 'RRHH', dato: 'Turnos programados vs. cubiertos', completa: 'Cobertura de turnos', area: 'RR.HH. (Flitmo / diagramación)', bloque: 'rrhh_mes' },
];

/** Bloques del snapshot que llegaron con datos. */
export const snapshotBlocks = () => ({ mensual: SNAP?.mensual?.length ?? 0, rrhh_mensual: SNAP?.rrhh_mensual?.length ?? 0, unidades: SNAP?.unidades?.length ?? 0, ot: SNAP?.ot?.length ?? 0 });
export const sourceLabel = () => (SOURCE.modo === 'real' ? 'Datos reales' : SOURCE.modo === 'cache' ? 'Última copia guardada' : 'Datos de demostración');
