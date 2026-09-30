import { materialByCode, templates } from './catalog';
import type { Base, MaterialLine, OTStatus, Unit, UnitStatus, WorkOrder } from './types';

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
const today = new Date(2026, 8, 30, 9, 0, 0, 0); // fecha de corte de la demo (alineada con los tableros de Gerencia)

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

function buildUnits(seed: BaseSeed): Unit[] {
  return Array.from({ length: seed.count }, (_, i) => {
    const year = int(2012, 2024);
    const dailyKm = between(170, 235);
    const km = Math.round((2026.7 - year) * dailyKm * 300 + between(-15000, 15000));
    const base: Omit<Unit, 'orders' | 'status'> = {
      interno: String(seed.first + i), base: seed.name, plate: plateFor(year), chassis: pick(chassisModels), body: pick(bodies), year, km,
      lastServiceKm: km - int(1500, 33500), lastPreventiveKm: km - int(800, 23000), line: pick(seed.lines),
    };
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
  const dailyKm = u.km / Math.max(300, (2026.7 - u.year) * 300);
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
units.forEach(schedulePlan);
export const orders: WorkOrder[] = units.flatMap((u) => u.orders).sort((a, b) => a.opened.getTime() - b.opened.getTime());
orders.forEach((o) => { o.id = `OT-${String(4200 + ++otSeq)}`; });
orders.reverse();

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

export const mechanicsByBase = Object.fromEntries(baseSeeds.map((s) => [s.name, s.mechanics])) as Record<string, string[]>;

export const SERVICE_KM = 30000;
export const PREVENTIVE_KM = 20000;
export const now = today;

export const orderCost = (o: WorkOrder) => o.materials.reduce((s, m) => s + (m.origin === 'Recuperado' ? 0 : m.qty * m.price), 0);
export const isOpen = (o: WorkOrder) => o.status !== 'Cerrada';
export const daysBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY;
export const periodDays: Record<string, number> = { Hoy: 1, '7 días': 7, '30 días': 30, '90 días': 90, '12 meses': 365 };
export const inPeriod = (o: WorkOrder, days: number) => isOpen(o) || daysBetween(o.opened, today) <= days;
