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
export interface Emp { legajo: number; nombre: string; unit: UnitName; area: Area; sector: string; ingreso: string; antig: string; supervisor: string; convenio: string }
const END = new Date(2026, 8, 30);
function genEmps(): Emp[] {
  const out: Emp[] = [];
  for (const u of UNIT_NAMES) {
    const r = mulberry32(hashStr(`emp-${u}`));
    for (let i = 0; i < 24; i++) {
      const ai = i < 14 ? 0 : i < 18 ? 1 : i < 21 ? 2 : 3; const area = AREAS[ai];
      const ing = new Date(2010 + Math.floor(r() * 15), Math.floor(r() * 12), 1 + Math.floor(r() * 27));
      const months = (END.getFullYear() - ing.getFullYear()) * 12 + (END.getMonth() - ing.getMonth());
      const nombre = `${APELLIDOS[Math.floor(r() * APELLIDOS.length)]} ${NOMBRES[Math.floor(r() * NOMBRES.length)]}`;
      const sectors = SECTOR[area];
      out.push({ legajo: LEG_BASE[u] + i, nombre, unit: u, area, sector: sectors[Math.floor(r() * sectors.length)], ingreso: dstr(ing), antig: `${Math.floor(months / 12)} años, ${months % 12} meses`, supervisor: SUPERVISOR[area], convenio: area === 'Administración' ? 'Empleados de comercio' : 'UTA' });
    }
  }
  return out;
}
export const EMPS: Emp[] = genEmps();
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
