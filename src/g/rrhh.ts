// Datos demo de RR.HH.: resumen mensual por área y análisis individual por legajo.
import { DATA, FLEET_SIZE, UNIT_NAMES, UnitFilter, UnitName, clamp, distribute, hashStr, mulberry32, unitsOf } from './data';
import { dstr } from './taller';

export const AREAS = ['Conducción', 'Técnica', 'Tráfico', 'Administración'] as const;
export type Area = (typeof AREAS)[number];
export const AREA_W = [73, 11.9, 10.2, 5.1];
export const AREA_COLOR: Record<Area, string> = { 'Conducción': '#2563eb', 'Técnica': '#1e3a8a', 'Tráfico': '#f97316', 'Administración': '#14b8a6' };
const SALARY: Record<Area, number> = { 'Conducción': 1_850_000, 'Técnica': 1_720_000, 'Tráfico': 1_640_000, 'Administración': 1_510_000 };

export interface HRTotals { activos: number; altas: number; bajas: number; ausDias: number; ausPct: number; artCant: number; artDias: number; carpCant: number; carpDias: number; susCant: number; susDias: number; remun: number; feriados: number; guardias: number }
const STAFF = (u: UnitName) => Math.round(FLEET_SIZE[u] * 2.35);

function unitMonth(u: UnitName, m: number): HRTotals {
  const r = mulberry32(hashStr(`hr-${u}-${m}`)); const n = () => r() * 2 - 1;
  const st = STAFF(u); const k = st / 295;
  const activos = Math.round(st * (0.945 + m * 0.0055) + n() * 1.5);
  const aus = DATA[u][m].aus;
  return {
    activos, altas: Math.max(0, Math.round((2.2 + n() * 2.2) * k)), bajas: Math.max(0, Math.round((2.0 + n() * 2.0) * k)),
    ausDias: Math.round(activos * 0.27 * (aus / 6) * (1 + n() * 0.15)), ausPct: aus,
    artCant: Math.max(0, Math.round((2.5 + n() * 2) * k)), artDias: Math.round(activos * 0.085 * (1 + n() * 0.35)),
    carpCant: Math.max(1, Math.round((3 + n() * 2) * k)), carpDias: Math.round(activos * 0.12 * (1 + n() * 0.3)),
    susCant: Math.max(0, Math.round((7 + n() * 5) * k)), susDias: Math.round(activos * 0.07 * (1 + n() * 0.4)),
    remun: Math.round(activos * 1_720_000 * (1 + m * 0.012 + n() * 0.01)), feriados: Math.round(activos * 0.14), guardias: Math.round(activos * 0.05),
  };
}
export function hrTotals(filter: UnitFilter, m: number): HRTotals {
  const rows = unitsOf(filter).map((u) => unitMonth(u, m));
  const t = rows.reduce((a, b) => ({ activos: a.activos + b.activos, altas: a.altas + b.altas, bajas: a.bajas + b.bajas, ausDias: a.ausDias + b.ausDias, ausPct: 0, artCant: a.artCant + b.artCant, artDias: a.artDias + b.artDias, carpCant: a.carpCant + b.carpCant, carpDias: a.carpDias + b.carpDias, susCant: a.susCant + b.susCant, susDias: a.susDias + b.susDias, remun: a.remun + b.remun, feriados: a.feriados + b.feriados, guardias: a.guardias + b.guardias }));
  t.ausPct = rows.reduce((s, x) => s + x.ausPct * x.activos, 0) / t.activos;
  return t;
}
export interface AreaRow { area: Area; activos: number; altas: number; bajas: number; remun: number; feriados: number; guardias: number; susCant: number; susDias: number; artCant: number; artDias: number; carpCant: number; carpDias: number }
export function areaRows(t: HRTotals): AreaRow[] {
  const d = (v: number, w: number[] = AREA_W) => distribute(v, w);
  const activos = d(t.activos); const altas = d(t.altas); const bajas = d(t.bajas, [60, 20, 12, 8]);
  const fer = d(t.feriados, [60, 8, 30, 2]); const gua = d(t.guardias, [0, 55, 40, 5]);
  const susC = d(t.susCant, [80, 10, 6, 4]); const susD = d(t.susDias, [75, 12, 8, 5]);
  const artC = d(t.artCant, [70, 25, 5, 0]); const artD = d(t.artDias, [70, 25, 5, 0]);
  const carC = d(t.carpCant, [45, 40, 10, 5]); const carD = d(t.carpDias, [45, 40, 10, 5]);
  return AREAS.map((a, i) => ({ area: a, activos: activos[i], altas: altas[i], bajas: bajas[i], remun: activos[i] * SALARY[a], feriados: fer[i], guardias: gua[i], susCant: susC[i], susDias: susD[i], artCant: artC[i], artDias: artD[i], carpCant: carC[i], carpDias: carD[i] }));
}

// ---------- legajos ----------
const APELLIDOS = ['Sosa', 'Pérez', 'Gómez', 'López', 'Fernández', 'Rodríguez', 'Díaz', 'Acosta', 'Romero', 'Ruiz', 'Vega', 'Torres', 'Molina', 'Herrera', 'Castro', 'Ríos', 'Medina', 'Luna', 'Ortiz', 'Silva'];
const NOMBRES = ['Raúl', 'Juan', 'María', 'Pedro', 'Ana', 'Carlos', 'Luis', 'Marcos', 'Sergio', 'Laura', 'Diego', 'Claudia', 'Martín', 'Julieta', 'Gustavo', 'Nadia', 'Héctor', 'Silvia', 'Pablo', 'Rosana'];
const SECTOR: Record<Area, string[]> = { 'Conducción': ['Línea 1', 'Línea 2', 'Línea 3', 'Línea 4'], 'Técnica': ['Taller mecánico', 'Electricidad', 'Carrocería', 'Gomería'], 'Tráfico': ['Despacho', 'Inspectoría'], 'Administración': ['RR.HH.', 'Contaduría', 'Compras'] };
const SUPERVISOR: Record<Area, string> = { 'Conducción': 'Jefe de Tráfico', 'Técnica': 'Jefe de Taller', 'Tráfico': 'Jefe de Tráfico', 'Administración': 'Gerente Administrativo' };
const LEG_BASE: Record<UnitName, number> = { 'Córdoba': 1001, Comodoro: 2001, 'San Luis': 3001, 'Villa Mercedes': 4001 };
export interface Emp { legajo: number; nombre: string; unit: UnitName; area: Area; sector: string; puesto: string; turno: string; ingreso: string; antig: string; supervisor: string; convenio: string }
const END = new Date(2026, 8, 30);
const PUESTO: Record<Area, (sector: string) => string> = {
  'Conducción': () => 'Chofer de colectivo',
  'Técnica': (s) => ({ 'Taller mecánico': 'Mecánico', 'Electricidad': 'Electricista', 'Carrocería': 'Carrocero', 'Gomería': 'Gomero' } as Record<string, string>)[s] ?? 'Mecánico',
  'Tráfico': (s) => (s === 'Despacho' ? 'Despachante' : 'Inspector'),
  'Administración': (s) => `Administrativo de ${s}`,
};
const TURNOS = ['Mañana', 'Tarde', 'Noche', 'Rotativo'];
function antig(ing: Date, to: Date) { const months = Math.max(0, (to.getFullYear() - ing.getFullYear()) * 12 + (to.getMonth() - ing.getMonth())); return `${Math.floor(months / 12)} años, ${months % 12} meses`; }
function makeEmp(u: UnitName, legajo: number, area: Area, r: () => number, ing: Date): Emp {
  const sectors = SECTOR[area]; const sector = area === 'Conducción' ? `Línea ${1 + Math.floor(r() * 4)}` : sectors[Math.floor(r() * sectors.length)];
  return { legajo, nombre: `${APELLIDOS[Math.floor(r() * APELLIDOS.length)]} ${NOMBRES[Math.floor(r() * NOMBRES.length)]}`, unit: u, area, sector, puesto: PUESTO[area](sector), turno: area === 'Administración' ? 'Mañana' : TURNOS[Math.floor(r() * TURNOS.length)], ingreso: dstr(ing), antig: antig(ing, END), supervisor: SUPERVISOR[area], convenio: area === 'Administración' ? 'Empleados de comercio' : 'UTA' };
}
/** Plantel por base y área (orden estable): el mes toma los primeros N de cada área. */
const POOL: Record<UnitName, Record<Area, Emp[]>> = Object.fromEntries(UNIT_NAMES.map((u) => {
  const r = mulberry32(hashStr(`emp-${u}`)); const size = Math.ceil(STAFF(u) * 1.04) + 4;
  const per = distribute(size, AREA_W); let leg = LEG_BASE[u];
  const byArea = Object.fromEntries(AREAS.map((a, ai) => [a, Array.from({ length: per[ai] + 3 }, () => makeEmp(u, leg++, a, r, new Date(2008 + Math.floor(r() * 17), Math.floor(r() * 12), 1 + Math.floor(r() * 27))))])) as Record<Area, Emp[]>;
  return [u, byArea];
})) as Record<UnitName, Record<Area, Emp[]>>;
export const EMPS: Emp[] = UNIT_NAMES.flatMap((u) => AREAS.flatMap((a) => POOL[u][a]));

// ---------- listas del mes (detalle de cada indicador) ----------
const monthDate = (m: number, day: number) => new Date(m < 3 ? 2025 : 2026, (9 + m) % 12, day);
const daysIn = (m: number) => new Date(m < 3 ? 2025 : 2026, (9 + m) % 12 + 1, 0).getDate();
export interface Alta { emp: Emp; fecha: string; motivo: string; contrato: string }
export interface Baja { emp: Emp; fecha: string; motivo: string }
export interface Ausencia { emp: Emp; fecha: string; dias: number; tipo: string; justificada: boolean }
export interface CasoART { emp: Emp; fecha: string; tipo: string; lesion: string; dias: number; estado: string; prestador: string; siniestro: string }
export interface Carpeta { emp: Emp; desde: string; hasta: string; dias: number; diagnostico: string; validacion: string }
export interface HRLists { activos: Emp[]; altas: Alta[]; bajas: Baja[]; aus: Ausencia[]; art: CasoART[]; carp: Carpeta[] }

export function roster(u: UnitName, m: number): Emp[] {
  const n = distribute(unitMonth(u, m).activos, AREA_W);
  return AREAS.flatMap((a, i) => POOL[u][a].slice(0, n[i]));
}
function splitDays(total: number, n: number, r: () => number): number[] {
  if (n <= 0) return [];
  return distribute(total, Array.from({ length: n }, () => 0.4 + r()));
}
const listCache = new Map<string, HRLists>();
export function hrLists(filter: UnitFilter, m: number): HRLists {
  const key = `${filter}-${m}`; const hit = listCache.get(key); if (hit) return hit;
  const out: HRLists = { activos: [], altas: [], bajas: [], aus: [], art: [], carp: [] };
  for (const u of unitsOf(filter)) {
    const t = unitMonth(u, m); const r = mulberry32(hashStr(`hrl-${u}-${m}`)); const ros = roster(u, m);
    const pick = (pool: Emp[] = ros) => pool[Math.floor(r() * pool.length)];
    const day = () => 1 + Math.floor(r() * daysIn(m));
    const byArea = (ws: number[]) => { const x = r() * ws.reduce((s, w) => s + w, 0); let acc = 0; for (let i = 0; i < ws.length; i++) { acc += ws[i]; if (x <= acc) return AREAS[i]; } return AREAS[0]; };
    out.activos.push(...ros);
    for (let k = 0; k < t.altas; k++) { const area = byArea(AREA_W); const d = monthDate(m, day()); const e = makeEmp(u, LEG_BASE[u] + 600 + m * 12 + k, area, r, d); out.altas.push({ emp: e, fecha: dstr(d), motivo: ['Reemplazo de baja', 'Ampliación de dotación', 'Cobertura de licencias'][Math.floor(r() * 3)], contrato: 'Período de prueba (3 meses)' }); }
    for (let k = 0; k < t.bajas; k++) { const area = byArea([60, 20, 12, 8]); out.bajas.push({ emp: pick(ros.filter((e) => e.area === area)) ?? pick(), fecha: dstr(monthDate(m, day())), motivo: ['Renuncia', 'Renuncia', 'Jubilación', 'Despido sin causa', 'Despido con causa', 'Fin de período de prueba', 'Acuerdo mutuo'][Math.floor(r() * 7)] }); }
    // ausencias: eventos de 1 a 3 días que suman los días del mes
    let left = t.ausDias;
    while (left > 0) { const dias = Math.min(left, 1 + Math.floor(r() * 3)); left -= dias; const tipo = ['Injustificada', 'Con aviso', 'Enfermedad de familiar', 'Trámite personal', 'Duelo'][Math.floor(r() * 5)]; out.aus.push({ emp: pick(), fecha: dstr(monthDate(m, day())), dias, tipo, justificada: tipo !== 'Injustificada' }); }
    const artD = splitDays(t.artDias, t.artCant, r);
    artD.forEach((dias) => { const area = byArea([70, 25, 5, 0.01]); const tipo = r() < 0.35 ? 'In itinere' : 'En jornada laboral'; out.art.push({ emp: pick(ros.filter((e) => e.area === area)) ?? pick(), fecha: dstr(monthDate(m, day())), tipo, lesion: ['Contusión', 'Esguince de tobillo', 'Lumbalgia por esfuerzo', 'Corte superficial', 'Fractura de muñeca', 'Golpe en mano'][Math.floor(r() * 6)], dias, estado: r() < 0.55 ? 'En tratamiento' : 'Alta médica', prestador: ['Prevención ART', 'Experta ART', 'Galeno ART'][Math.floor(r() * 3)], siniestro: `ART-${m}${String(hashStr(u + dias + r()) % 9000 + 1000)}` }); });
    const carD = splitDays(t.carpDias, t.carpCant, r);
    carD.forEach((dias) => { const area = byArea([45, 40, 10, 5]); const d0 = day(); out.carp.push({ emp: pick(ros.filter((e) => e.area === area)) ?? pick(), desde: dstr(monthDate(m, d0)), hasta: dstr(monthDate(m, d0 + dias - 1)), dias, diagnostico: ['Cuadro respiratorio', 'Gastroenteritis', 'Osteomuscular', 'Control post quirúrgico', 'Odontológica', 'Cefalea / migraña'][Math.floor(r() * 6)], validacion: r() < 0.8 ? 'Validada por médico laboral' : 'Pendiente de control' }); });
  }
  const byDate = (a: string, b: string) => a.split('/').reverse().join('').localeCompare(b.split('/').reverse().join(''));
  out.altas.sort((a, b) => byDate(a.fecha, b.fecha)); out.bajas.sort((a, b) => byDate(a.fecha, b.fecha)); out.aus.sort((a, b) => byDate(a.fecha, b.fecha)); out.art.sort((a, b) => byDate(a.fecha, b.fecha)); out.carp.sort((a, b) => byDate(a.desde, b.desde));
  listCache.set(key, out); return out;
}
export interface Nov { aus: number; carp: number; art: number; inf: number; aper: number; sus: number; sinCon: number; sinSin: number; inc: number }
export function empMonths(e: Emp): Nov[] {
  const r = mulberry32(hashStr(`nov-${e.legajo}`));
  const bias = 0.6 + r() * 1.2;
  return Array.from({ length: 12 }, () => ({
    aus: Math.round(r() * 3 * bias * (r() < 0.75 ? 1 : 0)), carp: r() < 0.22 * bias ? 2 + Math.floor(r() * 7) : 0, art: r() < 0.06 * bias ? 3 + Math.floor(r() * 12) : 0,
    inf: Math.round(r() * 2.6 * bias), aper: r() < 0.28 * bias ? 1 + Math.floor(r() * 3) : 0, sus: r() < 0.12 * bias ? 1 + Math.floor(r() * 4) : 0,
    sinCon: r() < 0.03 * bias ? 1 : 0, sinSin: r() < 0.05 * bias ? 1 : 0, inc: Math.round(r() * 1.4 * bias * (r() < 0.6 ? 1 : 0)),
  }));
}
export function riskLevel(n: Nov): { label: 'BUENO' | 'REGULAR' | 'ATENCIÓN'; tone: 'good' | 'warn' | 'bad'; text: string } {
  const risk = n.aper * 2 + n.sus * 2.5 + n.sinCon * 5 + n.inc * 2 + n.inf * 0.6 + n.aus * 0.8;
  if (risk < 10) return { label: 'BUENO', tone: 'good', text: 'Comportamiento dentro de los parámetros esperados.' };
  if (risk < 18) return { label: 'REGULAR', tone: 'warn', text: 'Novedades por encima del promedio: conviene hacer seguimiento.' };
  return { label: 'ATENCIÓN', tone: 'bad', text: 'Acumulación de novedades: requiere entrevista con el supervisor.' };
}
export interface HistItem { fecha: string; tipo: string; detalle: string; dias: string }
export function empHistory(e: Emp, mIdx: number, n: Nov): HistItem[] {
  const r = mulberry32(hashStr(`hist-${e.legajo}-${mIdx}`));
  const y = mIdx < 3 ? 2025 : 2026; const mo = (9 + mIdx) % 12; const day = () => dstr(new Date(y, mo, 1 + Math.floor(r() * 27)));
  const pick = (a: string[]) => a[Math.floor(r() * a.length)];
  const items: HistItem[] = [];
  if (n.aus) items.push({ fecha: day(), tipo: 'Ausencia', detalle: pick(['Ausencia injustificada', 'Ausencia con aviso', 'Trámite personal']), dias: String(n.aus) });
  if (n.carp) items.push({ fecha: day(), tipo: 'Carpeta médica', detalle: pick(['Gastroenteritis', 'Lumbalgia', 'Cuadro respiratorio', 'Control post quirúrgico']), dias: String(n.carp) });
  if (n.art) items.push({ fecha: day(), tipo: 'ART', detalle: pick(['Accidente in itinere', 'Golpe en jornada laboral']), dias: String(n.art) });
  for (let i = 0; i < Math.min(n.inf, 3); i++) items.push({ fecha: day(), tipo: 'Informe', detalle: pick(['Llegada tarde', 'Falta de documentación', 'Reclamo de pasajero']), dias: '-' });
  for (let i = 0; i < Math.min(n.aper, 3); i++) items.push({ fecha: day(), tipo: 'Apercibimiento', detalle: pick(['Falta de documentación', 'Incumplimiento de horario', 'Trato inadecuado']), dias: '-' });
  if (n.sus) items.push({ fecha: day(), tipo: 'Suspensión', detalle: pick(['Falta grave', 'Reincidencia en faltas']), dias: String(n.sus) });
  if (n.sinCon) items.push({ fecha: day(), tipo: 'Siniestro (con culpabilidad)', detalle: 'Colisión leve en maniobra', dias: '-' });
  if (n.sinSin) items.push({ fecha: day(), tipo: 'Siniestro (sin culpabilidad)', detalle: 'Impacto de tercero', dias: '-' });
  for (let i = 0; i < Math.min(n.inc, 2); i++) items.push({ fecha: day(), tipo: 'Incidente', detalle: pick(['Daño a unidad', 'Discusión con pasajero', 'Desvío de recorrido']), dias: '-' });
  return items.sort((a, b) => a.fecha.split('/').reverse().join('').localeCompare(b.fecha.split('/').reverse().join('')));
}
export const _clamp = clamp;
