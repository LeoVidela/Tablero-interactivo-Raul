// Siniestros e incidentes: eventos demostrativos coherentes con data.ts (siniestros por mes/unidad),
// con conductores, coches, reparaciones y seguimiento económico.
import { DATA, UNIT_NAMES, UnitFilter, UnitName, hashStr, mulberry32, unitsOf } from './data';
import { Bus, BUSES, dstr, monthEnd } from './taller';
import { materials as CATALOG, componentById } from '../data/catalog';
import { mechanicsByBase, orders as ALL_ORDERS } from '../data/fleet';
import type { WorkOrder } from '../data/types';

export type Resp = 'Chofer' | 'Tercero' | 'En análisis';
export type RepEstado = 'REPARADA' | 'EN REPARACION' | 'PENDIENTE';
export type Asig = 'Taller propio' | 'Chapista externo' | '-';
export type Cobertura = 'Seguro' | 'Gestión interna' | 'Seguro tercero';
export type ClaimEstado = 'En análisis' | 'Negociación' | 'Oferta recibida' | 'Inspección' | 'Presentado' | 'A acordar' | 'Cobrado';

const FIRST = ['Pedro', 'Juan', 'Martín', 'Luis', 'Carlos', 'Raúl', 'Diego', 'Sergio', 'Marcos', 'Gabriel', 'Lucas', 'Hugo', 'Facundo', 'Nicolás', 'Ariel', 'Gustavo', 'Walter', 'Omar', 'Daniel', 'Mauro'];
const LAST = ['López', 'Pérez', 'Silva', 'Díaz', 'Gómez', 'Torres', 'Sosa', 'Vera', 'Romero', 'Acosta', 'Ruiz', 'Vega', 'Medina', 'Ríos', 'Herrera', 'Castro', 'Molina', 'Ortiz', 'Núñez', 'Paz'];
// Cada daño apunta a un componente del bus de la ficha técnica (se resalta al abrirla).
const DAMAGES: { text: string; anchor: string }[] = [
  { text: 'Lateral derecho', anchor: 'carroceria' }, { text: 'Lateral izquierdo', anchor: 'carroceria' }, { text: 'Puerta trasera', anchor: 'puerta-tras' }, { text: 'Paragolpes delantero', anchor: 'opticas' },
  { text: 'Espejo / lateral', anchor: 'espejos' }, { text: 'Parte trasera', anchor: 'carroceria' }, { text: 'Parabrisas', anchor: 'parabrisas' }, { text: 'Espejo exterior', anchor: 'espejos' },
];
const REC_STATES_EMP: ClaimEstado[] = ['En análisis', 'Negociación', 'Inspección', 'A acordar'];
const REC_STATES_TER: ClaimEstado[] = ['Oferta recibida', 'Presentado', 'Cobrado', 'Cobrado'];

export interface Driver { id: string; name: string; unit: UnitName; legajo: number; w: number }
export interface Siniestro {
  id: string; num: number; unit: UnitName; m: number; date: Date; fecha: string; bus: Bus; driver: Driver; resp: Resp; lesionados: number; damage: string; anchor: string;
  waitDays: number; repDays: number; asig: Asig;
  cobertura: Cobertura; nSin: string; reclamado: number; reconocido: number; cobrado: number; claim: ClaimEstado;
  /** OT de reparación en el historial del coche (cuando el coche ya entró a taller). */
  orderId?: string;
}
export interface Incidente { id: string; unit: UnitName; m: number; date: Date; bus: Bus; driver: Driver }

// ---------- conductores ----------
export const DRIVERS: Record<UnitName, Driver[]> = (() => {
  const out = {} as Record<UnitName, Driver[]>;
  for (const u of UNIT_NAMES) {
    const r = mulberry32(hashStr(`drv-${u}`)); const used = new Set<string>(); const list: Driver[] = [];
    while (list.length < 16) {
      const name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`;
      if (used.has(name)) continue; used.add(name);
      const i = list.length;
      list.push({ id: `${u}-d${i}`, name, unit: u, legajo: 2100 + Math.floor(r() * 900), w: i < 3 ? 9 : i < 7 ? 2.6 : 0.6 }); // pocos conductores concentran los hechos
    }
    out[u] = list;
  }
  return out;
})();

function pick<T extends { w?: number }>(r: () => number, arr: T[], weight: (x: T) => number): T {
  const tot = arr.reduce((s, x) => s + weight(x), 0); let x = r() * tot;
  for (const a of arr) { x -= weight(a); if (x <= 0) return a; }
  return arr[arr.length - 1];
}

const cache: { sin?: Siniestro[]; inc?: Incidente[] } = {};
function build() {
  if (cache.sin) return;
  const sin: Siniestro[] = []; const inc: Incidente[] = []; let num = 1;
  for (const u of UNIT_NAMES) {
    const buses = BUSES.filter((b) => b.unit === u);
    const hot = [...buses].sort((a, b) => hashStr(a.id + 'hot') - hashStr(b.id + 'hot')).slice(0, 8); // coches con repetición
    for (let m = 0; m < 12; m++) {
      const row = DATA[u][m]; const r = mulberry32(hashStr(`sin-${u}-${m}`));
      const nS = row.sin; const nI = Math.round(row.sin * 1.5 + (r() < 0.5 ? 0 : 1));
      const mk = () => { const day = 1 + Math.floor(r() * 28); return new Date(2025, 9 + m, day); };
      const dr = () => pick(r, DRIVERS[u], (d) => d.w); const bs = () => (r() < 0.5 ? hot[Math.floor(r() * hot.length)] : buses[Math.floor(r() * buses.length)]);
      for (let i = 0; i < nS; i++) {
        const date = mk(); const x = r();
        const resp: Resp = x < 0.58 ? 'Chofer' : x < 0.92 ? 'Tercero' : 'En análisis';
        const dmg = DAMAGES[Math.floor(r() * DAMAGES.length)];
        const cob: Cobertura = resp === 'Tercero' ? 'Seguro tercero' : r() < 0.55 ? 'Seguro' : 'Gestión interna';
        const reclamado = Math.round((300 + r() * 2300) / 10) * 10000;
        const claim: ClaimEstado = resp === 'Tercero' ? REC_STATES_TER[Math.floor(r() * 4)] : REC_STATES_EMP[Math.floor(r() * 4)];
        const reconocido = claim === 'Presentado' ? 0 : claim === 'En análisis' || claim === 'Inspección' ? Math.round(reclamado * 0.7 / 10000) * 10000 * (r() < 0.5 ? 1 : 0) : Math.round(reclamado * (0.55 + r() * 0.4) / 10000) * 10000;
        sin.push({
          id: `SIN-${String(num).padStart(4, '0')}`, num, unit: u, m, date, fecha: dstr(date), bus: bs(), driver: dr(), resp, lesionados: r() < 0.1 ? 1 + (r() < 0.3 ? 1 : 0) : 0, damage: dmg.text, anchor: dmg.anchor,
          waitDays: Math.floor(r() * 6) + (r() < 0.14 ? 20 + Math.floor(r() * 45) : 0), repDays: 1 + Math.floor(r() * 9), asig: r() < 0.6 ? 'Taller propio' : 'Chapista externo',
          cobertura: cob, nSin: cob === 'Gestión interna' ? '-' : String(44000 + Math.floor(r() * 38000)), reclamado, reconocido, cobrado: claim === 'Cobrado' ? reconocido : 0, claim,
        });
        num++;
      }
      for (let i = 0; i < nI; i++) inc.push({ id: `INC-${u}-${m}-${i}`, unit: u, m, date: mk(), bus: bs(), driver: dr() });
    }
  }
  cache.sin = sin; cache.inc = inc;
}
export const allSiniestros = () => { build(); return cache.sin!; };

/* Cada siniestro que ya entró a taller queda como OT "Siniestro" en el historial del coche: así la ficha técnica
   muestra la reparación, los materiales y la zona dañada resaltada en la imagen del bus. */
(function attachRepairOrders() {
  const D = 86400000;
  for (const s of allSiniestros()) {
    const st = repairState(s, 11); if (st.estado === 'PENDIENTE') continue;
    const opened = new Date(s.date.getTime() + s.waitDays * D + 9 * 3600000);
    const closed = st.estado === 'REPARADA' ? new Date(opened.getTime() + s.repDays * D) : undefined;
    const r = mulberry32(hashStr(`sinot-${s.id}`));
    const mats = CATALOG.filter((m) => m.component === s.anchor).slice(0, 2).map((m) => ({ code: m.code, name: m.name, unit: m.unit, qty: m.price > 500000 ? 1 : 1 + Math.floor(r() * 4), price: m.price, origin: 'Pañol' as const }));
    const mech = mechanicsByBase[s.unit];
    const o: WorkOrder = {
      id: `OT-S${String(s.num).padStart(4, '0')}`, unit: s.bus.id, base: s.unit, type: 'Siniestro', status: closed ? 'Cerrada' : 'En curso', priority: 'Alta', opened, closed,
      km: s.bus.km, origin: 'Informe de siniestro', components: [s.anchor], title: `Siniestro: ${s.damage.toLowerCase()}`,
      diagnosis: `${s.id} del ${s.fecha} · conductor ${s.driver.name} · responsabilidad ${s.resp.toLowerCase()}. Reparación ${s.asig.toLowerCase()}. Daño: ${s.damage} (${componentById[s.anchor].name}).`,
      mechanic: s.asig === 'Chapista externo' ? 'Chapista externo' : mech[Math.floor(r() * mech.length)], hours: 4 + Math.round(r() * 12), materials: mats,
    };
    s.orderId = o.id; s.bus.raw.orders.push(o); ALL_ORDERS.push(o);
  }
  BUSES.forEach((b) => b.raw.orders.sort((a, b2) => b2.opened.getTime() - a.opened.getTime()));
  ALL_ORDERS.sort((a, b) => b.opened.getTime() - a.opened.getTime());
})();
export const allIncidentes = () => { build(); return cache.inc!; };
const inF = (f: UnitFilter) => { const us = unitsOf(f); return (x: { unit: UnitName }) => us.includes(x.unit); };

// ---------- reparaciones (estado al cierre del mes m) ----------
export interface Repair { s: Siniestro; estado: RepEstado; dias: number; origen: 'actual' | 'anterior'; reparadaEnMes: boolean; asig: Asig; bucket: '0-7' | '8-30' | '+30' }
export function repairState(s: Siniestro, m: number): Repair {
  const T = monthEnd(m).getTime(); const D = 86400000; const start = s.date.getTime() + s.waitDays * D; const end = start + s.repDays * D;
  const estado: RepEstado = T >= end ? 'REPARADA' : T >= start ? 'EN REPARACION' : 'PENDIENTE';
  const dias = Math.max(0, Math.round((T - s.date.getTime()) / D));
  const reparadaEnMes = estado === 'REPARADA' && end >= monthEnd(m - 1).getTime() && s.m <= m;
  return { s, estado, dias, origen: s.m === m ? 'actual' : 'anterior', reparadaEnMes, asig: estado === 'PENDIENTE' ? '-' : s.asig, bucket: dias <= 7 ? '0-7' : dias <= 30 ? '8-30' : '+30' };
}
export function repairs(f: UnitFilter, m: number): Repair[] {
  const sel = inF(f);
  return allSiniestros().filter((s) => sel(s) && s.m <= m && s.m >= m - 5).map((s) => repairState(s, m)).filter((x) => x.s.m === m || x.estado !== 'REPARADA' || x.reparadaEnMes);
}

// ---------- vista del mes ----------
export interface DriverRow { d: Driver; sin: number; inc: number; total: number; prev: number; acum: number; resp: number; sancion: string; estado: 'ALERTA' | 'SEGUIMIENTO' | 'NORMAL' }
export interface SinData {
  m: number; events: Siniestro[]; incs: Incidente[]; resp: Record<Resp, number>; lesionados: number; units: number; repairs: Repair[];
  rep: { reparadas: number; enRep: number; pendientes: number; pct: number };
  drivers: DriverRow[]; unitsRank: { bus: Bus; count: number }[];
  eco: { abiertos: number; empresa: number; interna: number; terceros: number; reconocido: number; cobrado: number; seguroN: number; seguroM: number; internaN: number; internaM: number; recTercN: number; costoPend: number; sinOferta: number; aAcordar: number; pagoPend: number };
  alerts: { reincidentes: number; pendientes: number; lesionados: number };
}
export function sinData(f: UnitFilter, m: number): SinData {
  const sel = inF(f); const S = allSiniestros().filter(sel); const I = allIncidentes().filter(sel);
  const events = S.filter((s) => s.m === m); const incs = I.filter((i) => i.m === m);
  const resp: Record<Resp, number> = { Chofer: 0, Tercero: 0, 'En análisis': 0 }; events.forEach((s) => resp[s.resp]++);
  const rp = repairs(f, m);
  const inMonth = rp.filter((x) => x.s.m === m);
  const reparadas = inMonth.filter((x) => x.estado === 'REPARADA').length; const enRep = inMonth.filter((x) => x.estado === 'EN REPARACION').length; const pendientes = inMonth.filter((x) => x.estado === 'PENDIENTE').length;
  const units = new Set(events.map((s) => s.bus.id)).size;

  const byDriver = new Map<string, DriverRow>();
  const ensure = (d: Driver) => { if (!byDriver.has(d.id)) byDriver.set(d.id, { d, sin: 0, inc: 0, total: 0, prev: 0, acum: 0, resp: 0, sancion: '-', estado: 'NORMAL' }); return byDriver.get(d.id)!; };
  for (const s of S) { if (s.m > m || s.m <= m - 6) continue; const r = ensure(s.driver); r.acum++; if (s.m === m) { r.sin++; if (s.resp === 'Chofer') r.resp++; } if (s.m === m - 1) r.prev++; }
  for (const i of I) { if (i.m > m || i.m <= m - 6) continue; const r = ensure(i.driver); r.acum++; if (i.m === m) r.inc++; if (i.m === m - 1) r.prev++; }
  const drivers = [...byDriver.values()].filter((r) => r.sin + r.inc > 0).map((r) => {
    const total = r.sin + r.inc;
    return { ...r, total, sancion: r.resp >= 2 ? '3 días' : r.resp === 1 ? '1 día' : '-', estado: (total >= 3 || r.resp >= 2 || (total >= 2 && r.acum >= 6) ? 'ALERTA' : total >= 2 || r.prev >= 1 || r.acum >= 3 ? 'SEGUIMIENTO' : 'NORMAL') as DriverRow['estado'] };
  }).sort((a, b) => b.total - a.total || b.sin - a.sin || b.acum - a.acum);

  const cnt = new Map<string, { bus: Bus; count: number }>();
  for (const s of S) if (s.m <= m && s.m > m - 12) { const c = cnt.get(s.bus.id) ?? { bus: s.bus, count: 0 }; c.count++; cnt.set(s.bus.id, c); }
  const unitsRank = [...cnt.values()].sort((a, b) => b.count - a.count || a.bus.interno - b.bus.interno);

  const open = events.filter((s) => s.claim !== 'Cobrado');
  const emp = events.filter((s) => s.resp !== 'Tercero'); const ter = events.filter((s) => s.resp === 'Tercero');
  const seg = emp.filter((s) => s.cobertura === 'Seguro'); const gi = emp.filter((s) => s.cobertura === 'Gestión interna');
  const sum = (a: Siniestro[], k: 'reclamado' | 'reconocido' | 'cobrado') => a.reduce((t, s) => t + s[k], 0);
  const eco = {
    abiertos: open.length, empresa: sum(emp, 'reclamado'), interna: sum(gi, 'reclamado'), terceros: sum(ter, 'reclamado'), reconocido: sum(ter, 'reconocido'), cobrado: sum(ter, 'cobrado'),
    seguroN: seg.length, seguroM: sum(seg, 'reclamado'), internaN: gi.length, internaM: sum(gi, 'reclamado'), recTercN: ter.length,
    costoPend: sum(emp, 'reclamado') - sum(emp, 'reconocido'), sinOferta: ter.filter((s) => s.claim === 'Presentado').length, aAcordar: gi.filter((s) => s.claim === 'A acordar' || s.claim === 'Negociación').length, pagoPend: seg.filter((s) => s.claim !== 'Cobrado').length,
  };
  const reincidentes = drivers.filter((r) => r.estado === 'ALERTA').length;
  const pendientesAll = rp.filter((x) => x.estado !== 'REPARADA').length;
  return { m, events, incs, resp, lesionados: events.reduce((t, s) => t + s.lesionados, 0), units, repairs: rp, rep: { reparadas, enRep, pendientes, pct: events.length ? (reparadas / events.length) * 100 : 100 }, drivers, unitsRank, eco, alerts: { reincidentes, pendientes: pendientesAll, lesionados: events.filter((s) => s.lesionados > 0).length } };
}

// ---------- histórico 12 meses ----------
export interface HistRow { d: Driver; per: { s: number; i: number }[]; totS: number; totI: number }
export function driverHistory(f: UnitFilter): HistRow[] {
  const sel = inF(f); const map = new Map<string, HistRow>();
  const ensure = (d: Driver) => { if (!map.has(d.id)) map.set(d.id, { d, per: Array.from({ length: 12 }, () => ({ s: 0, i: 0 })), totS: 0, totI: 0 }); return map.get(d.id)!; };
  allSiniestros().filter(sel).forEach((s) => { const r = ensure(s.driver); r.per[s.m].s++; r.totS++; });
  allIncidentes().filter(sel).forEach((i) => { const r = ensure(i.driver); r.per[i.m].i++; r.totI++; });
  return [...map.values()].sort((a, b) => b.totS - a.totS || b.totS + b.totI - (a.totS + a.totI));
}
export function driverEvents(d: Driver) {
  return { sin: allSiniestros().filter((s) => s.driver.id === d.id), inc: allIncidentes().filter((i) => i.driver.id === d.id) };
}

export const fmtMoney = (v: number) => `$ ${Math.round(v).toLocaleString('es-AR')}`;
