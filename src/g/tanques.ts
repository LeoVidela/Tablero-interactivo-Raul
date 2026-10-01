// Tanques de gasoil por base (demo): aforo diario con regla, stock teórico por libros,
// consumo por medidor de surtidor e ingresos de camión cisterna.
// Al conectarlo se alimenta de la app de ingresos de combustible y del registro de aforos.
import { UnitFilter, UnitName, aggregate, hashStr, mulberry32, unitsOf } from './data';

export interface Tank { id: string; unit: UnitName; nombre: string; cap: number; diam: number; share: number }
export const TANKS: Tank[] = [
  { id: 'CBA-T1', unit: 'Córdoba', nombre: 'Tanque 1 · playa norte', cap: 60000, diam: 260, share: 0.55 },
  { id: 'CBA-T2', unit: 'Córdoba', nombre: 'Tanque 2 · playa sur', cap: 50000, diam: 245, share: 0.45 },
  { id: 'CRD-T1', unit: 'Comodoro', nombre: 'Tanque principal', cap: 45000, diam: 240, share: 1 },
  { id: 'SL-T1', unit: 'San Luis', nombre: 'Tanque principal', cap: 30000, diam: 220, share: 1 },
  { id: 'VM-T1', unit: 'Villa Mercedes', nombre: 'Tanque principal', cap: 25000, diam: 210, share: 1 },
];
export const PROVEEDORES = ['YPF Directo', 'Axion Energy', 'Shell · Raízen'];
export const DIAS = 60;

export interface TankDay { i: number; fecha: string; label: string; medido: number; libro: number; consumo: number; ingreso: number; regla: number; dif: number; difPct: number }
export interface Ingreso { fecha: string; tank: Tank; proveedor: string; remito: string; facturado: number; recibido: number; dif: number; antes: number; despues: number }
export interface TankState { tank: Tank; days: TankDay[]; ingresos: Ingreso[]; nivel: number; pctLleno: number; autonomia: number; consProm: number; reorder: number; ultimo: TankDay }

/** Altura del líquido (cm) en un tanque cilíndrico horizontal para una fracción de volumen. */
export function reglaCm(frac: number, diam: number) {
  let lo = 0; let hi = 1;
  for (let k = 0; k < 30; k++) { const h = (lo + hi) / 2; const th = 2 * Math.acos(1 - 2 * h); const a = (th - Math.sin(th)) / (2 * Math.PI); if (a < frac) lo = h; else hi = h; }
  return Math.round(((lo + hi) / 2) * diam * 10) / 10;
}
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const cache = new Map<string, TankState>();
export function tankState(t: Tank, iso: string): TankState {
  const key = `${t.id}-${iso}`; const hit = cache.get(key); if (hit) return hit;
  const r = mulberry32(hashStr(`tank-${t.id}-${iso.slice(0, 7)}`));
  const end = new Date(`${iso}T12:00:00`);
  const daily = (aggregate(t.unit, [11]).lts / 30) * t.share;
  const reorder = t.cap * 0.3;
  let libro = t.cap * (0.5 + r() * 0.3); let medido = libro;
  const days: TankDay[] = []; const ingresos: Ingreso[] = [];
  for (let i = 0; i < DIAS; i++) {
    const d = new Date(end.getTime() - (DIAS - 1 - i) * 86400000);
    const wk = d.getDay() === 0 ? 0.62 : d.getDay() === 6 ? 0.8 : 1;
    const consumo = Math.round(daily * wk * (0.9 + r() * 0.2));
    let ingreso = 0;
    if (libro - consumo < reorder) {
      const fact = Math.round((t.cap * (0.5 + r() * 0.15)) / 500) * 500;
      const rec = Math.round(fact * (1 - (0.002 + r() * 0.008)));
      const antes = Math.round(medido);
      ingreso = rec;
      const n = ingresos.length + 1;
      ingresos.push({ fecha: `${ddmm(d)}/${d.getFullYear()}`, tank: t, proveedor: PROVEEDORES[Math.floor(r() * PROVEEDORES.length)], remito: `R-${String(hashStr(t.id + i) % 90000 + 10000)}-${n}`, facturado: fact, recibido: rec, dif: rec - fact, antes, despues: antes + rec - consumo });
    }
    libro = libro - consumo + ingreso;
    // la medición con regla acompaña al libro con un pequeño error y alguna merma puntual
    const anom = r() < 0.05 ? -(0.008 + r() * 0.012) * t.cap * 0.4 : 0;
    medido = libro * (1 + (r() - 0.5) * 0.006) + anom;
    const dif = Math.round(medido - libro);
    days.push({ i, fecha: `${ddmm(d)}/${d.getFullYear()}`, label: ddmm(d), medido: Math.round(medido), libro: Math.round(libro), consumo, ingreso, regla: reglaCm(medido / t.cap, t.diam), dif, difPct: (dif / libro) * 100 });
  }
  const ultimo = days[days.length - 1];
  const consProm = days.slice(-7).reduce((s, x) => s + x.consumo, 0) / 7;
  const st: TankState = { tank: t, days, ingresos: ingresos.reverse(), nivel: ultimo.medido, pctLleno: (ultimo.medido / t.cap) * 100, autonomia: ultimo.medido / consProm, consProm, reorder, ultimo };
  cache.set(key, st); return st;
}
export const tanksOf = (f: UnitFilter) => TANKS.filter((t) => unitsOf(f).includes(t.unit));
