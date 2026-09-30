// Reporte mensual de Mantenimiento de Flota (modelo de Gerencia) calculado con las OT reales de la base:
// preventivos 20K y services 30K cumplidos, pendientes según el plan por km de cada coche, correctivos
// realizados y producción individual de cada mecánico.
import { MONTH_LABELS, UnitFilter, UnitName, aggregate, monthEndDate, monthStart, unitsOf } from './data';
import { componentById } from '../data/catalog';
import type { WorkOrder } from '../data/types';
import { Bus, OT, busById, mechanicsOf, ordersOf, planRows, toOT } from './taller';

const closedIn = (f: UnitFilter, m: number) => { const s = monthStart(m).getTime(); const e = monthEndDate(m).getTime(); return ordersOf(f).filter((o) => o.closed && o.closed.getTime() >= s && o.closed.getTime() <= e); };
const isPrev = (o: WorkOrder) => o.title === 'Preventivo 20.000 km';
const isServ = (o: WorkOrder) => o.title === 'Service 30.000 km';

export interface Plan { prevProg: number; prevDone: number; prevPend: number; servProg: number; servDone: number; servPend: number }
export function plan(f: UnitFilter, m: number): Plan {
  const c = closedIn(f, m);
  const prevDone = c.filter(isPrev).length; const servDone = c.filter(isServ).length;
  let prevPend: number; let servPend: number;
  if (m === 11) { const rows = planRows(f).filter((r) => r.kmExc >= 0); prevPend = rows.filter((r) => r.tipo === 'Preventivo').length; servPend = rows.filter((r) => r.tipo === 'Service').length; }
  else { const pend = aggregate(f, [m]).prevPend; prevPend = Math.round(pend * (prevDone + 1) / (prevDone + servDone + 2)); servPend = pend - prevPend; } // meses cerrados: pendientes que quedaron al cierre
  return { prevProg: prevDone + prevPend, prevDone, prevPend, servProg: servDone + servPend, servDone, servPend };
}
export const planEvolution = (f: UnitFilter, m: number, n = 6) => Array.from({ length: n }, (_, k) => m - n + 1 + k).filter((i) => i >= 0).map((i) => {
  const p = plan(f, i); const r = (a: number, b: number) => +((b ? a / b : 1) * 100).toFixed(1);
  return { m: MONTH_LABELS[i], i, preventivos: r(p.prevDone, p.prevProg), services: r(p.servDone, p.servProg), total: r(p.prevDone + p.servDone, p.prevProg + p.servProg) };
});

export type PendEstado = 'PENDIENTE' | 'EN TALLER' | 'PROGRAMADO';
export interface PendRow { bus: Bus; tipo: 'Preventivo' | 'Service'; programado: string; km: number; venc: string; dias: number; estado: PendEstado; asignado: string; order?: string }
const ASSIGN = ['Binomio 1', 'Binomio 2', 'Binomio 3', 'Mecánica'];
/** Pendientes acumulados a la fecha de corte (el plan por km de cada coche, igual que en su ficha). */
export function pendientes(f: UnitFilter): PendRow[] {
  return planRows(f).map((r, i) => {
    const openPlan = r.bus.raw.orders.find((o) => o.status !== 'Cerrada' && (o.type === 'Preventivo 20K' || o.type === 'Service 30K'));
    const estado: PendEstado = openPlan || r.bus.estado !== 'Operativa' ? 'EN TALLER' : r.kmExc <= 0 ? 'PROGRAMADO' : 'PENDIENTE';
    return { bus: r.bus, tipo: r.tipo, programado: r.debia, km: r.bus.km, venc: r.programado.replace(/^(Preventivo|Service) /, ''), dias: r.kmExc > 0 ? r.dias : 0, estado, asignado: ASSIGN[(r.bus.interno + i) % ASSIGN.length], order: openPlan?.id };
  });
}

export const STAFF_SECTORS = ['Mecánica', 'Electricidad', 'Carrocería', 'Gomería'] as const;
const SYS_TO_SECTOR: Record<string, (typeof STAFF_SECTORS)[number]> = { 'Motor y transmisión': 'Mecánica', 'Tren rodante': 'Mecánica', 'Frenos y neumática': 'Mecánica', 'Eléctrico': 'Electricidad', 'Carrocería e interior': 'Carrocería', 'Confort y seguridad': 'Carrocería' };
export interface Staff { id: string; name: string; short: string; unit: UnitName; sector: string }
export interface ProdRow { s: Staff; prev: number; serv: number; corr: number; total: number; share: number; horas: number }
export function production(f: UnitFilter, m: number): ProdRow[] {
  const c = closedIn(f, m);
  const rows = mechanicsOf(f).map((mc) => {
    const os = c.filter((o) => o.mechanic === mc.name);
    const secCount = new Map<string, number>(); os.forEach((o) => { const s = SYS_TO_SECTOR[componentById[o.components[0]].system]; secCount.set(s, (secCount.get(s) ?? 0) + 1); });
    const sector = [...secCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Mecánica';
    const [first, ...rest] = mc.name.split(' ');
    const prev = os.filter(isPrev).length; const serv = os.filter(isServ).length; const corr = os.length - prev - serv;
    return { s: { id: `${mc.unit}-${mc.name}`, name: mc.name, short: `${first[0]}. ${rest.join(' ')}`, unit: mc.unit, sector }, prev, serv, corr, total: os.length, share: 0, horas: os.reduce((t, o) => t + o.hours, 0) };
  });
  const tot = rows.reduce((t, x) => t + x.total, 0) || 1;
  rows.forEach((x) => (x.share = (x.total / tot) * 100));
  return rows.sort((a, b) => b.total - a.total);
}

export interface CorrRow { ot: OT; fecha: string; tech: string; sector: string }
export function correctivos(f: UnitFilter, m: number): CorrRow[] {
  return closedIn(f, m).filter((o) => !isPrev(o) && !isServ(o)).sort((a, b) => b.closed!.getTime() - a.closed!.getTime()).map((o) => {
    const ot = toOT(o); return { ot, fecha: ot.fecha, sector: SYS_TO_SECTOR[ot.sector], tech: o.mechanic };
  });
}
export const unitsIn = (f: UnitFilter) => unitsOf(f);
export { busById };
