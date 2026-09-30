// Datos de Taller y Mantenimiento: coches, órdenes de trabajo, materiales, preventivos y rankings.
import { Agg, DATA, FLEET_SIZE, UNIT_NAMES, UnitFilter, UnitName, aggregate, clamp, distribute, hashStr, mulberry32, unitsOf } from './data';

export const SECTORS = ['Electricidad', 'Motor', 'Frenos', 'Carrocería', 'Suspensión', 'Climatización', 'Neumáticos', 'Transmisión'] as const;
export type Sector = (typeof SECTORS)[number];
export const SECTOR_W: Record<Sector, number> = { Electricidad: 29, Motor: 22, Frenos: 17, 'Carrocería': 12, 'Suspensión': 8, 'Climatización': 6, 'Neumáticos': 4, 'Transmisión': 2 };
export const SECTOR_COLOR: Record<Sector, string> = { Electricidad: '#3b82f6', Motor: '#f59e0b', Frenos: '#ef4444', 'Carrocería': '#a855f7', 'Suspensión': '#14b8a6', 'Climatización': '#22d3ee', 'Neumáticos': '#94a3b8', 'Transmisión': '#f97316' };
const SECTOR_COST: Record<Sector, number> = { Electricidad: 42, Motor: 210, Frenos: 88, 'Carrocería': 74, 'Suspensión': 150, 'Climatización': 96, 'Neumáticos': 60, 'Transmisión': 260 };

export type AnchorKey = 'motor' | 'caja' | 'freno-del' | 'freno-tras' | 'susp-del' | 'susp-tras' | 'neum-del' | 'neum-tras' | 'bateria' | 'luces' | 'tablero' | 'puerta-del' | 'puerta-cen' | 'vidrio' | 'panel' | 'aire';
export const ANCHOR_LABEL: Record<AnchorKey, string> = {
  motor: 'Motor trasero', caja: 'Caja de cambios', 'freno-del': 'Freno · eje delantero', 'freno-tras': 'Freno · eje trasero', 'susp-del': 'Suspensión · eje delantero', 'susp-tras': 'Suspensión · eje trasero',
  'neum-del': 'Neumático delantero', 'neum-tras': 'Neumático trasero', bateria: 'Baterías', luces: 'Luces delanteras', tablero: 'Tablero de conducción', 'puerta-del': 'Puerta delantera', 'puerta-cen': 'Puerta central',
  vidrio: 'Ventanilla lateral', panel: 'Panel lateral', aire: 'Equipo de A/A (techo)',
};
export interface Problem { text: string; sector: Sector; anchor: AnchorKey }
export const PROBLEMS: Problem[] = [
  { text: 'No funciona giro der.', sector: 'Electricidad', anchor: 'luces' }, { text: 'Luces de freno intermitentes', sector: 'Electricidad', anchor: 'luces' }, { text: 'Falla en tablero de instrumentos', sector: 'Electricidad', anchor: 'tablero' }, { text: 'Batería no carga', sector: 'Electricidad', anchor: 'bateria' },
  { text: 'Pérdida de aceite', sector: 'Motor', anchor: 'motor' }, { text: 'Sobrecalentamiento', sector: 'Motor', anchor: 'motor' }, { text: 'Pérdida de potencia', sector: 'Motor', anchor: 'motor' }, { text: 'Humo excesivo en escape', sector: 'Motor', anchor: 'motor' },
  { text: 'Pérdida de aire', sector: 'Frenos', anchor: 'freno-del' }, { text: 'Ruido al frenar', sector: 'Frenos', anchor: 'freno-del' }, { text: 'Pastillas desgastadas', sector: 'Frenos', anchor: 'freno-tras' },
  { text: 'Puerta delantera', sector: 'Carrocería', anchor: 'puerta-del' }, { text: 'Puerta central no cierra', sector: 'Carrocería', anchor: 'puerta-cen' }, { text: 'Vidrio roto', sector: 'Carrocería', anchor: 'vidrio' }, { text: 'Panel lateral suelto', sector: 'Carrocería', anchor: 'panel' },
  { text: 'Fuelle de aire roto', sector: 'Suspensión', anchor: 'susp-del' }, { text: 'Amortiguador con pérdida', sector: 'Suspensión', anchor: 'susp-tras' },
  { text: 'No enfría', sector: 'Climatización', anchor: 'aire' }, { text: 'Ventilador ruidoso', sector: 'Climatización', anchor: 'aire' },
  { text: 'Desgaste irregular', sector: 'Neumáticos', anchor: 'neum-del' }, { text: 'Pinchadura', sector: 'Neumáticos', anchor: 'neum-tras' },
  { text: 'Patina el embrague', sector: 'Transmisión', anchor: 'caja' }, { text: 'Ruido en caja de cambios', sector: 'Transmisión', anchor: 'caja' },
];
export interface Part { code: string; desc: string; price: number; qty: [number, number] }
export const PARTS: Record<Sector, Part[]> = {
  Electricidad: [{ code: '600310', desc: 'Batería 12V 150Ah', price: 210000, qty: [1, 2] }, { code: '610120', desc: 'Lámpara LED giro', price: 9800, qty: [2, 4] }, { code: '610240', desc: 'Relé 24V', price: 7400, qty: [1, 3] }, { code: '610330', desc: 'Arnés de cableado (tramo)', price: 46000, qty: [1, 1] }, { code: '610410', desc: 'Alternador 24V', price: 385000, qty: [1, 1] }],
  Motor: [{ code: '500220', desc: 'Aceite motor 15W40 (20 L)', price: 89000, qty: [1, 2] }, { code: '100205', desc: 'Filtro de aceite motor', price: 12500, qty: [1, 2] }, { code: '410045', desc: 'Correa Poly V', price: 32000, qty: [1, 2] }, { code: '500310', desc: 'Junta de tapa de cilindros', price: 74000, qty: [1, 1] }, { code: '500450', desc: 'Termostato', price: 28000, qty: [1, 1] }, { code: '500520', desc: 'Manguera de refrigeración', price: 21000, qty: [2, 3] }],
  Frenos: [{ code: '200315', desc: 'Pastilla de freno (juego)', price: 25000, qty: [2, 4] }, { code: '200410', desc: 'Válvula de freno', price: 96000, qty: [1, 1] }, { code: '200520', desc: 'Cámara de freno', price: 58000, qty: [1, 2] }, { code: '200630', desc: 'Tambor de freno', price: 145000, qty: [1, 2] }, { code: '200710', desc: 'Retén de rueda', price: 36000, qty: [2, 2] }],
  'Carrocería': [{ code: '800410', desc: 'Faro delantero', price: 320000, qty: [1, 1] }, { code: '800520', desc: 'Cerradura de puerta', price: 64000, qty: [1, 1] }, { code: '800630', desc: 'Vidrio laminado lateral', price: 180000, qty: [1, 1] }, { code: '800710', desc: 'Kit de sellado y remaches', price: 15000, qty: [1, 3] }, { code: '800820', desc: 'Cilindro neumático de puerta', price: 88000, qty: [1, 2] }],
  'Suspensión': [{ code: '700150', desc: 'Amortiguador delantero', price: 185000, qty: [1, 2] }, { code: '700260', desc: 'Fuelle de suspensión neumática', price: 132000, qty: [1, 2] }, { code: '700340', desc: 'Buje de barra estabilizadora', price: 18000, qty: [2, 4] }, { code: '700450', desc: 'Válvula niveladora', price: 94000, qty: [1, 1] }],
  'Climatización': [{ code: '300125', desc: 'Filtro de aire', price: 18000, qty: [1, 2] }, { code: '900310', desc: 'Compresor de A/A', price: 520000, qty: [1, 1] }, { code: '900420', desc: 'Gas refrigerante R134a (kg)', price: 14500, qty: [3, 6] }, { code: '900530', desc: 'Motor ventilador evaporador', price: 112000, qty: [1, 1] }],
  'Neumáticos': [{ code: '950100', desc: 'Neumático 295/80 R22.5', price: 410000, qty: [1, 2] }, { code: '950210', desc: 'Válvula de neumático', price: 4200, qty: [1, 2] }, { code: '950320', desc: 'Balanceo y alineación (serv.)', price: 30000, qty: [1, 1] }],
  'Transmisión': [{ code: '900110', desc: 'Kit de embrague', price: 640000, qty: [1, 1] }, { code: '900205', desc: 'Aceite de transmisión (L)', price: 8600, qty: [12, 18] }, { code: '900330', desc: 'Sincronizador', price: 210000, qty: [1, 1] }],
};
export const MECHANICS = ['Juan Pérez', 'Carlos Díaz', 'Miguel López', 'Pedro Romero', 'Sergio Ruiz', 'Luis Acosta', 'Marcos Vega', 'Diego Sosa'];
const LABOR_RATE = 9800; // $/hora (mock)

export type BusEstado = 'Operativa' | 'En reparación' | 'Esperando repuestos' | 'Fuera de servicio';
export interface Bus { id: string; interno: number; dominio: string; unit: UnitName; modelo: string; km: number; anio: number; ot12: number; salud: number; estado: BusEstado }
const MODELS = ['OH 1621', 'OH 1722', 'OH 1721', 'OH 1618', 'OF 1519'];
const INTERNO_BASE: Record<UnitName, number> = { 'Córdoba': 100, Comodoro: 300, 'San Luis': 500, 'Villa Mercedes': 700 };
const LETTERS = 'ABCDEFGHJKLMNPRSTUVXZ';
const OUT_PCT: Record<UnitName, number> = { 'Córdoba': 6.3, Comodoro: 10.7, 'San Luis': 6.9, 'Villa Mercedes': 14 };

function genBuses(): Bus[] {
  const all: Bus[] = [];
  for (const u of UNIT_NAMES) {
    const r = mulberry32(hashStr(`bus-${u}`));
    const list: Bus[] = [];
    for (let i = 0; i < FLEET_SIZE[u]; i++) {
      const interno = INTERNO_BASE[u] + i + 1;
      const L = () => LETTERS[Math.floor(r() * LETTERS.length)];
      const dominio = `${L()}${L()} ${String(100 + Math.floor(r() * 900))} ${L()}${L()}`;
      const km = Math.round((180000 + r() * 580000) / 100) * 100;
      const ot12 = Math.round(3 + 22 * Math.pow(r(), 3.2));
      const salud = Math.round(clamp(98 - ot12 * 1.1 - (km - 300000) / 40000 + (r() * 12 - 6), 42, 99));
      list.push({ id: `${u}-${interno}`, interno, dominio, unit: u, modelo: MODELS[Math.floor(r() * MODELS.length)], km, anio: 2012 + Math.floor(r() * 13), ot12, salud, estado: 'Operativa' });
    }
    const nOut = Math.round((FLEET_SIZE[u] * OUT_PCT[u]) / 100);
    [...list].sort((a, b) => a.salud - b.salud).slice(0, nOut).forEach((b, i) => { b.estado = i < nOut * 0.6 ? 'En reparación' : i < nOut * 0.9 ? 'Esperando repuestos' : 'Fuera de servicio'; });
    all.push(...list);
  }
  return all;
}
export const BUSES: Bus[] = genBuses();
export const busesOf = (f: UnitFilter) => BUSES.filter((b) => unitsOf(f).includes(b.unit));

// ---------- fechas ----------
const END = new Date(2026, 8, 30);
export const dstr = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
export const daysAgo = (n: number, base: Date = END) => { const d = new Date(base); d.setDate(d.getDate() - n); return d; };
export const monthEnd = (m: number) => new Date(2025, 9 + m + 1, 0); // m=0 → oct-2025

// ---------- órdenes de trabajo ----------
export type OTEstado = 'En proceso' | 'Espera repuesto' | 'Pendiente' | 'Cerrada';
export interface Material { code: string; desc: string; qty: number; price: number }
export interface OT {
  id: string; bus: Bus; sector: Sector; problem: string; anchor: AnchorKey; mecanico: string; horas: number; estado: OTEstado; fecha: string; abierta: string;
  materiales: Material[]; costoRep: number; costoMO: number;
}
function pickProblem(r: () => number): Problem {
  const total = Object.values(SECTOR_W).reduce((a, b) => a + b, 0);
  let x = r() * total; let sector: Sector = 'Electricidad';
  for (const s of SECTORS) { x -= SECTOR_W[s]; if (x <= 0) { sector = s; break; } }
  const opts = PROBLEMS.filter((p) => p.sector === sector);
  return opts[Math.floor(r() * opts.length)];
}
export function makeOT(bus: Bus, key: string, num: number, estado: OTEstado, ageDays: number, problem?: Problem): OT {
  const r = mulberry32(hashStr(`${bus.id}|${key}|${num}`));
  const p = problem ?? pickProblem(r);
  const parts = [...PARTS[p.sector]].sort(() => r() - 0.5).slice(0, 2 + Math.floor(r() * 2));
  const materiales = parts.map((pt) => ({ code: pt.code, desc: pt.desc, price: pt.price, qty: pt.qty[0] + Math.floor(r() * (pt.qty[1] - pt.qty[0] + 1)) }));
  const horas = Math.round((1.5 + r() * 12) * 2) / 2;
  const costoRep = materiales.reduce((s, m) => s + m.qty * m.price, 0);
  return {
    id: `OT-${2400 + num}`, bus, sector: p.sector, problem: p.text, anchor: p.anchor, mecanico: MECHANICS[Math.floor(r() * MECHANICS.length)], horas, estado,
    fecha: dstr(daysAgo(Math.max(0, ageDays - Math.round(horas / 8)))), abierta: dstr(daysAgo(ageDays)), materiales, costoRep, costoMO: Math.round(horas * LABOR_RATE),
  };
}
export function busHistory(bus: Bus): OT[] {
  const r = mulberry32(hashStr(`hist-${bus.id}`));
  const ages = Array.from({ length: bus.ot12 }, () => Math.floor(r() * 360)).sort((a, b) => a - b);
  return ages.map((age, i) => makeOT(bus, 'h', i + 1 + (bus.interno % 97) * 10, i === 0 && bus.estado !== 'Operativa' ? (bus.estado === 'Esperando repuestos' ? 'Espera repuesto' : 'En proceso') : 'Cerrada', age + (i === 0 ? 0 : 2)));
}

// ---------- vista de Taller ----------
export interface PrevRow { bus: Bus; programado: string; debia: string; estado: 'VENCIDO' | 'POR VENCER' | 'EN TIEMPO'; dias: number }
export interface ReincRow { bus: Bus; sector: Sector; problem: string; anchor: AnchorKey; veces: number; ultima: string }
export interface SectorRow { sector: Sector; count: number; share: number; cost: number }
export interface TallerData {
  agg: Agg; prev: Agg | null; buses: Bus[];
  pendientes: PrevRow[]; abiertas: OT[]; top: Bus[]; reinc: ReincRow[]; sectors: SectorRow[];
  salud: { avg: number; exc: number; att: number; crit: number };
  total: { gasto: number; repuestos: number; mo: number; comb: number; otros: number };
}
export function tallerData(filter: UnitFilter, m: number): TallerData {
  const agg = aggregate(filter, [m]);
  const prev = m > 0 ? aggregate(filter, [m - 1]) : null;
  const buses = busesOf(filter);
  const r = mulberry32(hashStr(`taller-${filter}-${m}`));
  const shuffled = [...buses].sort(() => r() - 0.5);
  const mEnd = monthEnd(m);

  const pendientes: PrevRow[] = shuffled.slice(0, agg.prevPend).map((bus) => {
    const x = r(); const estado: PrevRow['estado'] = x < 0.25 ? 'VENCIDO' : x < 0.7 ? 'POR VENCER' : 'EN TIEMPO';
    const dias = estado === 'VENCIDO' ? 3 + Math.floor(r() * 18) : estado === 'POR VENCER' ? 1 + Math.floor(r() * 10) : 11 + Math.floor(r() * 20);
    const step = 10000 * (1 + Math.floor(r() * 3));
    return { bus, programado: `Service ${fmtKm(Math.ceil(bus.km / step) * step)} km`, debia: dstr(estado === 'VENCIDO' ? daysAgo(dias, mEnd) : daysAgo(-dias, mEnd)), estado, dias };
  }).sort((a, b) => (a.estado === 'VENCIDO' ? 0 : a.estado === 'POR VENCER' ? 1 : 2) - (b.estado === 'VENCIDO' ? 0 : b.estado === 'POR VENCER' ? 1 : 2) || b.dias * (a.estado === 'VENCIDO' ? 1 : -1) - a.dias * (a.estado === 'VENCIDO' ? 1 : -1));

  const shuffled2 = [...buses].sort(() => r() - 0.5);
  const abiertas: OT[] = shuffled2.slice(0, agg.otOpen).map((bus, i) => {
    const est: OTEstado = i % 3 === 0 ? 'Espera repuesto' : i % 7 === 0 ? 'Pendiente' : 'En proceso';
    return makeOT(bus, `open-${m}`, 100 + i * 3 + (m * 13) % 50, est, 1 + Math.floor(r() * 6));
  });

  const top = [...buses].sort((a, b) => b.ot12 - a.ot12 || a.interno - b.interno).slice(0, 15);

  const reinc: ReincRow[] = [];
  let rest = agg.reinc; const pool = [...buses].sort(() => r() - 0.5); let pi = 0;
  while (rest > 0 && pi < pool.length) {
    const veces = Math.min(rest, 1 + Math.floor(r() * 4)); const p = pickProblem(r);
    reinc.push({ bus: pool[pi++], sector: p.sector, problem: p.text, anchor: p.anchor, veces, ultima: dstr(daysAgo(Math.floor(r() * 25), mEnd)) });
    rest -= veces;
  }
  reinc.sort((a, b) => b.veces - a.veces);

  // fallas por sector (12 meses)
  const otYear = Array.from({ length: 12 }, (_, i) => aggregate(filter, [i])).reduce((s, a) => s + a.otClosed, 0);
  const gastoYear = Array.from({ length: 12 }, (_, i) => { const a = aggregate(filter, [i]); return a.cost * a.kmExec; }).reduce((s, v) => s + v, 0);
  const rs = mulberry32(hashStr(`sect-${filter}`));
  const weights = SECTORS.map((s) => SECTOR_W[s] * (0.85 + rs() * 0.3));
  const counts = distribute(otYear, weights);
  const raw = SECTORS.map((s, i) => counts[i] * SECTOR_COST[s]);
  const rawSum = raw.reduce((a, b) => a + b, 0);
  const sectors: SectorRow[] = SECTORS.map((s, i) => ({ sector: s, count: counts[i], share: (counts[i] / otYear) * 100, cost: (raw[i] / rawSum) * gastoYear * 0.86 })).sort((a, b) => b.count - a.count);

  const avg = buses.reduce((s, b) => s + b.salud, 0) / buses.length;
  const salud = { avg: Math.round(avg), exc: buses.filter((b) => b.salud >= 90).length, att: buses.filter((b) => b.salud >= 70 && b.salud < 90).length, crit: buses.filter((b) => b.salud < 70).length };

  const gasto = agg.cost * agg.kmExec;
  const total = { gasto, repuestos: gasto * 0.788, mo: gasto * 0.135, comb: gasto * 0.036, otros: gasto * 0.041 };
  return { agg, prev, buses, pendientes, abiertas, top, reinc, sectors, salud, total };
}
export const fmtKm = (n: number) => n.toLocaleString('es-AR');

// ---------- repuestos y consumos ----------
export interface PartRow { code: string; desc: string; qty: number; price: number; importe: number; share: number }
const TOP_PARTS: { code: string; desc: string; price: number; w: number }[] = [
  { code: '500220', desc: 'Aceite motor 15W40 (20 L)', price: 89000, w: 16 }, { code: '200315', desc: 'Pastilla de freno (juego)', price: 25000, w: 14 }, { code: '600310', desc: 'Batería 12V 150Ah', price: 210000, w: 12 },
  { code: '900110', desc: 'Kit de embrague', price: 640000, w: 11 }, { code: '300125', desc: 'Filtro de aire', price: 18000, w: 9 }, { code: '700150', desc: 'Amortiguador delantero', price: 185000, w: 9 },
  { code: '410045', desc: 'Correa Poly V', price: 32000, w: 8 }, { code: '100205', desc: 'Filtro de aceite motor', price: 12500, w: 8 }, { code: '800410', desc: 'Faro delantero', price: 320000, w: 4 }, { code: '900205', desc: 'Retén de rueda', price: 36000, w: 4 },
];
export function topParts(repuestosTotal: number): PartRow[] {
  const wSum = TOP_PARTS.reduce((s, p) => s + p.w, 0);
  return TOP_PARTS.map((p) => { const qty = Math.max(1, Math.round(((repuestosTotal * 0.87 * p.w) / wSum) / p.price)); const importe = qty * p.price; return { code: p.code, desc: p.desc, qty, price: p.price, importe, share: (importe / repuestosTotal) * 100 }; }).sort((a, b) => b.importe - a.importe);
}
export interface UnitCons { bus: Bus; km: number; lts: number; kmpl: number; rep: number; mant: number; total: number; cpk: number; prev: number; corr: number }
export function unitConsumption(d: TallerData): UnitCons[] {
  const wts = d.buses.map((b) => 0.35 + b.ot12 / 8);
  const wSum = wts.reduce((a, b) => a + b, 0);
  const rows = d.buses.map((bus, i) => {
    const share = wts[i] / wSum;
    const km = Math.round((d.agg.kmExec / d.buses.length) * (0.75 + ((hashStr(bus.id) % 100) / 100) * 0.5));
    const total = d.total.gasto * share; const rep = total * 0.788; const mant = total - rep;
    const kmpl = 2.6 + ((hashStr(bus.id + 'k') % 100) / 100) * 0.9;
    return { bus, km, lts: Math.round(km / kmpl), kmpl, rep, mant, total, cpk: total / km, prev: 1 + (bus.interno % 3), corr: Math.max(1, Math.round(bus.ot12 / 4)) };
  });
  return rows.sort((a, b) => b.total - a.total);
}
