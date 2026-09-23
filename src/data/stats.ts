import type { SpotStat } from '../components/BusDiagram';
import { materialByCode } from './catalog';
import { isOpen } from './fleet';
import type { MaterialLine, WorkOrder } from './types';

/** Componente al que se imputa cada línea de material dentro de una OT. */
export const lineComponent = (o: WorkOrder, m: MaterialLine) => {
  const c = materialByCode[m.code]?.component;
  return c && o.components.includes(c) ? c : o.components[0];
};
export const lineCost = (m: MaterialLine) => (m.origin === 'Recuperado' ? 0 : m.qty * m.price);

export function componentStats(orders: WorkOrder[]): Record<string, SpotStat> {
  const out: Record<string, SpotStat> = {};
  for (const o of orders) {
    for (const c of o.components) {
      const s = (out[c] ??= { count: 0, open: false, cost: 0 });
      s.count += 1; s.open ||= isOpen(o);
      if (!s.last || o.opened > s.last) s.last = o.opened;
    }
    for (const m of o.materials) { const c = lineComponent(o, m); (out[c] ??= { count: 0, open: false, cost: 0 }).cost! += lineCost(m); }
  }
  return out;
}

export type MaterialSummary = { code: string; name: string; unit: string; qty: number; cost: number; orders: number };

export function summarizeMaterials(orders: WorkOrder[], component?: string | null): MaterialSummary[] {
  const map = new Map<string, MaterialSummary & { ids: Set<string> }>();
  for (const o of orders) for (const m of o.materials) {
    if (component && lineComponent(o, m) !== component) continue;
    const row = map.get(m.code) ?? { code: m.code, name: m.name, unit: m.unit, qty: 0, cost: 0, orders: 0, ids: new Set<string>() };
    row.qty += m.qty; row.cost += lineCost(m); row.ids.add(o.id); row.orders = row.ids.size;
    map.set(m.code, row);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost);
}
