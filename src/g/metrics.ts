// Catálogo de indicadores: cada tarjeta del tablero abre su detalle (12 meses, por base, objetivo, módulo).
import { MONTH_LABELS, OBJ, UNIT_NAMES, UnitFilter, aggregate, objectives } from './data';
import { tallerData } from './taller';
import { sinData } from './siniestros';
import { hrTotals } from './rrhh';
import { fmt, money, moneyM, pct } from './ui';

export type Target = 'Resumen' | 'Tráfico' | 'Flota' | 'Taller' | 'RRHH' | 'Combustible' | 'Seguridad';
export type MetricKey =
  | 'cumpl' | 'reg' | 'kmExec' | 'disp' | 'oper' | 'out' | 'aux' | 'aus' | 'cob' | 'sin' | 'exc' | 'cost' | 'inc' | 'margin' | 'pax' | 'ipk'
  | 'otOpen' | 'otClosed' | 'prevDone' | 'prevPend' | 'reinc' | 'repTime' | 'personal' | 'horas' | 'lts' | 'kmpl' | 'gastoRep' | 'gastoTot' | 'costoMantKm'
  | 'incid' | 'lesion' | 'sinResp' | 'activos' | 'altas' | 'bajas' | 'ausDias' | 'artDias' | 'carpDias';

export interface MetricDef {
  label: string; module: Target; tab?: string; desc: string; goodUp: boolean;
  get: (u: UnitFilter, m: number) => number;
  fmt: (v: number) => string;
  /** objetivo mensual (si existe) */
  obj?: (u: UnitFilter) => { v: number; txt: string; max: boolean };
}
const A = (u: UnitFilter, m: number) => aggregate(u, [m]);
const T = (u: UnitFilter, m: number) => tallerData(u, m);

export const METRICS: Record<MetricKey, MetricDef> = {
  cumpl: { label: 'KM ejecutados (cumplimiento)', module: 'Tráfico', desc: 'Kilómetros ejecutados sobre programados.', goodUp: true, get: (u, m) => A(u, m).cumpl, fmt: (v) => pct(v), obj: () => ({ v: OBJ.km, txt: `≥ ${OBJ.km}%`, max: false }) },
  reg: { label: 'Regularidad', module: 'Tráfico', desc: 'Servicios que respetaron la frecuencia programada.', goodUp: true, get: (u, m) => A(u, m).reg, fmt: (v) => pct(v), obj: () => ({ v: OBJ.reg, txt: `≥ ${OBJ.reg}%`, max: false }) },
  kmExec: { label: 'Kilómetros ejecutados', module: 'Tráfico', desc: 'Kilómetros recorridos en servicio.', goodUp: true, get: (u, m) => A(u, m).kmExec, fmt: (v) => `${fmt(v)} km` },
  disp: { label: 'Disponibilidad operativa', module: 'Flota', desc: 'Coches operativos sobre la flota total.', goodUp: true, get: (u, m) => A(u, m).disp, fmt: (v) => pct(v), obj: () => ({ v: OBJ.disp, txt: `≥ ${OBJ.disp}%`, max: false }) },
  oper: { label: 'Coches operativos', module: 'Flota', desc: 'Coches disponibles para salir a servicio.', goodUp: true, get: (u, m) => A(u, m).oper, fmt: (v) => fmt(v) },
  out: { label: 'Coches fuera de servicio', module: 'Flota', desc: 'En taller, esperando repuestos o fuera de servicio.', goodUp: false, get: (u, m) => A(u, m).out, fmt: (v) => fmt(v) },
  aux: { label: 'Auxilios en vía', module: 'Flota', desc: 'Coches que necesitaron auxilio durante el servicio.', goodUp: false, get: (u, m) => A(u, m).aux, fmt: (v) => fmt(v), obj: (u) => { const o = Math.ceil(objectives(u, 3).aux / 3); return { v: o, txt: `≤ ${o} por mes`, max: true }; } },
  aus: { label: 'Ausentismo', module: 'RRHH', desc: 'Horas de ausencia sobre horas programadas.', goodUp: false, get: (u, m) => A(u, m).aus, fmt: (v) => pct(v), obj: () => ({ v: OBJ.aus, txt: `≤ ${OBJ.aus}%`, max: true }) },
  cob: { label: 'Cobertura de turnos', module: 'RRHH', desc: 'Turnos cubiertos sobre turnos programados.', goodUp: true, get: (u, m) => A(u, m).cob, fmt: (v) => pct(v), obj: () => ({ v: OBJ.cob, txt: `≥ ${OBJ.cob}%`, max: false }) },
  sin: { label: 'Siniestros', module: 'Seguridad', desc: 'Siniestros registrados en el mes.', goodUp: false, get: (u, m) => A(u, m).sin, fmt: (v) => fmt(v), obj: (u) => { const o = Math.ceil(objectives(u, 3).sin / 3); return { v: o, txt: `≤ ${o} por mes`, max: true }; } },
  exc: { label: 'Excesos de velocidad', module: 'Seguridad', desc: 'Eventos de exceso de velocidad detectados por GPS.', goodUp: false, get: (u, m) => A(u, m).exc, fmt: (v) => fmt(v), obj: (u) => { const o = Math.ceil(objectives(u, 3).exc / 3); return { v: o, txt: `≤ ${o} por mes`, max: true }; } },
  cost: { label: 'Costo por km', module: 'Taller', desc: 'Costo operativo total dividido kilómetros ejecutados.', goodUp: false, get: (u, m) => A(u, m).cost, fmt: (v) => money(v), obj: () => ({ v: OBJ.cost, txt: `≤ ${money(OBJ.cost)}`, max: true }) },
  inc: { label: 'Ingreso por km', module: 'Tráfico', desc: 'Recaudación (SUBE + subsidios) dividida kilómetros.', goodUp: true, get: (u, m) => A(u, m).inc, fmt: (v) => money(v) },
  margin: { label: 'Margen por km', module: 'Resumen', desc: 'Ingreso por km menos costo por km.', goodUp: true, get: (u, m) => A(u, m).margin, fmt: (v) => money(v) },
  pax: { label: 'Pasajeros transportados', module: 'Tráfico', desc: 'Validaciones SUBE del mes.', goodUp: true, get: (u, m) => A(u, m).pax, fmt: (v) => fmt(v) },
  ipk: { label: 'Índice pasajeros por km (IPK)', module: 'Tráfico', desc: 'Pasajeros por kilómetro recorrido.', goodUp: true, get: (u, m) => A(u, m).ipk, fmt: (v) => fmt(v, 2) },
  otOpen: { label: 'OT abiertas', module: 'Taller', tab: 'Correctivo', desc: 'Órdenes de trabajo abiertas al cierre del mes.', goodUp: false, get: (u, m) => A(u, m).otOpen, fmt: (v) => fmt(v) },
  otClosed: { label: 'OT cerradas', module: 'Taller', tab: 'Productividad', desc: 'Órdenes de trabajo cerradas en el mes.', goodUp: true, get: (u, m) => A(u, m).otClosed, fmt: (v) => fmt(v) },
  prevDone: { label: 'Preventivos y services realizados', module: 'Taller', tab: 'Mantenimiento de flota', desc: 'Preventivos 20.000 km y services 30.000 km cerrados en el mes.', goodUp: true, get: (u, m) => A(u, m).prevDone, fmt: (v) => fmt(v) },
  prevPend: { label: 'Preventivos y services pendientes', module: 'Taller', tab: 'Mantenimiento de flota', desc: 'Coches con el plan por km vencido al cierre del mes.', goodUp: false, get: (u, m) => A(u, m).prevPend, fmt: (v) => fmt(v) },
  reinc: { label: 'Reincidencias', module: 'Taller', tab: 'Reincidencias', desc: 'El coche volvió a entrar por el mismo componente dentro de los 90 días.', goodUp: false, get: (u, m) => A(u, m).reinc, fmt: (v) => fmt(v) },
  repTime: { label: 'Horas promedio por OT', module: 'Taller', tab: 'Correctivo', desc: 'Horas hombre promedio de las OT cerradas.', goodUp: false, get: (u, m) => A(u, m).repTime, fmt: (v) => `${fmt(v, 1)} h` },
  personal: { label: 'Personal de taller', module: 'Taller', tab: 'Personal taller', desc: 'Mecánicos con OT asignadas.', goodUp: true, get: (u, m) => A(u, m).personal, fmt: (v) => fmt(v) },
  horas: { label: 'Horas de taller', module: 'Taller', tab: 'Productividad', desc: 'Horas hombre registradas en OT cerradas.', goodUp: true, get: (u, m) => A(u, m).horas, fmt: (v) => `${fmt(v)} h` },
  lts: { label: 'Combustible consumido', module: 'Combustible', desc: 'Litros de gasoil consumidos por la flota.', goodUp: false, get: (u, m) => A(u, m).lts, fmt: (v) => `${fmt(v)} L` },
  kmpl: { label: 'Rendimiento (km por litro)', module: 'Combustible', desc: 'Kilómetros ejecutados por litro de gasoil.', goodUp: true, get: (u, m) => { const a = A(u, m); return a.kmExec / a.lts; }, fmt: (v) => `${fmt(v, 2)} km/l` },
  gastoRep: { label: 'Gasto en repuestos', module: 'Taller', tab: 'Repuestos y gastos', desc: 'Materiales de pañol y compras directas en OT cerradas.', goodUp: false, get: (u, m) => T(u, m).total.repuestos, fmt: (v) => moneyM(v) },
  gastoTot: { label: 'Gasto total de mantenimiento', module: 'Taller', tab: 'Repuestos y gastos', desc: 'Repuestos + mano de obra + combustible de taller + otros.', goodUp: false, get: (u, m) => T(u, m).total.gasto, fmt: (v) => moneyM(v) },
  costoMantKm: { label: 'Costo de mantenimiento por km', module: 'Taller', tab: 'Repuestos y gastos', desc: 'Gasto total de mantenimiento dividido kilómetros.', goodUp: false, get: (u, m) => T(u, m).total.gasto / A(u, m).kmExec, fmt: (v) => money(v) },
  incid: { label: 'Incidentes', module: 'Seguridad', desc: 'Hechos sin daños mayores reportados por conductores.', goodUp: false, get: (u, m) => sinData(u, m).incs.length, fmt: (v) => fmt(v) },
  lesion: { label: 'Lesionados en siniestros', module: 'Seguridad', desc: 'Personas lesionadas en siniestros del mes.', goodUp: false, get: (u, m) => sinData(u, m).lesionados, fmt: (v) => fmt(v) },
  activos: { label: 'Personal activo', module: 'RRHH', desc: 'Dotación activa al cierre del mes (todas las áreas).', goodUp: true, get: (u, m) => hrTotals(u, m).activos, fmt: (v) => fmt(v) },
  altas: { label: 'Altas del mes', module: 'RRHH', desc: 'Ingresos de personal en el mes.', goodUp: true, get: (u, m) => hrTotals(u, m).altas, fmt: (v) => fmt(v) },
  bajas: { label: 'Bajas del mes', module: 'RRHH', desc: 'Egresos de personal en el mes.', goodUp: false, get: (u, m) => hrTotals(u, m).bajas, fmt: (v) => fmt(v) },
  ausDias: { label: 'Días de ausentismo', module: 'RRHH', desc: 'Días de ausencia (todas las causas).', goodUp: false, get: (u, m) => hrTotals(u, m).ausDias, fmt: (v) => fmt(v) },
  artDias: { label: 'Días ART', module: 'RRHH', desc: 'Días perdidos por accidentes de trabajo.', goodUp: false, get: (u, m) => hrTotals(u, m).artDias, fmt: (v) => fmt(v) },
  carpDias: { label: 'Días de carpetas médicas', module: 'RRHH', desc: 'Días de licencia por carpeta médica.', goodUp: false, get: (u, m) => hrTotals(u, m).carpDias, fmt: (v) => fmt(v) },
  sinResp: { label: 'Siniestros con responsabilidad del chofer', module: 'Seguridad', tab: 'Reincidencia', desc: 'Siniestros del mes con responsabilidad atribuida al conductor.', goodUp: false, get: (u, m) => sinData(u, m).resp.Chofer, fmt: (v) => fmt(v) },
};

export interface MetricSeries { m: string; i: number; v: number }
export const metricSeries = (k: MetricKey, u: UnitFilter): MetricSeries[] => MONTH_LABELS.map((lb, i) => ({ m: lb, i, v: METRICS[k].get(u, i) }));
export const metricByUnit = (k: MetricKey, m: number) => UNIT_NAMES.map((u) => ({ u, v: METRICS[k].get(u, m) }));
