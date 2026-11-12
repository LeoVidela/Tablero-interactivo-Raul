import { componentById, materialByCode, templates } from './catalog';
import { SNAP, markReal, warn, type SnapOT, type SnapUnidad } from './source';
import type { Base, MaterialLine, OTStatus, Unit, UnitStatus, WorkOrder } from './types';
import { CORTE } from './window';

/* Generador determinístico: siempre produce la misma flota ficticia. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260923);
const between = (min: number, max: number) => min + rand() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
const DAY = 86_400_000;
const today = CORTE; // fecha de corte (último día del último mes de la ventana)
const YEAR_F = today.getFullYear() + (today.getMonth() + 1) / 12 - 0.05; // año con decimales, para estimar km por antigüedad

type BaseSeed = { name: string; code: string; city: string; color: string; first: number; count: number; lines: string[]; mechanics: string[]; services: number; punctuality: number; absenteeism: number; passengers: number; alerts: number };

const baseSeeds: BaseSeed[] = [
  { name: 'Córdoba', code: 'COR', city: 'Córdoba Capital', color: '#E85818', first: 501, count: 81, lines: ['70', '71', '72', '73', '74', '75', '76'], mechanics: ['Gustavo Ferreyra', 'Martín Quinteros', 'Raúl Ledesma', 'Sergio Bustos', 'Hernán Ceballos', 'Pablo Moyano'], services: 97.2, punctuality: 96.5, absenteeism: 3.8, passengers: 118000, alerts: 2 },
  { name: 'Comodoro', code: 'COM', city: 'Comodoro Rivadavia', color: '#199e70', first: 1001, count: 24, lines: ['A', 'B', 'C', 'D'], mechanics: ['Fabián Aguilar', 'Nahuel Cárdenas', 'Jorge Vidal'], services: 91.5, punctuality: 90.3, absenteeism: 7.1, passengers: 86000, alerts: 5 },
  { name: 'San Luis', code: 'SLU', city: 'San Luis Capital', color: '#c98500', first: 2001, count: 32, lines: ['10', '12', '14', '16'], mechanics: ['Marcelo Ortiz', 'Cristian Lucero', 'Ezequiel Gil'], services: 95.4, punctuality: 94.2, absenteeism: 4.6, passengers: 98000, alerts: 3 },
  { name: 'Villa Mercedes', code: 'VME', city: 'Villa Mercedes', color: '#d55181', first: 3001, count: 26, lines: ['21', '22', '23'], mechanics: ['Walter Sosa', 'Emiliano Funes', 'Ramiro Páez'], services: 93.1, punctuality: 89.8, absenteeism: 5.4, passengers: 71000, alerts: 6 },
];

const chassisModels = ['Mercedes-Benz OH 1721/62', 'Mercedes-Benz OF 1721', 'Mercedes-Benz OH 1621 L', 'Agrale MT 17.0 LE'];
const bodies = ['Italbus Bello', 'Italbus Bello', 'Italbus Tropea', 'Metalpar Iguazú', 'Todo Bus Pompeo'];
const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
const plateFor = (year: number) => year >= 2017
  ? `A${pick(['A', 'B', 'C', 'D', 'E', 'F'])} ${int(100, 999)} ${pick(letters.split(''))}${pick(letters.split(''))}`
  : `${pick(['N', 'O', 'P'])}${pick(letters.split(''))}${pick(letters.split(''))} ${int(100, 999)}`;

const originFor: Record<WorkOrder['type'], string[]> = {
  'Service 30K': ['Plan de mantenimiento por km'],
  'Preventivo 20K': ['Plan preventivo 20.000 km', 'Revisión previa a ITV'],
  Correctivo: ['Novedad de chofer', 'Novedad de chofer', 'Inspección en playa', 'Reclamo de tráfico'],
  'Auxilio en calle': ['Auxilio en calle'],
  Siniestro: ['Informe de siniestro'],
};

const totalWeight = templates.reduce((s, t) => s + t.weight, 0);
const pickTemplate = () => { let r = rand() * totalWeight; for (const t of templates) { r -= t.weight; if (r <= 0) return t; } return templates[0]; };

function buildMaterials(items: [string, number, number][]): MaterialLine[] {
  return items.flatMap(([code, min, max]) => {
    const qty = int(min, max); if (!qty) return [];
    const m = materialByCode[code]; const r = rand();
    return [{ code, name: m.name, unit: m.unit, qty, price: m.price, origin: r < 0.8 ? 'Pañol' : r < 0.94 ? 'Compra directa' : 'Recuperado' } as MaterialLine];
  });
}

let otSeq = 0;
function buildOrder(unit: Omit<Unit, 'orders' | 'status'>, mechanics: string[], daysAgo: number, dailyKm: number, status: OTStatus): WorkOrder {
  const t = pickTemplate();
  const opened = new Date(Math.min(today.getTime() - 3_600_000, today.getTime() - daysAgo * DAY + int(-2, 7) * 3_600_000));
  const hours = Math.round(between(t.hours[0], t.hours[1]) * 2) / 2;
  const closed = status === 'Cerrada' ? new Date(opened.getTime() + (hours + between(1, 40)) * 3_600_000) : undefined;
  return {
    id: '', unit: unit.interno, base: unit.base, type: t.type, status,
    priority: t.type === 'Auxilio en calle' || t.type === 'Siniestro' ? 'Alta' : t.type === 'Correctivo' ? pick(['Alta', 'Media', 'Media', 'Baja']) : 'Baja',
    opened, closed, km: Math.max(0, Math.round(unit.km - daysAgo * dailyKm)), origin: pick(originFor[t.type]),
    components: t.components, title: t.title, diagnosis: t.diagnosis, mechanic: pick(mechanics), hours, materials: buildMaterials(t.items),
  };
}

// ---------- flota y OT reales (snapshot · bloques «unidades» y «ot») ----------
const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const STATUS_IN: [RegExp, UnitStatus][] = [[/repuesto/, 'Esperando repuesto'], [/fuera|baja|radiad/, 'Fuera de servicio'], [/taller|repar|deten/, 'En taller'], [/./, 'Operativo']];
const toStatus = (s: unknown): UnitStatus | null => (s == null || s === '' ? null : STATUS_IN.find(([re]) => re.test(norm(s)))![1]);
const REAL_UNITS = new Map<string, SnapUnidad[]>();
for (const u of SNAP?.unidades ?? []) { if (u && u.base && u.interno != null) { const l = REAL_UNITS.get(u.base) ?? []; l.push({ ...u, interno: String(u.interno) }); REAL_UNITS.set(u.base, l); } }
/** Bases con OT reales en el snapshot: en esas bases no se generan OT de demostración. */
const REAL_OT_BASES = new Set((SNAP?.ot ?? []).map((o) => o.base));
const REAL_OT = REAL_OT_BASES.size > 0;
export const FLEET_REAL = { unidades: [...REAL_UNITS.keys()], ot: [...REAL_OT_BASES] };

function buildUnits(seed: BaseSeed): Unit[] {
  const real = REAL_UNITS.get(seed.name);
  return Array.from({ length: real ? real.length : seed.count }, (_, i) => {
    const ru = real?.[i];
    const year = ru?.anio && ru.anio > 1980 ? ru.anio : int(2012, 2024);
    const dailyKm = between(170, 235);
    const km = typeof ru?.km === 'number' && ru.km >= 0 ? Math.round(ru.km) : Math.round((YEAR_F - year) * dailyKm * 300 + between(-15000, 15000));
    const base: Omit<Unit, 'orders' | 'status'> = {
      interno: ru ? ru.interno : String(seed.first + i), base: seed.name, plate: ru?.dominio || plateFor(year), chassis: ru?.chasis || pick(chassisModels), body: ru?.carroceria || pick(bodies), year, km,
      lastServiceKm: typeof ru?.ultServiceKm === 'number' ? ru.ultServiceKm : km - int(1500, 33500), lastPreventiveKm: typeof ru?.ultPreventivoKm === 'number' ? ru.ultPreventivoKm : km - int(800, 23000), line: ru?.linea || pick(seed.lines),
    };
    if (REAL_OT_BASES.has(seed.name)) return { ...base, status: toStatus(ru?.estado) ?? 'Operativo', orders: [] }; // sus OT llegan del snapshot
    if (ru) {
      const st = toStatus(ru.estado);
      if (st) { // estado real: las OT siguen siendo de demostración hasta que llegue el bloque «ot»
        const orders: WorkOrder[] = Array.from({ length: int(5, 14) }, () => buildOrder(base, seed.mechanics, int(3, 365), dailyKm, 'Cerrada'));
        if (st === 'En taller') orders.push(buildOrder(base, seed.mechanics, int(0, 2), dailyKm, pick(['Abierta', 'En curso'])));
        else if (st === 'Esperando repuesto') orders.push(buildOrder(base, seed.mechanics, int(2, 9), dailyKm, 'Esperando repuesto'));
        else if (st === 'Fuera de servicio') { const o = buildOrder(base, seed.mechanics, int(1, 14), dailyKm, pick(['En curso', 'Esperando repuesto'])); o.priority = 'Alta'; orders.push(o); }
        orders.sort((a, b) => b.opened.getTime() - a.opened.getTime());
        return { ...base, status: st, orders };
      }
    }
    const orders: WorkOrder[] = Array.from({ length: int(5, 14) }, () => buildOrder(base, seed.mechanics, int(3, 365), dailyKm, 'Cerrada'));
    const r = rand();
    let status: UnitStatus = 'Operativo';
    if (r < 0.1) { status = 'En taller'; orders.push(buildOrder(base, seed.mechanics, int(0, 2), dailyKm, pick(['Abierta', 'En curso']))); }
    else if (r < 0.14) { status = 'Esperando repuesto'; orders.push(buildOrder(base, seed.mechanics, int(2, 9), dailyKm, 'Esperando repuesto')); }
    else if (r < 0.17) { status = 'Fuera de servicio'; const o = buildOrder(base, seed.mechanics, int(1, 14), dailyKm, pick(['En curso', 'Esperando repuesto'])); o.priority = 'Alta'; orders.push(o); }
    orders.sort((a, b) => b.opened.getTime() - a.opened.getTime());
    return { ...base, status, orders };
  });
}

export const units: Unit[] = baseSeeds.flatMap(buildUnits);

/* Plan de mantenimiento por km: cada coche tiene sus preventivos (20.000 km) y services (30.000 km) como OT reales,
   y el "último preventivo / service" de la ficha sale de esas OT. Usa un generador propio por coche para no
   alterar el resto de la flota (internos, dominios, estados y correctivos quedan iguales). */
const PLAN_TITLES = ['Preventivo 20.000 km', 'Service 30.000 km'];
function schedulePlan(u: Unit) {
  const seed = baseSeeds.find((b) => b.name === u.base)!;
  const r = mulberry32(20260930 + Number(u.interno) * 7919);
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const dailyKm = u.km / Math.max(300, (YEAR_F - u.year) * 300);
  u.orders = u.orders.filter((o) => !(PLAN_TITLES.includes(o.title) && o.status === 'Cerrada'));
  const add = (type: 'Preventivo 20K' | 'Service 30K', every: number) => {
    const t = templates.find((x) => x.type === type && PLAN_TITLES.includes(x.title))!;
    const late = r() < 0.12 ? ri(1, 12000) : 0; // ~12% de los coches con el plan vencido
    let last = u.km - ri(300, every - 600) - late;
    const lastDone = last;
    for (let k = 0; k < 8; k++, last -= every) {
      const days = (u.km - last) / dailyKm; if (days > 365) break;
      const opened = new Date(today.getTime() - days * DAY + ri(7, 10) * 3_600_000);
      const hours = Math.round((t.hours[0] + r() * (t.hours[1] - t.hours[0])) * 2) / 2;
      const materials = t.items.flatMap(([code, mn, mx]) => { const qty = ri(mn, mx); if (!qty) return []; const m = materialByCode[code]; return [{ code, name: m.name, unit: m.unit, qty, price: m.price, origin: 'Pañol' as const }]; });
      u.orders.push({ id: '', unit: u.interno, base: u.base, type, status: 'Cerrada', priority: 'Baja', opened, closed: new Date(opened.getTime() + (hours + ri(1, 20)) * 3_600_000), km: Math.round(last), origin: 'Plan de mantenimiento por km', components: t.components, title: t.title, diagnosis: t.diagnosis, mechanic: seed.mechanics[ri(0, seed.mechanics.length - 1)], hours, materials });
    }
    return Math.round(lastDone);
  };
  u.lastPreventiveKm = add('Preventivo 20K', PREVENTIVE_KM_);
  u.lastServiceKm = add('Service 30K', SERVICE_KM_);
  u.orders.sort((a, b) => b.opened.getTime() - a.opened.getTime());
}
const PREVENTIVE_KM_ = 20000; const SERVICE_KM_ = 30000;
const TYPE_IN: [RegExp, WorkOrder['type']][] = [[/service|30/, 'Service 30K'], [/prevent|20/, 'Preventivo 20K'], [/auxilio|sos/, 'Auxilio en calle'], [/siniestro|choque/, 'Siniestro'], [/./, 'Correctivo']];
const OTSTATUS_IN: [RegExp, OTStatus][] = [[/cerr|final|termin|cumpl/, 'Cerrada'], [/repuesto/, 'Esperando repuesto'], [/curso|proceso|repar/, 'En curso'], [/./, 'Abierta']];
const UNITS_OK = ['u', 'lts', 'kg', 'm', 'jgo', 'kit'];
/** 'AAAA-MM-DD' se interpreta como fecha local (no UTC) para que no cambie de día ni de mes. */
const parseDay = (v: string, hour = 9) => { const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); return x ? new Date(Number(x[1]), Number(x[2]) - 1, Number(x[3]), hour) : new Date(v); };
function realOrder(o: SnapOT, u: Unit): WorkOrder | null {
  const opened = parseDay(o.abierta); if (isNaN(opened.getTime())) return null;
  const closedD = o.cerrada ? parseDay(o.cerrada, 18) : undefined; let closed = closedD && !isNaN(closedD.getTime()) ? closedD : undefined;
  const type = TYPE_IN.find(([re]) => re.test(norm(o.tipo)))![1];
  const status: OTStatus = closed ? 'Cerrada' : OTSTATUS_IN.find(([re]) => re.test(norm(o.estado)))![1];
  if (status === 'Cerrada' && !closed) closed = opened; // cerrada sin fecha de cierre: se toma la de apertura
  const comps = (o.componentes ?? []).filter((c) => componentById[c]);
  const pr = norm(o.prioridad);
  return {
    id: String(o.id), unit: u.interno, base: u.base, type, status,
    priority: /alta|urg/.test(pr) ? 'Alta' : /baja/.test(pr) ? 'Baja' : type === 'Auxilio en calle' || type === 'Siniestro' ? 'Alta' : 'Media',
    opened, closed, km: Math.max(0, Math.round(o.km ?? u.km)), origin: o.origen || 'Sistema de taller', components: comps.length ? comps : ['chasis'],
    title: o.titulo || (type === 'Preventivo 20K' ? 'Preventivo 20.000 km' : type === 'Service 30K' ? 'Service 30.000 km' : 'Trabajo de taller'), diagnosis: o.diagnostico || 'Sin diagnóstico cargado.',
    mechanic: o.mecanico || 'Sin asignar', hours: Math.max(0, Number(o.horas) || 0),
    materials: (o.materiales ?? []).filter((m) => m && m.nombre).map((m) => ({ code: String(m.codigo ?? ''), name: m.nombre, unit: (UNITS_OK.includes(String(m.unidad)) ? m.unidad : 'u') as MaterialLine['unit'], qty: Number(m.cantidad) || 0, price: Number(m.precio) || 0, origin: (/compra/.test(norm(m.origen)) ? 'Compra directa' : /recup/.test(norm(m.origen)) ? 'Recuperado' : 'Pañol') as MaterialLine['origin'] })),
  };
}
if (REAL_OT) {
  const byId = Object.fromEntries(units.map((u) => [u.interno, u])) as Record<string, Unit>;
  let lost = 0;
  for (const o of SNAP!.ot!) { const u = byId[String(o.interno)]; const w = u && realOrder(o, u); if (w) u.orders.push(w); else lost++; }
  if (lost) warn(`ot: ${lost} órdenes sin coche conocido o sin fecha de apertura (no se muestran)`);
  const lastKm = (u: Unit, t: WorkOrder['type']) => u.orders.filter((o) => o.type === t && o.status === 'Cerrada').reduce((mx, o) => Math.max(mx, o.km), 0);
  units.filter((u) => REAL_OT_BASES.has(u.base)).forEach((u) => {
    u.orders.sort((a, b) => b.opened.getTime() - a.opened.getTime());
    const ru = REAL_UNITS.get(u.base)?.find((x) => x.interno === u.interno);
    if (typeof ru?.ultPreventivoKm !== 'number') u.lastPreventiveKm = lastKm(u, 'Preventivo 20K') || u.km;
    if (typeof ru?.ultServiceKm !== 'number') u.lastServiceKm = lastKm(u, 'Service 30K') || u.km;
    if (!toStatus(ru?.estado)) { const op = u.orders.find((o) => o.status !== 'Cerrada'); if (op) u.status = op.status === 'Esperando repuesto' ? 'Esperando repuesto' : 'En taller'; } // sin estado informado: lo dan sus OT abiertas
  });
}
units.filter((u) => !REAL_OT_BASES.has(u.base)).forEach(schedulePlan);
export const orders: WorkOrder[] = units.flatMap((u) => u.orders).sort((a, b) => a.opened.getTime() - b.opened.getTime());
orders.forEach((o) => { if (!o.id) o.id = `OT-${String(4200 + ++otSeq)}`; });
orders.reverse();
FLEET_REAL.unidades.forEach((b) => markReal('flota.unidades', b, 11));
FLEET_REAL.ot.forEach((b) => markReal('taller.ot', b, 11));

export const unitById = Object.fromEntries(units.map((u) => [u.interno, u])) as Record<string, Unit>;

export const bases: Base[] = baseSeeds.map((s) => {
  const list = units.filter((u) => u.base === s.name);
  const active = list.filter((u) => u.status === 'Operativo').length;
  return {
    name: s.name, code: s.code, city: s.city, color: s.color, services: s.services, punctuality: s.punctuality, absenteeism: s.absenteeism, passengers: s.passengers, alerts: s.alerts,
    vehicles: list.length, activeVehicles: active, fleet: Math.round((active / list.length) * 1000) / 10,
    workshop: list.filter((u) => u.status !== 'Operativo').length,
  };
});

/** Mecánicos por base: los de las OT reales cuando existen; si no, los de demostración. */
export const mechanicsByBase = Object.fromEntries(baseSeeds.map((s) => { const real = REAL_OT_BASES.has(s.name) ? [...new Set(orders.filter((o) => o.base === s.name && o.mechanic !== 'Sin asignar').map((o) => o.mechanic))] : []; return [s.name, real.length ? real : s.mechanics]; })) as Record<string, string[]>;

export const SERVICE_KM = 30000;
export const PREVENTIVE_KM = 20000;
export const now = today;

export const orderCost = (o: WorkOrder) => o.materials.reduce((s, m) => s + (m.origin === 'Recuperado' ? 0 : m.qty * m.price), 0);
export const isOpen = (o: WorkOrder) => o.status !== 'Cerrada';
export const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY;
export const periodDays: Record<string, number> = { Hoy: 1, '7 días': 7, '30 días': 30, '90 días': 90, '12 meses': 365 };
export const inPeriod = (o: WorkOrder, days: number) => isOpen(o) || daysBetween(o.opened, today) <= days;
