// Taller y Mantenimiento para los tableros de Gerencia, calculado sobre la flota y las OT reales de la base
// (data/fleet.ts): mismos internos, mismas órdenes, mismos materiales que ve la ficha técnica del coche.
import { componentById, systems } from '../data/catalog';
import { PREVENTIVE_KM, SERVICE_KM, mechanicsByBase, orderCost, orders as ALL_ORDERS, units as ALL_UNITS } from '../data/fleet';
import type { SystemGroup, Unit, UnitStatus, WorkOrder } from '../data/types';
import { Agg, UnitFilter, UnitName, aggregate, isPlanOrder, monthEndDate, monthIdx, monthStart, unitsOf } from './data';

export const SECTORS = systems;
export type Sector = SystemGroup;
export const SECTOR_COLOR: Record<Sector, string> = { 'Motor y transmisión': '#f59e0b', 'Tren rodante': '#14b8a6', 'Frenos y neumática': '#ef4444', 'Eléctrico': '#3b82f6', 'Carrocería e interior': '#a855f7', 'Confort y seguridad': '#22d3ee' };
export const LABOR_RATE = 9800; // $/hora (mock)

// ---------- coches ----------
export type BusEstado = 'Operativa' | 'En reparación' | 'Esperando repuestos' | 'Fuera de servicio';
const EST: Record<UnitStatus, BusEstado> = { Operativo: 'Operativa', 'En taller': 'En reparación', 'Esperando repuesto': 'Esperando repuestos', 'Fuera de servicio': 'Fuera de servicio' };
export interface Bus { id: string; interno: number; dominio: string; unit: UnitName; modelo: string; carroceria: string; linea: string; km: number; anio: number; ot12: number; salud: number; estado: BusEstado; raw: Unit }
const END = new Date(2026, 8, 30, 12);
const DAY = 86400000;
export const BUSES: Bus[] = ALL_UNITS.map((u) => {
  const ot12 = u.orders.filter((o) => END.getTime() - o.opened.getTime() <= 365 * DAY).length;
  const corr = u.orders.filter((o) => o.type !== 'Preventivo 20K' && o.type !== 'Service 30K' && END.getTime() - o.opened.getTime() <= 365 * DAY).length;
  const overdue = Math.max(0, (u.km - u.lastPreventiveKm) / PREVENTIVE_KM - 1) + Math.max(0, (u.km - u.lastServiceKm) / SERVICE_KM - 1);
  const salud = Math.round(Math.min(99, Math.max(40, 104 - corr * 1.6 - Math.max(0, u.km - 250000) / 45000 - overdue * 18 - (u.status === 'Fuera de servicio' ? 14 : u.status !== 'Operativo' ? 6 : 0))));
  return { id: u.interno, interno: Number(u.interno), dominio: u.plate, unit: u.base as UnitName, modelo: u.chassis, carroceria: u.body, linea: u.line, km: u.km, anio: u.year, ot12, salud, estado: EST[u.status], raw: u };
});
export const busById = Object.fromEntries(BUSES.map((b) => [b.id, b])) as Record<string, Bus>;
export const busesOf = (f: UnitFilter) => BUSES.filter((b) => unitsOf(f).includes(b.unit));
export const ordersOf = (f: UnitFilter) => ALL_ORDERS.filter((o) => unitsOf(f).includes(o.base as UnitName));

// ---------- fechas ----------
export const dstr = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
export const daysAgo = (n: number, base: Date = END) => { const d = new Date(base); d.setDate(d.getDate() - n); return d; };
export const monthEnd = (m: number) => monthEndDate(m);

// ---------- órdenes de trabajo (vista gerencial de una WorkOrder) ----------
export type OTEstado = 'En proceso' | 'Espera repuesto' | 'Pendiente' | 'Cerrada';
const OT_EST: Record<WorkOrder['status'], OTEstado> = { Abierta: 'Pendiente', 'En curso': 'En proceso', 'Esperando repuesto': 'Espera repuesto', Cerrada: 'Cerrada' };
export interface OT { id: string; bus: Bus; sector: Sector; problem: string; comp: string; tipo: WorkOrder['type']; mecanico: string; horas: number; estado: OTEstado; fecha: string; abierta: string; costoRep: number; costoMO: number; raw: WorkOrder }
export function toOT(o: WorkOrder, at?: Date): OT {
  const c = componentById[o.components[0]];
  const closedAt = o.closed && (!at || o.closed.getTime() <= at.getTime());
  return {
    id: o.id, bus: busById[o.unit], sector: c.system, problem: o.title, comp: c.name, tipo: o.type, mecanico: o.mechanic, horas: o.hours,
    estado: closedAt ? 'Cerrada' : o.status === 'Cerrada' ? 'En proceso' : OT_EST[o.status], fecha: dstr(o.closed ?? o.opened), abierta: dstr(o.opened), costoRep: orderCost(o), costoMO: Math.round(o.hours * LABOR_RATE), raw: o,
  };
}

// ---------- vista de Taller ----------
export interface PrevRow { bus: Bus; programado: string; debia: string; estado: 'VENCIDO' | 'POR VENCER' | 'EN TIEMPO'; dias: number; tipo: 'Preventivo' | 'Service'; kmExc: number }
export interface ReincRow { bus: Bus; sector: Sector; problem: string; comp: string; veces: number; ultima: string; order: string }
export interface SectorRow { sector: Sector; count: number; share: number; cost: number }
export interface TallerData {
  agg: Agg; prev: Agg | null; buses: Bus[];
  pendientes: PrevRow[]; abiertas: OT[]; top: Bus[]; reinc: ReincRow[]; sectors: SectorRow[];
  salud: { avg: number; exc: number; att: number; crit: number };
  total: { gasto: number; repuestos: number; mo: number; comb: number; otros: number };
  closed: WorkOrder[]; m: number;
}
const KM_DAY = 200;
/** Preventivos / services vencidos o próximos, según el plan por km de cada coche (el mismo que muestra la ficha). */
export function planRows(f: UnitFilter): PrevRow[] {
  const rows: PrevRow[] = [];
  for (const b of busesOf(f)) {
    const u = b.raw;
    const add = (tipo: PrevRow['tipo'], last: number, every: number) => {
      const used = u.km - last; if (used < every * 0.95) return;
      const kmExc = used - every; const dias = Math.round(Math.abs(kmExc) / KM_DAY);
      const due = Math.ceil((last + every) / 1000) * 1000;
      rows.push({ bus: b, tipo, kmExc, programado: `${tipo === 'Service' ? 'Service' : 'Preventivo'} ${due.toLocaleString('es-AR')} km`, debia: dstr(daysAgo(kmExc >= 0 ? dias : -dias)), estado: kmExc > 0 ? 'VENCIDO' : 'POR VENCER', dias });
    };
    add('Preventivo', u.lastPreventiveKm, PREVENTIVE_KM); add('Service', u.lastServiceKm, SERVICE_KM);
  }
  return rows.sort((a, b) => b.kmExc - a.kmExc);
}
export function tallerData(filter: UnitFilter, m: number): TallerData {
  const agg = aggregate(filter, [m]);
  const prev = m > 0 ? aggregate(filter, [m - 1]) : null;
  const buses = busesOf(filter);
  const ords = ordersOf(filter);
  const end = monthEnd(m); const start = monthStart(m); const E = end.getTime();
  const pendientes = planRows(filter);
  const abiertas = ords.filter((o) => o.opened.getTime() <= E && (!o.closed || o.closed.getTime() > E)).sort((a, b) => b.opened.getTime() - a.opened.getTime()).map((o) => toOT(o, end));
  const win = ords.filter((o) => o.opened.getTime() <= E && E - o.opened.getTime() <= 365 * DAY);
  const cnt = new Map<string, number>(); win.forEach((o) => cnt.set(o.unit, (cnt.get(o.unit) ?? 0) + 1));
  const top = [...buses].map((b) => ({ ...b, ot12: cnt.get(b.id) ?? 0 })).sort((a, b) => b.ot12 - a.ot12 || a.interno - b.interno).slice(0, 15);

  // reincidencias del mes: el coche volvió a entrar por el mismo componente dentro de los 90 días de la intervención anterior
  const reinc: ReincRow[] = [];
  const S0 = start.getTime();
  const seen = new Set<string>();
  ords.filter((o) => !isPlanOrder(o) && o.opened.getTime() >= S0 && o.opened.getTime() <= E).sort((a, b) => b.opened.getTime() - a.opened.getTime()).forEach((o) => o.components.forEach((c) => {
    const key = `${o.unit}|${c}`; if (seen.has(key)) return;
    const hist = busById[o.unit].raw.orders.filter((x) => !isPlanOrder(x) && x.components.includes(c) && x.opened.getTime() <= o.opened.getTime());
    const prevO = hist.filter((x) => x.id !== o.id && x.opened.getTime() < o.opened.getTime()).sort((a, b) => b.opened.getTime() - a.opened.getTime())[0];
    if (!prevO || o.opened.getTime() - prevO.opened.getTime() > 90 * DAY) return;
    seen.add(key); const comp = componentById[c];
    reinc.push({ bus: busById[o.unit], sector: comp.system, comp: comp.name, problem: o.title, veces: hist.filter((x) => o.opened.getTime() - x.opened.getTime() <= 365 * DAY).length, ultima: dstr(o.opened), order: o.id });
  }));
  reinc.sort((a, b) => b.veces - a.veces || a.bus.interno - b.bus.interno);

  const sc = new Map<Sector, { count: number; cost: number }>();
  win.filter((o) => !isPlanOrder(o)).forEach((o) => { const s = componentById[o.components[0]].system; const v = sc.get(s) ?? { count: 0, cost: 0 }; v.count++; v.cost += orderCost(o) + o.hours * LABOR_RATE; sc.set(s, v); });
  const tot = win.filter((o) => !isPlanOrder(o)).length || 1;
  const sectors: SectorRow[] = SECTORS.map((s) => ({ sector: s, count: sc.get(s)?.count ?? 0, share: ((sc.get(s)?.count ?? 0) / tot) * 100, cost: sc.get(s)?.cost ?? 0 })).sort((a, b) => b.count - a.count);

  const avg = buses.reduce((s, b) => s + b.salud, 0) / Math.max(1, buses.length);
  const salud = { avg: Math.round(avg), exc: buses.filter((b) => b.salud >= 90).length, att: buses.filter((b) => b.salud >= 70 && b.salud < 90).length, crit: buses.filter((b) => b.salud < 70).length };

  const closed = ords.filter((o) => o.closed && o.closed.getTime() >= start.getTime() && o.closed.getTime() <= E);
  const repuestos = closed.reduce((s, o) => s + orderCost(o), 0);
  const mo = closed.reduce((s, o) => s + o.hours, 0) * LABOR_RATE;
  const comb = agg.lts * 0.004 * 1200; const otros = (repuestos + mo) * 0.05;
  return { agg, prev, buses, pendientes, abiertas, top, reinc, sectors, salud, total: { gasto: repuestos + mo + comb + otros, repuestos, mo, comb, otros }, closed, m };
}
export const fmtKm = (n: number) => n.toLocaleString('es-AR');
export const mechanicsOf = (f: UnitFilter) => unitsOf(f).flatMap((u) => mechanicsByBase[u].map((n) => ({ name: n, unit: u })));
export const inMonth = (d: Date | undefined, m: number) => !!d && monthIdx(d) === m;

// ---------- repuestos y consumos ----------
export interface PartRow { code: string; desc: string; qty: number; price: number; importe: number; share: number; ots: number }
export function topParts(d: TallerData): PartRow[] {
  const map = new Map<string, PartRow>();
  d.closed.forEach((o) => o.materials.forEach((mt) => { if (mt.origin === 'Recuperado') return; const r = map.get(mt.code) ?? { code: mt.code, desc: mt.name, qty: 0, price: mt.price, importe: 0, share: 0, ots: 0 }; r.qty += mt.qty; r.importe += mt.qty * mt.price; r.ots++; map.set(mt.code, r); }));
  const rows = [...map.values()].sort((a, b) => b.importe - a.importe).slice(0, 10);
  rows.forEach((r) => (r.share = (r.importe / Math.max(1, d.total.repuestos)) * 100));
  return rows;
}
export interface UnitCons { bus: Bus; km: number; lts: number; kmpl: number; rep: number; mant: number; total: number; cpk: number; prev: number; corr: number }
export function unitConsumption(d: TallerData): UnitCons[] {
  const byBus = new Map<string, WorkOrder[]>(); d.closed.forEach((o) => byBus.set(o.unit, [...(byBus.get(o.unit) ?? []), o]));
  const kmUnit = new Map<UnitName, number>(); [...new Set(d.buses.map((b) => b.unit))].forEach((u) => kmUnit.set(u, aggregate(u, [d.m]).kmExec));
  return d.buses.map((bus) => {
    const n = d.buses.filter((b) => b.unit === bus.unit).length;
    const h = (bus.interno * 2654435761) % 1000 / 1000;
    const km = Math.round(((kmUnit.get(bus.unit) ?? 0) / n) * (0.75 + h * 0.5));
    const kmpl = 2.6 + ((bus.interno * 40503) % 100) / 100 * 0.9;
    const os = byBus.get(bus.id) ?? [];
    const rep = os.reduce((s, o) => s + orderCost(o), 0); const mant = os.reduce((s, o) => s + o.hours * LABOR_RATE, 0);
    return { bus, km, lts: Math.round(km / kmpl), kmpl, rep, mant, total: rep + mant, cpk: km ? (rep + mant) / km : 0, prev: os.filter((o) => o.type === 'Preventivo 20K' || o.type === 'Service 30K').length, corr: os.filter((o) => o.type !== 'Preventivo 20K' && o.type !== 'Service 30K').length };
  }).sort((a, b) => b.total - a.total);
}
