import { mechanicsByBase, orders as ALL_ORDERS, units as ALL_UNITS, PREVENTIVE_KM, SERVICE_KM } from '../data/fleet';
// Dataset de demostración de Grupo Solbus (4 unidades de negocio, 12 meses: oct-2025 → sep-2026).
// Todo es determinístico (PRNG con semilla) para que los números sean coherentes entre Gerencia, Tráfico, Taller y RRHH.

export const UNIT_NAMES = ['Córdoba', 'Comodoro', 'San Luis', 'Villa Mercedes'] as const;
export type UnitName = (typeof UNIT_NAMES)[number];
export type UnitFilter = 'Todos' | UnitName;
export const UNIT_FILTERS: UnitFilter[] = ['Todos', ...UNIT_NAMES];
// Colores y flota tomados de la base del tablero (data/fleet.ts): mismos internos, mismas OT.
export const UNIT_COLOR: Record<UnitName, string> = { 'Córdoba': '#E85818', Comodoro: '#199e70', 'San Luis': '#c98500', 'Villa Mercedes': '#d55181' };
export const UNIT_CODE: Record<UnitName, string> = { 'Córdoba': 'COR', Comodoro: 'COM', 'San Luis': 'SLU', 'Villa Mercedes': 'VME' };

export const MONTH_LABELS = ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'];
export const MONTH_FULL = ['Octubre 2025', 'Noviembre 2025', 'Diciembre 2025', 'Enero 2026', 'Febrero 2026', 'Marzo 2026', 'Abril 2026', 'Mayo 2026', 'Junio 2026', 'Julio 2026', 'Agosto 2026', 'Septiembre 2026'];
export const LAST_MONTH = 11;

// ---------- utilidades ----------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const base = raw.map(Math.floor);
  let rest = total - base.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, f: v - Math.floor(v) })).sort((a, b) => b.f - a.f);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) base[order[k].i] += 1;
  return base;
}

// ---------- perfiles por unidad ----------
interface Profile {
  seed: number; fleet: number; kmBus: number; cumpl: number; trend: number; reg: number; outPct: number; aus: number; cob: number;
  sin: number; exc: number; aux: number; cost: number; inc: number; ipk: number; kmpl: number;
  obj: { sin: number; exc: number; aux: number }; // objetivo por trimestre
}
const PROFILES: Record<UnitName, Profile> = {
  'Córdoba': { seed: 1101, fleet: 126, kmBus: 5300, cumpl: 98.4, trend: 0.03, reg: 98.2, outPct: 6.3, aus: 4.6, cob: 98.9, sin: 3.4, exc: 9, aux: 1.2, cost: 24.6, inc: 53.0, ipk: 1.52, kmpl: 3.05, obj: { sin: 9, exc: 24, aux: 3 } },
  Comodoro: { seed: 2202, fleet: 84, kmBus: 5000, cumpl: 96.9, trend: -0.04, reg: 96.8, outPct: 10.7, aus: 7.6, cob: 96.9, sin: 2.6, exc: 8, aux: 1.6, cost: 27.9, inc: 50.5, ipk: 1.31, kmpl: 2.85, obj: { sin: 6, exc: 18, aux: 3 } },
  'San Luis': { seed: 3303, fleet: 72, kmBus: 4700, cumpl: 98.1, trend: 0.02, reg: 98.0, outPct: 6.9, aus: 5.0, cob: 98.4, sin: 1.4, exc: 4, aux: 0.8, cost: 24.1, inc: 51.6, ipk: 1.44, kmpl: 3.1, obj: { sin: 4, exc: 12, aux: 2 } },
  'Villa Mercedes': { seed: 4404, fleet: 86, kmBus: 4500, cumpl: 97.4, trend: 0.0, reg: 97.2, outPct: 14, aus: 6.4, cob: 97.6, sin: 2.3, exc: 10.5, aux: 1.9, cost: 26.8, inc: 49.8, ipk: 1.36, kmpl: 2.95, obj: { sin: 5, exc: 15, aux: 3 } },
};
export const FLEET_SIZE = Object.fromEntries(UNIT_NAMES.map((u) => [u, ALL_UNITS.filter((x) => x.base === u).length])) as Record<UnitName, number>;

export const OBJ = { km: 98, reg: 98, disp: 90, aus: 6, cob: 98, cost: 23 };

export interface MonthRow {
  kmProg: number; kmExec: number; cumpl: number; reg: number; total: number; oper: number; out: number; disp: number;
  aux: number; aus: number; cob: number; sin: number; exc: number; cost: number; inc: number; pax: number; ipk: number;
  otClosed: number; otOpen: number; prevDone: number; prevPend: number; reinc: number; itcVenc: number; itc30: number; itc60: number;
  enRep: number; espRep: number; fuera: number; repTime: number; personal: number; horas: number; lts: number; kmpl: number;
}
const SEASON_KM = [0, 0.01, -0.03, -0.05, -0.06, 0.02, 0.01, 0.02, 0, -0.03, 0.02, 0.03];

function genUnit(unit: UnitName): MonthRow[] {
  const p0 = PROFILES[unit]; const fs = FLEET_SIZE[unit] / p0.fleet;
  const realOut = (ALL_UNITS.filter((x) => x.base === unit && x.status !== 'Operativo').length / FLEET_SIZE[unit]) * 100;
  const p = { ...p0, fleet: FLEET_SIZE[unit], outPct: realOut * 0.92 }; void fs; // siniestros/excesos/auxilios se mantienen en valores absolutos del modelo de Gerencia
  const r = mulberry32(p.seed);
  const n = () => r() * 2 - 1;
  const rows: MonthRow[] = [];
  for (let m = 0; m < 12; m++) {
    const kmProg = Math.round((p.fleet * p.kmBus * (1 + SEASON_KM[m])) / 100) * 100;
    const cumpl = clamp(p.cumpl + n() * 0.9 + (m - 5.5) * p.trend, 93, 99.9);
    const kmExec = Math.round((kmProg * cumpl) / 100 / 10) * 10;
    const reg = clamp(p.reg + n() * 0.8, 92, 99.9);
    const out = Math.max(1, Math.round(((p.fleet * p.outPct) / 100) * (1 + n() * 0.3)));
    const total = p.fleet;
    const oper = total - out;
    const ipk = p.ipk * (1 + n() * 0.04);
    const prevDone = Math.round(p.fleet * (0.8 + n() * 0.05));
    const enRep = Math.round(out * 0.6);
    const espRep = Math.round(out * 0.3);
    const personal = Math.round(p.fleet * 0.7);
    const kmpl = p.kmpl + n() * 0.1;
    rows.push({
      kmProg, kmExec, cumpl: (kmExec / kmProg) * 100, reg, total, oper, out, disp: (oper / total) * 100,
      aux: Math.max(0, Math.round(p.aux + n() * 0.9)), aus: clamp(p.aus + n() * 1.1, 2, 12), cob: clamp(p.cob + n() * 0.7, 94, 100),
      sin: Math.max(0, Math.round(p.sin + n() * p.sin * 0.7)), exc: Math.max(0, Math.round(p.exc + n() * p.exc * 0.5)),
      cost: p.cost * (1 + n() * 0.05), inc: p.inc * (1 + n() * 0.04 + (m - 5.5) * 0.004),
      pax: Math.round((kmExec * ipk) / 10) * 10, ipk,
      otClosed: Math.round(p.fleet * 2.4 * (1 + n() * 0.15)), otOpen: Math.max(1, Math.round(p.fleet * 0.3 * (1 + n() * 0.25))),
      prevDone, prevPend: p.fleet - prevDone, reinc: Math.max(1, Math.round(p.fleet * 0.12 * (1 + n() * 0.4))),
      itcVenc: Math.max(0, Math.round(p.fleet * 0.033 * (1 + n() * 0.5))), itc30: Math.round(p.fleet * 0.1 * (1 + n() * 0.3)), itc60: Math.round(p.fleet * 0.07 * (1 + n() * 0.3)),
      enRep, espRep, fuera: Math.max(0, out - enRep - espRep), repTime: 4.4 + n() * 0.5, personal, horas: Math.round(personal * (43.45 + n() * 3)),
      lts: Math.round(kmExec / kmpl), kmpl,
    });
  }
  return rows;
}
export const DATA: Record<UnitName, MonthRow[]> = {
  'Córdoba': genUnit('Córdoba'), Comodoro: genUnit('Comodoro'), 'San Luis': genUnit('San Luis'), 'Villa Mercedes': genUnit('Villa Mercedes'),
};

// ---------- sincronización con las OT reales de la base ----------
/** Índice de mes (0 = oct-2025 … 11 = sep-2026) de una fecha. */
export const monthIdx = (d: Date) => (d.getFullYear() - 2025) * 12 + d.getMonth() - 9;
export const monthStart = (m: number) => new Date(2025, 9 + m, 1);
export const monthEndDate = (m: number) => new Date(2025, 9 + m + 1, 0, 23, 59, 59);
export const isPlanOrder = (o: { title: string }) => o.title === 'Preventivo 20.000 km' || o.title === 'Service 30.000 km';
/** Coches con preventivo o service vencido / por vencer (a la fecha de corte). */
export const dueCount = (u: UnitName) => ALL_UNITS.filter((x) => x.base === u).reduce((n, x) => n + (x.km - x.lastPreventiveKm >= PREVENTIVE_KM ? 1 : 0) + (x.km - x.lastServiceKm >= SERVICE_KM ? 1 : 0), 0);
for (const u of UNIT_NAMES) {
  const ords = ALL_ORDERS.filter((o) => o.base === u);
  const list = ALL_UNITS.filter((x) => x.base === u);
  const seen = new Map<string, Date[]>();
  const reincByMonth = Array(12).fill(0); const reincSeen = new Set<string>();
  [...ords].filter((o) => !isPlanOrder(o)).sort((a, b) => a.opened.getTime() - b.opened.getTime()).forEach((o) => {
    for (const c of o.components) {
      const k = `${o.unit}|${c}`; const prev = seen.get(k) ?? [];
      if (prev.some((d) => o.opened.getTime() - d.getTime() <= 90 * 86400000)) { const mi = monthIdx(o.opened); const mk = `${mi}|${k}`; if (mi >= 0 && mi < 12 && !reincSeen.has(mk)) { reincSeen.add(mk); reincByMonth[mi]++; } }
      prev.push(o.opened); seen.set(k, prev);
    }
  });
  DATA[u].forEach((row, m) => {
    const end = monthEndDate(m).getTime(); const start = monthStart(m).getTime();
    const closed = ords.filter((o) => o.closed && o.closed.getTime() >= start && o.closed.getTime() <= end);
    row.otClosed = closed.length;
    row.otOpen = ords.filter((o) => o.opened.getTime() <= end && (!o.closed || o.closed.getTime() > end)).length;
    row.prevDone = closed.filter(isPlanOrder).length;
    row.prevPend = 0; // se completa abajo con la relación real del mes de corte
    row.reinc = reincByMonth[m];
    row.repTime = closed.length ? closed.reduce((s, o) => s + o.hours, 0) / closed.length : row.repTime;
    row.personal = mechanicsByBase[u].length;
    row.horas = Math.round(closed.reduce((s, o) => s + o.hours, 0));
  });
  const r11 = dueCount(u) / Math.max(1, DATA[u][11].prevDone);
  DATA[u].forEach((row, m) => { row.prevPend = m === 11 ? dueCount(u) : Math.round(row.prevDone * r11 * (0.8 + ((m * 7) % 5) * 0.08)); });
  const open11 = DATA[u][11].otOpen;
  DATA[u].forEach((row, m) => { if (m < 11) row.otOpen = Math.max(1, Math.round(open11 * (0.78 + ((m * 5) % 7) * 0.05))); }); // OT abiertas al cierre de meses anteriores (la base sólo conserva el estado actual)
  const last = DATA[u][11];
  last.enRep = list.filter((x) => x.status === 'En taller').length; last.espRep = list.filter((x) => x.status === 'Esperando repuesto').length; last.fuera = list.filter((x) => x.status === 'Fuera de servicio').length;
  last.out = last.enRep + last.espRep + last.fuera; last.oper = last.total - last.out; last.disp = (last.oper / last.total) * 100;
}

export const unitsOf = (f: UnitFilter): UnitName[] => (f === 'Todos' ? [...UNIT_NAMES] : [f]);

// ---------- agregación ----------
export interface Agg {
  kmProg: number; kmExec: number; cumpl: number; reg: number; total: number; oper: number; out: number; disp: number;
  aux: number; aus: number; cob: number; sin: number; exc: number; cost: number; inc: number; margin: number; pax: number; ipk: number;
  otClosed: number; otOpen: number; prevDone: number; prevPend: number; reinc: number; itcVenc: number; itc30: number; itc60: number;
  enRep: number; espRep: number; fuera: number; repTime: number; personal: number; horas: number; lts: number;
}
export function aggregate(filter: UnitFilter, months: number[]): Agg {
  const us = unitsOf(filter);
  const a: Agg = {
    kmProg: 0, kmExec: 0, cumpl: 0, reg: 0, total: 0, oper: 0, out: 0, disp: 0, aux: 0, aus: 0, cob: 0, sin: 0, exc: 0, cost: 0, inc: 0, margin: 0, pax: 0, ipk: 0,
    otClosed: 0, otOpen: 0, prevDone: 0, prevPend: 0, reinc: 0, itcVenc: 0, itc30: 0, itc60: 0, enRep: 0, espRep: 0, fuera: 0, repTime: 0, personal: 0, horas: 0, lts: 0,
  };
  const k = months.length;
  let wKm = 0, wFleet = 0, wRep = 0;
  for (const u of us) {
    const fleet = FLEET_SIZE[u];
    for (const m of months) {
      const row = DATA[u][m];
      a.kmProg += row.kmProg; a.kmExec += row.kmExec; a.pax += row.pax;
      a.aux += row.aux; a.sin += row.sin; a.exc += row.exc;
      a.oper += row.oper / k; a.out += row.out / k;
      a.reg += row.reg * row.kmExec; a.cost += row.cost * row.kmExec; a.inc += row.inc * row.kmExec; wKm += row.kmExec;
      a.aus += row.aus * fleet; a.cob += row.cob * fleet; wFleet += fleet;
      a.otClosed += row.otClosed; a.otOpen += row.otOpen / k; a.prevDone += row.prevDone / k; a.prevPend += row.prevPend / k;
      a.reinc += row.reinc; a.itcVenc += row.itcVenc / k; a.itc30 += row.itc30 / k; a.itc60 += row.itc60 / k;
      a.enRep += row.enRep / k; a.espRep += row.espRep / k; a.fuera += row.fuera / k;
      a.repTime += row.repTime * row.otClosed; wRep += row.otClosed;
      a.personal += row.personal / k; a.horas += row.horas; a.lts += row.lts;
    }
    a.total += fleet;
  }
  a.cumpl = (a.kmExec / a.kmProg) * 100;
  a.reg /= wKm; a.cost /= wKm; a.inc /= wKm; a.aus /= wFleet; a.cob /= wFleet; a.repTime /= wRep;
  a.margin = a.inc - a.cost; a.ipk = a.pax / a.kmExec; a.disp = (a.oper / a.total) * 100;
  a.oper = Math.round(a.oper); a.out = Math.round(a.out); a.otOpen = Math.round(a.otOpen); a.prevDone = Math.round(a.prevDone); a.prevPend = Math.round(a.prevPend);
  a.itcVenc = Math.round(a.itcVenc); a.itc30 = Math.round(a.itc30); a.itc60 = Math.round(a.itc60); a.enRep = Math.round(a.enRep); a.espRep = Math.round(a.espRep); a.fuera = Math.round(a.fuera); a.personal = Math.round(a.personal);
  return a;
}
export function objectives(filter: UnitFilter, nMonths: number) {
  const us = unitsOf(filter);
  const f = nMonths / 3;
  return {
    sin: Math.ceil(us.reduce((s, u) => s + PROFILES[u].obj.sin, 0) * f),
    exc: Math.ceil(us.reduce((s, u) => s + PROFILES[u].obj.exc, 0) * f),
    aux: Math.ceil(us.reduce((s, u) => s + PROFILES[u].obj.aux, 0) * f),
  };
}

// ---------- períodos ----------
export interface PeriodDef { id: string; label: string; short: string; months: number[]; prev: number[]; quarter: boolean }
export const PERIODS: PeriodDef[] = [
  { id: 'q3', label: 'Jul – Sep 2026 (trimestre)', short: 'Jul – Sep 2026', months: [9, 10, 11], prev: [6, 7, 8], quarter: true },
  { id: 'q2', label: 'Abr – Jun 2026 (trimestre)', short: 'Abr – Jun 2026', months: [6, 7, 8], prev: [3, 4, 5], quarter: true },
  { id: 'q1', label: 'Ene – Mar 2026 (trimestre)', short: 'Ene – Mar 2026', months: [3, 4, 5], prev: [0, 1, 2], quarter: true },
  ...[11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((m) => ({ id: `m${m}`, label: MONTH_FULL[m], short: MONTH_FULL[m], months: [m], prev: [m - 1], quarter: false })),
];

// ---------- líneas ----------
interface LineDef { id: string; w: number; off: number; ipk: number; sw: number; ew: number }
const LINES: Record<UnitName, LineDef[]> = {
  'Córdoba': [
    { id: '70', w: 18, off: 0.4, ipk: 0.05, sw: 1.2, ew: 1.0 }, { id: '71', w: 16, off: -0.2, ipk: -0.03, sw: 1, ew: 1.1 }, { id: '72', w: 15, off: 0.5, ipk: 0.08, sw: 0.7, ew: 0.6 },
    { id: '73', w: 14, off: -0.6, ipk: -0.06, sw: 1.5, ew: 1.7 }, { id: '74', w: 13, off: 0.1, ipk: 0, sw: 0.8, ew: 0.9 }, { id: '75', w: 12, off: -0.3, ipk: -0.04, sw: 1, ew: 1.2 }, { id: '76', w: 12, off: 0.2, ipk: 0.02, sw: 0.6, ew: 0.5 },
  ],
  Comodoro: [
    { id: 'A', w: 30, off: -0.9, ipk: -0.1, sw: 1.4, ew: 1.5 }, { id: 'B', w: 26, off: 0.3, ipk: 0.06, sw: 0.8, ew: 0.7 }, { id: 'C', w: 24, off: -0.5, ipk: -0.02, sw: 1.6, ew: 1.8 }, { id: 'D', w: 20, off: 0.9, ipk: 0.05, sw: 0.5, ew: 0.6 },
  ],
  'San Luis': [
    { id: '10', w: 28, off: 0.2, ipk: 0.03, sw: 1, ew: 0.9 }, { id: '12', w: 24, off: -0.4, ipk: -0.05, sw: 1.3, ew: 1.4 }, { id: '14', w: 26, off: 0.3, ipk: 0.04, sw: 0.8, ew: 0.8 }, { id: '16', w: 22, off: -0.1, ipk: -0.02, sw: 0.9, ew: 1 },
  ],
  'Villa Mercedes': [
    { id: '21', w: 34, off: 0.4, ipk: 0.05, sw: 0.9, ew: 0.8 }, { id: '22', w: 36, off: -0.6, ipk: -0.06, sw: 1.5, ew: 1.5 }, { id: '23', w: 30, off: 0.2, ipk: 0.01, sw: 0.8, ew: 1 },
  ],
};
export interface LineRow { unit: UnitName; line: string; kmExec: number; cumpl: number; ipk: number; sin: number; exc: number }
export function lineRows(filter: UnitFilter, months: number[]): LineRow[] {
  const out: LineRow[] = [];
  for (const u of unitsOf(filter)) {
    const a = aggregate(u, months);
    const defs = LINES[u];
    const wSum = defs.reduce((s, d) => s + d.w, 0);
    const meanOff = defs.reduce((s, d) => s + d.w * d.off, 0) / wSum;
    const meanIpk = defs.reduce((s, d) => s + d.w * d.ipk, 0) / wSum;
    const km = distribute(Math.round(a.kmExec), defs.map((d) => d.w));
    const sin = distribute(a.sin, defs.map((d) => d.sw));
    const exc = distribute(a.exc, defs.map((d) => d.ew));
    defs.forEach((d, i) => out.push({ unit: u, line: d.id, kmExec: km[i], cumpl: clamp(a.cumpl + d.off - meanOff, 90, 100), ipk: a.ipk + d.ipk - meanIpk, sin: sin[i], exc: exc[i] }));
  }
  return out;
}

// ---------- estado (semáforo) ----------
export type Sem = 'good' | 'warn' | 'bad';
export function semMin(value: number, obj: number, band: number): Sem { return value >= obj ? 'good' : value >= obj - band ? 'warn' : 'bad'; }
export function semMax(value: number, obj: number, band: number): Sem { return value <= obj ? 'good' : value <= obj + band ? 'warn' : 'bad'; }
export type DeltaKind = 'pp' | 'abs' | 'pct';
export function delta(kind: DeltaKind, cur: number, prev: number) { return kind === 'pct' ? ((cur - prev) / prev) * 100 : cur - prev; }
export const lineIds = (u: UnitName) => LINES[u].map((d) => d.id);
