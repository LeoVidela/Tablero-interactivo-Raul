// Stock de pañol por base: consumo real de materiales en las OT (últimos 90 días) y niveles de stock demostrativos.
import { componentById, materials } from '../data/catalog';
import { orders as ALL_ORDERS } from '../data/fleet';
import type { WorkOrder } from '../data/types';
import { MONTH_LABELS, UNIT_NAMES, UnitFilter, UnitName, hashStr, monthIdx, unitsOf } from './data';

export type StockEstado = 'Crítico' | 'Reponer' | 'OK' | 'Sobrestock';
export interface StockRow {
  code: string; name: string; unit: string; price: number; comp: string; system: string;
  stock: number; min: number; consumoMes: number; cobertura: number; estado: StockEstado; valor: number; sugerido: number;
  porBase: { u: UnitName; stock: number; consumoMes: number }[];
}
const END = new Date(2026, 8, 30, 23, 59).getTime();
const D90 = 90 * 86400000;

function consumo(code: string, u: UnitName) {
  let q = 0;
  for (const o of ALL_ORDERS) {
    if (o.base !== u || !o.closed || END - o.closed.getTime() > D90) continue;
    for (const m of o.materials) if (m.code === code) q += m.qty;
  }
  return q / 3;
}
const cache = new Map<string, { stock: number; min: number; consumoMes: number }>();
function baseStock(code: string, u: UnitName) {
  const k = `${code}|${u}`; if (cache.has(k)) return cache.get(k)!;
  const c = consumo(code, u); const h = (hashStr(k) % 1000) / 1000;
  const min = Math.max(1, Math.ceil(c * 1.0));
  // perfil: la mayoría OK, algunos críticos / a reponer / sobrestock
  const f = h < 0.1 ? 0.25 : h < 0.25 ? 0.75 : h < 0.88 ? 1.2 + h * 1.2 : 3.2 + h;
  const stock = Math.max(0, Math.round((c > 0 ? c : 1.5) * f));
  const r = { stock, min, consumoMes: c };
  cache.set(k, r); return r;
}
export function stockRows(f: UnitFilter): StockRow[] {
  const us = unitsOf(f);
  return materials.map((m) => {
    const porBase = us.map((u) => ({ u, ...baseStock(m.code, u) }));
    const stock = porBase.reduce((s, x) => s + x.stock, 0); const min = porBase.reduce((s, x) => s + x.min, 0); const cm = porBase.reduce((s, x) => s + x.consumoMes, 0);
    const estado: StockEstado = stock < min * 0.5 ? 'Crítico' : stock < min ? 'Reponer' : cm > 0 && stock > cm * 3 ? 'Sobrestock' : 'OK';
    const comp = componentById[m.component];
    return { code: m.code, name: m.name, unit: m.unit, price: m.price, comp: comp?.name ?? m.component, system: comp?.system ?? '—', stock, min, consumoMes: cm, cobertura: cm > 0 ? (stock / cm) * 30 : Infinity, estado, valor: stock * m.price, sugerido: Math.max(0, Math.ceil(min * 2 - stock)), porBase: porBase.map(({ u, stock: s, consumoMes }) => ({ u, stock: s, consumoMes })) };
  });
}
/** Consumo mensual de un material (12 meses) y OT recientes que lo usaron. */
export function materialDetail(code: string, f: UnitFilter) {
  const us = unitsOf(f);
  const months = MONTH_LABELS.map((m) => ({ m, qty: 0, importe: 0 }));
  const recent: { o: WorkOrder; qty: number }[] = [];
  for (const o of ALL_ORDERS) {
    if (!us.includes(o.base as UnitName) || !o.closed) continue;
    const ln = o.materials.find((x) => x.code === code); if (!ln) continue;
    const mi = monthIdx(o.closed); if (mi >= 0 && mi < 12) { months[mi].qty += ln.qty; months[mi].importe += ln.qty * ln.price; }
    recent.push({ o, qty: ln.qty });
  }
  recent.sort((a, b) => b.o.closed!.getTime() - a.o.closed!.getTime());
  return { months, recent: recent.slice(0, 12) };
}
export const ALL_BASES = UNIT_NAMES;
