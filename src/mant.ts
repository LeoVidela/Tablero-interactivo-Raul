// Reporte mensual de Mantenimiento de Flota: plan preventivo/services, pendientes acumulados,
// correctivos realizados y producción individual del personal. Coherente con aggregate()/tallerData().
import { MONTH_LABELS, UnitFilter, UnitName, aggregate, distribute, hashStr, mulberry32, unitsOf } from './data';
import { Bus, OT, PROBLEMS, busesOf, daysAgo, dstr, makeOT, monthEnd } from './taller';

export const PREV_SHARE = 0.6; // del plan: 60% preventivos, 40% services
export interface Plan { prevProg: number; prevDone: number; prevPend: number; servProg: number; servDone: number; servPend: number }
export function plan(f: UnitFilter, m: number): Plan {
  const a = aggregate(f, [m]);
  const prevProg = Math.round((a.prevDone + a.prevPend) * PREV_SHARE); const prevPend = Math.round(a.prevPend * 0.62);
  const servProg = a.prevDone + a.prevPend - prevProg; const servPend = a.prevPend - prevPend;
  return { prevProg, prevDone: prevProg - prevPend, prevPend, servProg, servDone: servProg - servPend, servPend };
}
export const planEvolution = (f: UnitFilter, m: number, n = 6) => Array.from({ length: n }, (_, k) => m - n + 1 + k).filter((i) => i >= 0).map((i) => {
  const p = plan(f, i); return { m: MONTH_LABELS[i], i, preventivos: +((p.prevDone / p.prevProg) * 100).toFixed(1), services: +((p.servDone / p.servProg) * 100).toFixed(1), total: +(((p.prevDone + p.servDone) / (p.prevProg + p.servProg)) * 100).toFixed(1) };
});

export type PendEstado = 'PENDIENTE' | 'EN TALLER' | 'PROGRAMADO';
export interface PendRow { bus: Bus; tipo: 'Preventivo' | 'Service'; programado: string; km: number; venc: string; dias: number; estado: PendEstado; asignado: string; arrastre: boolean }
const ASSIGN = ['Binomio 1', 'Binomio 2', 'Binomio 3', 'Mecánica'];
export function pendientes(f: UnitFilter, m: number): PendRow[] {
  const p = plan(f, m); const buses = busesOf(f); const r = mulberry32(hashStr(`mpend-${f}-${m}`));
  const pool = [...buses].sort(() => r() - 0.5); const end = monthEnd(m);
  const n = p.prevPend + p.servPend;
  return pool.slice(0, n).map((bus, i) => {
    const tipo = i < p.prevPend ? 'Preventivo' as const : 'Service' as const;
    const x = r(); const dias = x < 0.18 ? 31 + Math.floor(r() * 40) : x < 0.6 ? 8 + Math.floor(r() * 22) : Math.floor(r() * 8);
    const due = daysAgo(dias, end); const estado: PendEstado = dias <= 7 && r() < 0.6 ? 'PROGRAMADO' : r() < 0.25 ? 'EN TALLER' : 'PENDIENTE';
    return { bus, tipo, programado: dstr(due), km: bus.km - Math.round(r() * 20) * 100, venc: dstr(due), dias, estado, asignado: ASSIGN[Math.floor(r() * ASSIGN.length)], arrastre: dias > (end.getDate() - 1) };
  }).sort((a, b) => b.dias - a.dias);
}

export const STAFF_SECTORS = ['Mecánica', 'Electricidad', 'Carrocería', 'Gomería', 'Lubricación'] as const;
const SEC_W = [0.46, 0.2, 0.16, 0.1, 0.08];
const FN = ['Gabriel', 'Lucas', 'Juan', 'Martín', 'Raúl', 'Diego', 'Sergio', 'Hernán', 'Pablo', 'Cristian', 'Ezequiel', 'Rubén', 'Fernando', 'Alejandro', 'Emiliano', 'Jorge', 'Hugo', 'Ramiro', 'Matías', 'Oscar'];
const LN = ['Pérez', 'Torres', 'Díaz', 'Vera', 'Sosa', 'López', 'Romero', 'Acosta', 'Ruiz', 'Vega', 'Medina', 'Ríos', 'Herrera', 'Castro', 'Molina', 'Ortiz', 'Núñez', 'Paz', 'Luna', 'Rojas'];
export interface Staff { id: string; name: string; short: string; unit: UnitName; sector: (typeof STAFF_SECTORS)[number]; w: number }
const staffCache = new Map<string, Staff[]>();
export function staffOf(u: UnitName, n: number): Staff[] {
  const key = `${u}-${n}`; if (staffCache.has(key)) return staffCache.get(key)!;
  const r = mulberry32(hashStr(`staff-${u}`)); const used = new Set<string>(); const out: Staff[] = [];
  while (out.length < n) {
    const f = FN[Math.floor(r() * FN.length)]; const l = LN[Math.floor(r() * LN.length)]; const name = `${f} ${l}`;
    if (used.has(name) && used.size < FN.length * LN.length) continue; used.add(name);
    let x = r(); let si = 0; for (; si < SEC_W.length - 1; si++) { x -= SEC_W[si]; if (x <= 0) break; }
    out.push({ id: `${u}-s${out.length}`, name, short: `${f[0]}. ${l}`, unit: u, sector: STAFF_SECTORS[si], w: 0.5 + r() * 1.2 });
  }
  staffCache.set(key, out); return out;
}
export interface ProdRow { s: Staff; prev: number; serv: number; corr: number; total: number; share: number; horas: number }
export function production(f: UnitFilter, m: number): ProdRow[] {
  const rows: ProdRow[] = [];
  for (const u of unitsOf(f)) {
    const a = aggregate(u, [m]); const p = plan(u, m); const staff = staffOf(u, a.personal);
    const r = mulberry32(hashStr(`prod-${u}-${m}`)); const w = staff.map((s) => s.w * (0.8 + r() * 0.4));
    const mw = staff.map((s, i) => (s.sector === 'Mecánica' || s.sector === 'Lubricación' ? w[i] : w[i] * 0.15));
    const pv = distribute(p.prevDone, mw); const sv = distribute(p.servDone, mw); const cr = distribute(a.otClosed, w); const hs = distribute(a.horas, w);
    staff.forEach((s, i) => rows.push({ s, prev: pv[i], serv: sv[i], corr: cr[i], total: pv[i] + sv[i] + cr[i], share: 0, horas: hs[i] }));
  }
  const tot = rows.reduce((t, x) => t + x.total, 0) || 1;
  rows.forEach((x) => (x.share = (x.total / tot) * 100));
  return rows.sort((a, b) => b.total - a.total);
}

export interface CorrRow { ot: OT; fecha: string; tech: string; sector: string }
const SECTOR_MAP: Record<string, string> = { Motor: 'Mecánica', Frenos: 'Mecánica', 'Suspensión': 'Mecánica', 'Transmisión': 'Mecánica', Electricidad: 'Electricidad', 'Climatización': 'Electricidad', 'Carrocería': 'Carrocería', 'Neumáticos': 'Gomería' };
export function correctivos(f: UnitFilter, m: number, n = 60): CorrRow[] {
  const buses = busesOf(f); const r = mulberry32(hashStr(`corr-${f}-${m}`)); const prod = production(f, m);
  const end = monthEnd(m); const days = end.getDate();
  return Array.from({ length: n }, (_, i) => {
    const bus = buses[Math.floor(r() * buses.length)]; const pr = PROBLEMS[Math.floor(r() * PROBLEMS.length)];
    const age = Math.floor(r() * days) + Math.round((new Date(2026, 8, 30).getTime() - end.getTime()) / 86400000);
    const ot = makeOT(bus, `corr-${m}`, 1200 + i + m * 97, 'Cerrada', age, pr);
    const sector = SECTOR_MAP[pr.sector];
    const cands = prod.filter((x) => x.s.sector === sector && x.s.unit === bus.unit); const a = cands[Math.floor(r() * Math.min(6, cands.length))]; const b = r() < 0.4 ? cands[Math.floor(r() * Math.min(8, cands.length))] : undefined;
    return { ot, fecha: ot.fecha, sector, tech: [a?.s.short, b && b !== a ? b.s.short : undefined].filter(Boolean).join(' / ') || '-' };
  }).sort((x, y) => { const p = (s: string) => s.split('/').reverse().join(''); return p(y.fecha).localeCompare(p(x.fecha)); });
}
