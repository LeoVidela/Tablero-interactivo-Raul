// Tráfico del día (demo): km GPS por hora, real contra ideal, coches en calle, líneas y eventos.
// Al conectar Micronauta / GPS se reemplaza por las fotos horarias reales.
import { FLEET_SIZE, UnitFilter, UnitName, aggregate, distribute, hashStr, lineIds, mulberry32, unitsOf } from './data';
import { Bus, busesOf } from './taller';

// Perfil horario de una jornada completa real (km por hora, relativo)
const W = [0, 0, 0, 0.3, 1.6, 3.6, 5.6, 6.6, 6.1, 5.6, 5.3, 5.5, 5.9, 5.7, 5.3, 5.5, 6.1, 6.5, 6.1, 5.1, 4.1, 3.2, 2.2, 1.2];
const WSUM = W.reduce((s, x) => s + x, 0);
export const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
export const LINE_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#eab308', '#ec4899', '#14b8a6'];

export interface DayBus { bus: Bus; linea: string; km: number; vel: number; estado: 'En servicio' | 'En base' | 'En taller'; demora: number }
export interface DayLine { unit: UnitName; line: string; color: string; km: number; ideal: number; cumpl: number; serv: number; servMeta: number; puntual: number; pax: number; vel: number }
export interface DayEvent { hora: string; unit: UnitName; tipo: string; detalle: string; nivel: 'info' | 'warn' | 'bad'; busId?: string; linea: string }
export interface Day {
  hour: number; prod: number; enlace: number; total: number; ef: number; vel: number; activos: number; flota: number; serv: number; servMeta: number;
  ideal: number; dev: number; idealDay: number; series: { h: string; i: number; real: number | null; ideal: number; kmH: number | null; pax: number | null; puntual: number | null; vel: number | null }[];
  lines: DayLine[]; buses: DayBus[]; events: DayEvent[]; pax: number; puntual: number; demora: number;
}

function unitDay(u: UnitName, iso: string, hour: number): Day {
  const r = mulberry32(hashStr(`traf-${u}-${iso}`));
  const a = aggregate(u, [11]);
  const idealDay = a.kmProg / 30;
  const fac = W.map(() => 0.8 + r() * 0.17);
  const velH = W.map((w) => (w ? 14.5 + r() * 5 + (w < 4 ? 3 : 0) : 0));
  const puntH = W.map((w) => (w ? 82 + r() * 15 - (w > 6 ? 5 : 0) : 0));
  let ci = 0; let cr = 0;
  const series = HOURS.map((h, i) => {
    const pt = { h, i, ideal: Math.round(ci), real: i <= hour ? Math.round(cr) : null, kmH: i < hour ? Math.round(idealDay * W[i] / WSUM * fac[i]) : null, pax: i < hour ? Math.round((a.pax / 30) * (W[i] / WSUM) * fac[i]) : null, puntual: i < hour && W[i] ? +puntH[i].toFixed(1) : null, vel: i < hour && W[i] ? +velH[i].toFixed(1) : null };
    ci += idealDay * W[i] / WSUM; cr += idealDay * W[i] / WSUM * fac[i];
    return pt;
  });
  const prod = series[hour].real ?? 0; const ideal = series[hour].ideal;
  const enlace = +(prod * (0.0012 + r() * 0.012)).toFixed(1);
  const flota = FLEET_SIZE[u];
  const started = hour >= 4;
  const activos = started ? Math.min(flota, Math.round(a.oper * (0.93 + r() * 0.07))) : 0;
  const servMeta = Math.round(a.oper * 0.95);
  const serv = started ? Math.max(0, servMeta - Math.floor(r() * 3)) : 0;
  const done = series.filter((s) => s.vel !== null);
  const vel = done.length ? done.reduce((s, x) => s + (x.vel ?? 0) * (x.kmH ?? 0), 0) / Math.max(1, done.reduce((s, x) => s + (x.kmH ?? 0), 0)) : 0;
  const puntual = done.length ? done.reduce((s, x) => s + (x.puntual ?? 0) * (x.kmH ?? 0), 0) / Math.max(1, done.reduce((s, x) => s + (x.kmH ?? 0), 0)) : 0;
  const pax = series.reduce((s, x) => s + (x.pax ?? 0), 0);

  const ids = lineIds(u);
  const lw = ids.map(() => 0.7 + r() * 0.6);
  const lkm = distribute(Math.round(prod), lw); const lid = distribute(Math.round(ideal), lw.map(() => 1));
  const ls = distribute(serv, lw); const lm = distribute(servMeta, lw);
  const lines: DayLine[] = ids.map((id, i) => ({ unit: u, line: id, color: LINE_COLORS[i % LINE_COLORS.length], km: lkm[i], ideal: lid[i], cumpl: lid[i] ? (lkm[i] / lid[i]) * 100 : 0, serv: ls[i], servMeta: lm[i], puntual: Math.min(99.5, puntual + (r() - 0.5) * 8), pax: Math.round(pax * lw[i] / lw.reduce((s, x) => s + x, 0)), vel: vel + (r() - 0.5) * 3 }));

  const bs = busesOf(u);
  let nServ = 0;
  const buses: DayBus[] = bs.map((b) => {
    const taller = b.estado !== 'Operativa';
    const enServ = !taller && nServ < activos; if (enServ) nServ++;
    const li = Math.floor(r() * ids.length);
    return { bus: b, linea: ids[li], km: enServ ? Math.round((prod / Math.max(1, activos)) * (0.6 + r() * 0.8)) : 0, vel: enServ ? +(vel + (r() - 0.5) * 6).toFixed(1) : 0, estado: taller ? 'En taller' : enServ ? 'En servicio' : 'En base', demora: enServ ? Math.max(0, Math.round((r() - 0.55) * 14)) : 0 };
  });

  const TIPOS: [string, string, DayEvent['nivel']][] = [['Atraso', 'Demora acumulada de {d} min', 'warn'], ['Desvío', 'Desvío por obra vial · {l}', 'warn'], ['Coche de auxilio', 'Cambio de unidad en recorrido', 'bad'], ['Servicio cancelado', 'Falta de unidad de relevo', 'bad'], ['Reclamo', 'Reclamo de pasajero por frecuencia', 'info'], ['Frecuencia normalizada', 'Operación estable', 'info'], ['Exceso de velocidad', 'Alerta GPS · {v} km/h', 'bad']];
  const events: DayEvent[] = [];
  const nEv = hour < 5 ? 0 : 3 + Math.floor(r() * 4);
  for (let k = 0; k < nEv; k++) {
    const [tipo, det, nivel] = TIPOS[Math.floor(r() * TIPOS.length)];
    const hh = 5 + Math.floor(r() * Math.max(1, hour - 5)); const mm = Math.floor(r() * 60);
    const b = buses.filter((x) => x.estado === 'En servicio')[Math.floor(r() * Math.max(1, activos))];
    const linea = b?.linea ?? ids[0];
    events.push({ hora: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, unit: u, tipo, detalle: det.replace('{d}', String(6 + Math.floor(r() * 15))).replace('{l}', `línea ${linea}`).replace('{v}', String(62 + Math.floor(r() * 15))), nivel, busId: b?.bus.id, linea });
  }
  events.sort((x, y) => y.hora.localeCompare(x.hora));
  const total = +(prod + enlace).toFixed(1);
  return { hour, prod, enlace, total, ef: total ? (prod / total) * 100 : 0, vel, activos, flota, serv, servMeta, ideal, dev: prod - ideal, idealDay, series, lines, buses, events, pax, puntual, demora: Math.round(buses.reduce((s, b) => s + b.demora, 0) / Math.max(1, activos) * 10) / 10 };
}

export function trafficDay(filter: UnitFilter, iso: string, hour: number): Day {
  const days = unitsOf(filter).map((u) => unitDay(u, iso, hour));
  if (days.length === 1) return days[0];
  const sum = (k: keyof Day) => days.reduce((s, d) => s + (d[k] as number), 0);
  const prod = sum('prod'); const enlace = +sum('enlace').toFixed(1); const total = +(prod + enlace).toFixed(1);
  const series = days[0].series.map((s, i) => {
    const add = (k: 'real' | 'ideal' | 'kmH' | 'pax') => (days.every((d) => d.series[i][k] !== null) ? days.reduce((t, d) => t + (d.series[i][k] as number), 0) : null);
    const wavg = (k: 'puntual' | 'vel') => (days.every((d) => d.series[i][k] !== null) ? +(days.reduce((t, d) => t + (d.series[i][k] as number) * (d.series[i].kmH ?? 0), 0) / Math.max(1, days.reduce((t, d) => t + (d.series[i].kmH ?? 0), 0))).toFixed(1) : null);
    return { h: s.h, i, real: add('real'), ideal: add('ideal') ?? 0, kmH: add('kmH'), pax: add('pax'), puntual: wavg('puntual'), vel: wavg('vel') };
  });
  const w = (k: 'vel' | 'puntual') => days.reduce((s, d) => s + d[k] * d.prod, 0) / Math.max(1, prod);
  const activos = sum('activos');
  return { hour, prod, enlace, total, ef: total ? (prod / total) * 100 : 0, vel: w('vel'), activos, flota: sum('flota'), serv: sum('serv'), servMeta: sum('servMeta'), ideal: sum('ideal'), dev: prod - sum('ideal'), idealDay: sum('idealDay'), series, lines: days.flatMap((d) => d.lines), buses: days.flatMap((d) => d.buses), events: days.flatMap((d) => d.events).sort((x, y) => y.hora.localeCompare(x.hora)), pax: sum('pax'), puntual: w('puntual'), demora: Math.round(days.reduce((s, d) => s + d.demora * d.activos, 0) / Math.max(1, activos) * 10) / 10 };
}
