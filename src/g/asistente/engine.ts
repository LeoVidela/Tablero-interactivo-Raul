/* Asistente del tablero.
   Funciona dentro del navegador, sin conexión y sin costo: no usa ninguna IA externa. Interpreta la pregunta con reglas
   (indicador, base, mes e intención) y responde consultando los MISMOS datos y funciones que usan las pantallas,
   así el número que dice es siempre el que se ve en el tablero. */
import { orders as ALL_ORDERS, PREVENTIVE_KM, SERVICE_KM, isOpen, mechanicsByBase, orderCost, unitById, units as ALL_UNITS } from '../../data/fleet';
import { componentById } from '../../data/catalog';
import { SNAP, SOURCE } from '../../data/source';
import { CORTE, corteTxt, ymOf } from '../../data/window';
import { MONTH_FULL, MONTH_LABELS, OBJ, UNIT_NAMES, type UnitFilter, type UnitName, aggregate, lineRows, monthStart, unitsOf } from '../data';
import { METRICS, type MetricKey, type Target } from '../metrics';
import { COV_LABEL, FALTANTES, avance, coverage, realBases, snapshotBlocks, sourceLabel } from '../coverage';
import { tallerData } from '../taller';
import { pendientes, production } from '../mant';
import { EMPS, empMonths, hrLists, hrTotals, riskLevel } from '../rrhh';
import { DRIVERS, sinData } from '../siniestros';
import { ARTS, TIRES, bajoMin, minOf, proyeccion, stockOf, tiresOf, valorOf } from '../panol';
import { tankState, tanksOf } from '../tanques';
import { trafficDay } from '../trafico';
import { arNow } from '../views/Greeting';
import { fmt, money, moneyM, pct } from '../ui';

// ---------- tipos ----------
export type Action =
  | { kind: 'metric'; label: string; k: MetricKey; unit?: UnitFilter; month?: number }
  | { kind: 'go'; label: string; module: Target; tab?: string; unit?: UnitFilter }
  | { kind: 'unit'; label: string; interno: string; order?: string }
  | { kind: 'base'; label: string; base: UnitName }
  | { kind: 'ask'; label: string; q: string }
  | { kind: 'panel'; label: string; panel: 'fuentes' | 'help' | 'cmp' };
export interface Answer {
  /** texto con **negritas** y saltos de línea; las líneas que empiezan con «• » son viñetas */
  text: string;
  table?: { head: string[]; rows: string[][]; note?: string };
  /** serie de 12 meses para dibujar una mini barra */
  spark?: { labels: string[]; values: number[]; hi?: number; fmt: (v: number) => string };
  actions?: Action[];
  /** preguntas sugeridas para seguir */
  next?: string[];
  /** tipo de respuesta, para las pruebas */
  intent: string;
}
export interface Memory { k?: MetricKey; unit?: UnitFilter; month?: number; intent?: string }
export interface Ctx { unit: UnitFilter; module: Target; mem: Memory }

// ---------- utilidades de texto ----------
export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:()"«»]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (q: string, ...words: string[]) => words.some((w) => new RegExp(`(^| )${w}( |$)`).test(q));
const hasRe = (q: string, re: RegExp) => re.test(q);
const plural = (n: number, s: string, p = `${s}s`) => `${fmt(n)} ${n === 1 ? s : p}`;
const B = (s: string | number) => `**${s}**`;
const unitTxt = (u: UnitFilter) => (u === 'Todos' ? 'el grupo' : u);
const inUnit = (u: UnitFilter) => (u === 'Todos' ? 'en todo el grupo' : `en ${u}`);

// ---------- entidades ----------
const BASE_WORDS: [RegExp, UnitName][] = [[/(^| )(cordoba|cba|cordoba capital)( |$)/, 'Córdoba'], [/(^| )(comodoro|crd|comodoro rivadavia|rivadavia)( |$)/, 'Comodoro'], [/(^| )(san luis|sl|slu)( |$)/, 'San Luis'], [/(^| )(villa mercedes|mercedes|vm|vme)( |$)/, 'Villa Mercedes']];
export function findBases(q: string): UnitName[] { return BASE_WORDS.filter(([re]) => re.test(q)).map(([, u]) => u); }
const ALL_WORDS = /(^| )(grupo|todas|todos|total|consolidado|general|empresa|solbus|las 4|las cuatro)( |$)/;

const MES_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** Mes de la ventana (0…11) que nombra la pregunta, o null. */
export function findMonth(q: string): number | null {
  if (hasRe(q, /mes (pasado|anterior|previo)|anteultimo/)) return 10;
  if (hasRe(q, /(este|ultimo|el) mes( |$)|mes actual|actual(mente)?( |$)|(^| )hoy( |$)|(^| )ahora( |$)|al cierre/)) return 11;
  for (let c = 0; c < 12; c++) {
    if (has(q, MES_NAMES[c], MES_ABBR[c], c === 8 ? 'setiembre' : MES_NAMES[c])) { for (let i = 11; i >= 0; i--) if (monthStart(i).getMonth() === c) return i; }
  }
  return null;
}
type Span = 'mes' | 'trimestre' | 'anio';
const findSpan = (q: string): Span | null => (hasRe(q, /trimestr/) ? 'trimestre' : hasRe(q, /(^| )(ano|anual|12 meses|doce meses|acumulado)( |$)/) ? 'anio' : null);

// Sinónimos de cada indicador. Se puntúa por la frase más larga que aparezca en la pregunta.
const SYN: Record<MetricKey, string[]> = {
  cumpl: ['cumplimiento', 'km cumplidos', 'cumplimiento de km', 'kilometros cumplidos', 'cumplimiento de kilometros', 'km ejecutados sobre programados', 'cumplimos', 'cumplido'],
  reg: ['regularidad', 'frecuencia', 'frecuencias', 'puntualidad', 'servicios cumplidos'],
  kmExec: ['km ejecutados', 'kilometros ejecutados', 'kilometros recorridos', 'km recorridos', 'kilometros', 'km', 'kilometraje', 'recorrido'],
  disp: ['disponibilidad', 'disponibilidad operativa', 'disponibilidad de flota', 'flota disponible', 'coches disponibles'],
  oper: ['coches operativos', 'unidades operativas', 'operativos', 'operativas', 'en servicio'],
  out: ['fuera de servicio', 'coches parados', 'coches detenidos', 'detenidos', 'parados', 'no operativos', 'inmovilizados'],
  aux: ['auxilios', 'auxilio', 'auxilios en via', 'auxilios en calle', 'remolques', 'sos'],
  aus: ['ausentismo', 'ausentismo porcentaje', 'porcentaje de ausentismo', 'tasa de ausentismo', 'ausencias'],
  cob: ['cobertura de turnos', 'cobertura', 'turnos cubiertos', 'turnos'],
  sin: ['siniestros', 'siniestro', 'choques', 'accidentes', 'siniestralidad', 'colisiones'],
  exc: ['excesos de velocidad', 'excesos', 'exceso de velocidad', 'velocidad', 'infracciones de velocidad'],
  cost: ['costo por km', 'costo por kilometro', 'costo km', 'costo operativo', 'costos', 'costo'],
  inc: ['ingreso por km', 'ingreso por kilometro', 'ingresos', 'ingreso', 'recaudacion', 'recaudacion por km', 'facturacion'],
  margin: ['margen por km', 'margen', 'rentabilidad', 'ganancia', 'resultado por km'],
  pax: ['pasajeros', 'pasajeros transportados', 'boletos', 'validaciones', 'sube', 'demanda', 'pasaje'],
  ipk: ['ipk', 'indice pasajeros por km', 'pasajeros por km', 'pasajeros por kilometro', 'indice de pasajeros'],
  otOpen: ['ot abiertas', 'ordenes abiertas', 'ordenes de trabajo abiertas', 'ot pendientes', 'trabajos abiertos', 'ordenes pendientes'],
  otClosed: ['ot cerradas', 'ordenes cerradas', 'ordenes de trabajo cerradas', 'trabajos terminados', 'ot terminadas', 'ordenes de trabajo', 'ot'],
  prevDone: ['preventivos realizados', 'services realizados', 'preventivos hechos', 'preventivos cumplidos', 'mantenimientos realizados'],
  prevPend: ['preventivos pendientes', 'preventivos vencidos', 'services vencidos', 'services pendientes', 'service vencido', 'preventivo vencido', 'mantenimiento vencido', 'plan vencido', 'preventivos', 'services'],
  reinc: ['reincidencias', 'reincidencia', 'reincidentes', 'retrabajos', 'vuelven al taller', 'volvio a entrar'],
  repTime: ['horas por ot', 'tiempo de reparacion', 'tiempo promedio de reparacion', 'tiempo por ot', 'horas promedio', 'demora de reparacion'],
  personal: ['personal de taller', 'mecanicos', 'cuantos mecanicos', 'dotacion de taller'],
  horas: ['horas de taller', 'horas hombre', 'horas trabajadas', 'horas de mano de obra'],
  lts: ['litros', 'combustible consumido', 'consumo de combustible', 'gasoil', 'gas oil', 'combustible', 'consumo de gasoil', 'litros consumidos'],
  kmpl: ['rendimiento', 'km por litro', 'kilometros por litro', 'km/l', 'kml', 'rinde', 'consumo cada 100'],
  gastoRep: ['gasto en repuestos', 'repuestos', 'gasto de repuestos', 'costo de repuestos', 'materiales'],
  gastoTot: ['gasto total de mantenimiento', 'gasto de mantenimiento', 'costo de mantenimiento', 'gasto de taller', 'gasto total', 'mantenimiento'],
  costoMantKm: ['costo de mantenimiento por km', 'mantenimiento por km', 'costo mantenimiento km'],
  incid: ['incidentes', 'incidente'],
  lesion: ['lesionados', 'heridos', 'lesiones'],
  sinResp: ['responsabilidad del chofer', 'con responsabilidad', 'culpa del chofer', 'siniestros con culpa', 'culpabilidad'],
  activos: ['personal activo', 'dotacion', 'empleados', 'cuanta gente', 'nomina', 'activos', 'personal', 'cantidad de empleados', 'plantilla'],
  altas: ['altas', 'ingresos de personal', 'incorporaciones', 'contrataciones', 'nuevos empleados'],
  bajas: ['bajas', 'egresos', 'desvinculaciones', 'renuncias', 'despidos'],
  ausDias: ['dias de ausentismo', 'dias de ausencia', 'dias ausentes', 'dias perdidos'],
  artDias: ['dias art', 'art', 'dias de art', 'accidentes de trabajo', 'accidentes laborales'],
  carpDias: ['carpetas medicas', 'carpetas', 'dias de carpeta', 'licencias medicas', 'licencia medica', 'carpeta medica'],
};
const SYN_LIST: { k: MetricKey; w: string; re: RegExp }[] = (Object.keys(SYN) as MetricKey[]).flatMap((k) => SYN[k].map((w) => ({ k, w, re: new RegExp(`(^| )${w.replace(/[/.]/g, '\\$&')}( |$)`) })));
/** Indicador que nombra la pregunta (gana la frase más larga). */
export function findMetric(q: string): MetricKey | null {
  let best: { k: MetricKey; w: string } | null = null;
  for (const s of SYN_LIST) if (s.re.test(q) && (!best || s.w.length > best.w.length)) best = s;
  return best?.k ?? null;
}

const MOD_WORDS: [RegExp, Target][] = [[/resumen|inicio|tablero de control|gerencia/, 'Resumen'], [/trafico|micronauta/, 'Tráfico'], [/flota/, 'Flota'], [/taller|mantenimiento/, 'Taller'], [/rrhh|rr hh|recursos humanos|personal/, 'RRHH'], [/combustible|gasoil/, 'Combustible'], [/seguridad|siniestros/, 'Seguridad'], [/panol|stock|neumaticos|cubiertas/, 'Pañol']];
const MOD_LABEL: Record<Target, string> = { Resumen: 'Resumen', Tráfico: 'Tráfico', Flota: 'Flota', Taller: 'Taller', RRHH: 'RR.HH.', Combustible: 'Combustible', Seguridad: 'Siniestros y Seguridad', Pañol: 'Pañol' };

// ---------- piezas de respuesta ----------
const covNote = (k: MetricKey, u: UnitFilter, m: number) => {
  const c = coverage(k, u, m);
  if (c === 'real') return '';
  if (c === 'parcial') return `\nDato real solo en ${realBases(k, m).join(', ')}; el resto es de demostración.`;
  return SOURCE.modo === 'demo' ? '' : '\nEste indicador todavía no tiene fuente conectada: el valor es de demostración.';
};
const objTxt = (k: MetricKey, u: UnitFilter, v: number) => { const o = METRICS[k].obj?.(u); if (!o) return ''; const ok = o.max ? v <= o.v : v >= o.v; return ` Objetivo ${o.txt}: ${ok ? B('en objetivo') : B('fuera de objetivo')}.`; };
const deltaTxt = (k: MetricKey, cur: number, prev: number | null, ref: string) => {
  if (prev === null || !isFinite(prev)) return '';
  const d = METRICS[k]; const diff = cur - prev; if (Math.abs(diff) < 1e-9) return ` Igual que ${ref}.`;
  const isPct = d.fmt(1).includes('%'); const good = (diff > 0) === d.goodUp;
  const mag = isPct ? `${fmt(Math.abs(diff), 1)} pp` : `${d.fmt(Math.abs(diff))}${prev ? ` (${fmt(Math.abs((diff / prev) * 100), 1)}%)` : ''}`;
  return ` ${diff > 0 ? 'Subió' : 'Bajó'} ${mag} respecto de ${ref} (${good ? 'mejora' : 'empeora'}).`;
};
const spanMonths = (span: Span | null, m: number) => (span === 'trimestre' ? [m - 2, m - 1, m].filter((x) => x >= 0) : span === 'anio' ? Array.from({ length: 12 }, (_, i) => i) : [m]);
const spanLabel = (span: Span | null, m: number) => (span === 'trimestre' ? `el trimestre ${MONTH_LABELS[Math.max(0, m - 2)]}–${MONTH_LABELS[m]}` : span === 'anio' ? 'los últimos 12 meses' : MONTH_FULL[m].toLowerCase());
/** Valor de un indicador en varios meses: suma para cantidades, promedio para tasas y valores unitarios. */
const RATE = new Set<MetricKey>(['cumpl', 'reg', 'disp', 'aus', 'cob', 'cost', 'inc', 'margin', 'ipk', 'kmpl', 'repTime', 'costoMantKm', 'oper', 'out', 'otOpen', 'prevPend', 'personal', 'activos']);
const valueOver = (k: MetricKey, u: UnitFilter, ms: number[]) => { const vs = ms.map((m) => METRICS[k].get(u, m)); const s = vs.reduce((a, b) => a + b, 0); return RATE.has(k) ? s / vs.length : s; };

function valueAnswer(k: MetricKey, u: UnitFilter, m: number, span: Span | null): Answer {
  const d = METRICS[k]; const ms = spanMonths(span, m); const v = valueOver(k, u, ms);
  const prev = span === null ? (m > 0 ? d.get(u, m - 1) : null) : span === 'trimestre' && m >= 5 ? valueOver(k, u, [m - 5, m - 4, m - 3]) : null;
  let text = `${B(d.label)} ${inUnit(u)}, ${spanLabel(span, m)}: ${B(d.fmt(v))}.${span === null ? objTxt(k, u, v) : ''}${deltaTxt(k, v, prev, span === 'trimestre' ? 'el trimestre anterior' : m > 0 ? MONTH_FULL[m - 1].toLowerCase() : '')}`;
  let table: Answer['table'];
  if (u === 'Todos') {
    const rows = UNIT_NAMES.map((b) => ({ b, v: valueOver(k, b, ms) }));
    const order = [...rows].sort((a, c) => (d.goodUp ? c.v - a.v : a.v - c.v));
    table = { head: ['Base', d.label], rows: order.map((r) => [r.b, d.fmt(r.v)]) };
    text += `\nMejor: ${B(order[0].b)} · a mirar: ${B(order[order.length - 1].b)}.`;
  }
  text += covNote(k, u, m);
  return {
    intent: 'valor', text, table, spark: { labels: MONTH_LABELS, values: MONTH_LABELS.map((_, i) => d.get(u, i)), hi: span === null ? m : undefined, fmt: d.fmt },
    actions: [{ kind: 'metric', label: 'Ver detalle del indicador', k, unit: u, month: m }, { kind: 'go', label: `Ir a ${MOD_LABEL[d.module]}${d.tab ? ` · ${d.tab}` : ''}`, module: d.module, tab: d.tab, unit: u }],
    next: u === 'Todos' ? [`¿Qué base tiene peor ${d.label.toLowerCase()}?`, `Evolución de ${d.label.toLowerCase()}`] : [`Comparar ${d.label.toLowerCase()} entre bases`, `Evolución de ${d.label.toLowerCase()} en ${u}`],
  };
}

function trendAnswer(k: MetricKey, u: UnitFilter): Answer {
  const d = METRICS[k]; const vs = MONTH_LABELS.map((_, i) => d.get(u, i));
  const first = vs.slice(0, 3).reduce((a, b) => a + b, 0) / 3; const last = vs.slice(9).reduce((a, b) => a + b, 0) / 3;
  const diff = last - first; const rel = first ? (diff / Math.abs(first)) * 100 : 0; const flat = Math.abs(rel) < 1.5;
  const good = (diff > 0) === d.goodUp; const hiI = vs.indexOf(Math.max(...vs)); const loI = vs.indexOf(Math.min(...vs));
  const isPct = d.fmt(1).includes('%');
  const text = `${B(d.label)} ${inUnit(u)}, últimos 12 meses: ${flat ? B('estable') : `${B(diff > 0 ? 'en alza' : 'en baja')} (${good ? 'tendencia favorable' : 'tendencia desfavorable'})`}.\nPromedio de los últimos 3 meses ${B(d.fmt(last))} contra ${d.fmt(first)} de los primeros 3 (${isPct ? `${diff >= 0 ? '+' : '−'}${fmt(Math.abs(diff), 1)} pp` : `${rel >= 0 ? '+' : '−'}${fmt(Math.abs(rel), 1)}%`}).\nMáximo en ${MONTH_FULL[hiI]} (${d.fmt(vs[hiI])}) y mínimo en ${MONTH_FULL[loI]} (${d.fmt(vs[loI])}).${covNote(k, u, 11)}`;
  return { intent: 'evolucion', text, spark: { labels: MONTH_LABELS, values: vs, hi: 11, fmt: d.fmt }, table: { head: ['Mes', d.label], rows: [...vs].map((v, i) => [MONTH_FULL[i], d.fmt(v)]).reverse() }, actions: [{ kind: 'metric', label: 'Abrir el detalle de 12 meses', k, unit: u, month: 11 }] };
}

function rankAnswer(k: MetricKey, m: number, span: Span | null, worstFirst: boolean): Answer {
  const d = METRICS[k]; const ms = spanMonths(span, m);
  const rows = UNIT_NAMES.map((b) => ({ b, v: valueOver(k, b, ms) })).sort((a, c) => (d.goodUp ? c.v - a.v : a.v - c.v));
  const list = worstFirst ? [...rows].reverse() : rows;
  const o = METRICS[k].obj?.('Todos');
  const text = `${B(d.label)} por base, ${spanLabel(span, m)}: ${worstFirst ? 'la que más necesita atención' : 'la mejor'} es ${B(list[0].b)} con ${B(d.fmt(list[0].v))}; ${worstFirst ? 'la mejor' : 'la que más necesita atención'}, ${list[list.length - 1].b} con ${d.fmt(list[list.length - 1].v)}.${o && span === null ? ` Objetivo ${o.txt}.` : ''}${covNote(k, 'Todos', m)}`;
  return { intent: 'ranking', text, table: { head: ['#', 'Base', d.label], rows: list.map((r, i) => [String(i + 1), r.b, d.fmt(r.v)]) }, actions: [{ kind: 'metric', label: `Detalle de ${list[0].b}`, k, unit: list[0].b, month: m }, { kind: 'panel', label: 'Comparativa completa entre bases', panel: 'cmp' }] };
}

function compareAnswer(k: MetricKey, bases: UnitName[], m: number, span: Span | null): Answer {
  const d = METRICS[k]; const ms = spanMonths(span, m);
  const rows = bases.map((b) => ({ b, v: valueOver(k, b, ms), p: span === null && m > 0 ? d.get(b, m - 1) : null }));
  const best = [...rows].sort((a, c) => (d.goodUp ? c.v - a.v : a.v - c.v))[0];
  const isPct = d.fmt(1).includes('%'); const gap = Math.abs(rows[0].v - rows[rows.length - 1].v);
  const text = `${B(d.label)}, ${spanLabel(span, m)}: ${rows.map((r) => `${r.b} ${B(d.fmt(r.v))}`).join(' · ')}.\nMejor: ${B(best.b)}${rows.length === 2 ? ` (diferencia de ${isPct ? `${fmt(gap, 1)} pp` : d.fmt(gap)})` : ''}.${covNote(k, 'Todos', m)}`;
  return { intent: 'comparar', text, table: { head: ['Base', d.label, 'Mes anterior'], rows: rows.map((r) => [r.b, d.fmt(r.v), r.p === null ? '—' : d.fmt(r.p)]) }, actions: rows.map((r) => ({ kind: 'metric' as const, label: `Detalle de ${r.b}`, k, unit: r.b, month: m })) };
}

function defineAnswer(k: MetricKey): Answer {
  const d = METRICS[k]; const o = d.obj?.('Todos');
  const c = coverage(k, 'Todos', 11);
  const falt = FALTANTES.filter((f) => f.completa.toLowerCase().includes(d.label.toLowerCase().split(' (')[0].slice(0, 12).toLowerCase()));
  const text = `${B(d.label)}: ${d.desc}\n• Se considera mejor cuando ${d.goodUp ? 'sube' : 'baja'}.${o ? `\n• Objetivo: ${o.txt}.` : ''}\n• Se ve en ${MOD_LABEL[d.module]}${d.tab ? ` › ${d.tab}` : ''}.\n• Estado del dato: ${COV_LABEL[c].toLowerCase()}.${falt.length ? `\n• Para que sea real falta: ${falt[0].dato} (${falt[0].area}).` : ''}`;
  return { intent: 'definicion', text, actions: [{ kind: 'metric', label: 'Ver el indicador', k, unit: 'Todos', month: 11 }], next: [`¿Cuánto es ${d.label.toLowerCase()} hoy?`, `Evolución de ${d.label.toLowerCase()}`] };
}

interface Check { k: MetricKey; u: UnitFilter; v: number; o: { v: number; txt: string; max: boolean }; gap: number }
function offTarget(u: UnitFilter, m: number): Check[] {
  const out: Check[] = [];
  for (const k of Object.keys(METRICS) as MetricKey[]) {
    const o = METRICS[k].obj?.(u); if (!o) continue;
    const v = METRICS[k].get(u, m); const ok = o.max ? v <= o.v : v >= o.v;
    if (!ok) out.push({ k, u, v, o, gap: o.v ? Math.abs((v - o.v) / o.v) : 0 });
  }
  return out.sort((a, b) => b.gap - a.gap);
}

function summaryAnswer(u: UnitFilter, m: number): Answer {
  const a = aggregate(u, [m]); const p = m > 0 ? aggregate(u, [m - 1]) : null;
  const off = offTarget(u, m); const t = tallerData(u, m); const hr = hrTotals(u, m);
  const lines = [
    `• Operación: ${B(pct(a.cumpl))} de km cumplidos y regularidad ${pct(a.reg)}${p ? ` (${a.cumpl >= p.cumpl ? '+' : '−'}${fmt(Math.abs(a.cumpl - p.cumpl), 1)} pp vs. ${MONTH_LABELS[m - 1]})` : ''}.`,
    `• Flota: disponibilidad ${B(pct(a.disp))} · ${fmt(a.out)} coches fuera de servicio · ${fmt(a.aux)} auxilios.`,
    `• Taller: ${fmt(a.otOpen)} OT abiertas, ${fmt(a.prevPend)} preventivos/services vencidos, gasto ${moneyM(t.total.gasto)}.`,
    `• RR.HH.: ${fmt(hr.activos)} personas, ausentismo ${B(pct(a.aus))}, cobertura de turnos ${pct(a.cob)}.`,
    `• Seguridad: ${B(fmt(a.sin))} siniestros y ${fmt(a.exc)} excesos de velocidad.`,
    `• Económico: costo ${money(a.cost)} e ingreso ${money(a.inc)} por km → margen ${B(money(a.margin))}.`,
    `• Demanda: ${fmt(a.pax)} pasajeros, IPK ${fmt(a.ipk, 2)}.`,
  ];
  const head = `Resumen de ${B(unitTxt(u))} · ${MONTH_FULL[m]}`;
  const foot = off.length ? `\n${B(plural(off.length, 'indicador'))} fuera de objetivo: ${off.slice(0, 4).map((x) => `${METRICS[x.k].label} (${METRICS[x.k].fmt(x.v)})`).join(', ')}.` : '\nTodos los indicadores con objetivo están en rango.';
  return {
    intent: 'resumen', text: `${head}\n${lines.join('\n')}${foot}${SOURCE.modo === 'demo' ? '\nLos valores son de demostración: todavía no hay una base conectada.' : ''}`,
    actions: [{ kind: 'go', label: 'Abrir el tablero de control', module: 'Resumen', unit: u }, ...off.slice(0, 2).map((x) => ({ kind: 'metric' as const, label: METRICS[x.k].label, k: x.k, unit: u, month: m }))],
    next: ['¿Qué está fuera de objetivo?', u === 'Todos' ? '¿Qué base necesita más atención?' : 'Resumen del grupo', 'Coches detenidos en taller'],
  };
}

function alertsAnswer(u: UnitFilter, m: number): Answer {
  const scope: UnitFilter[] = u === 'Todos' ? ['Todos', ...UNIT_NAMES] : [u];
  const rows: string[][] = []; const acts: Action[] = [];
  for (const s of scope) for (const x of offTarget(s, m).slice(0, s === 'Todos' ? 6 : 3)) { rows.push([s === 'Todos' ? 'Grupo' : s, METRICS[x.k].label, METRICS[x.k].fmt(x.v), x.o.txt]); if (acts.length < 3) acts.push({ kind: 'metric', label: `${METRICS[x.k].label} · ${s === 'Todos' ? 'grupo' : s}`, k: x.k, unit: s, month: m }); }
  if (!rows.length) return { intent: 'alertas', text: `En ${MONTH_FULL[m]} ${B(unitTxt(u))} tiene todos los indicadores con objetivo en rango.`, next: ['Resumen del mes', 'Coches detenidos en taller'] };
  const groupN = u === 'Todos' ? offTarget('Todos', m).length : rows.length;
  return { intent: 'alertas', text: `${MONTH_FULL[m]}: ${B(plural(groupN, 'indicador'))} fuera de objetivo ${inUnit(u)}${u === 'Todos' ? ' (abajo también el detalle por base, lo más alejado primero)' : ''}.`, table: { head: ['Ámbito', 'Indicador', 'Valor', 'Objetivo'], rows }, actions: acts, next: ['¿Qué base necesita más atención?', 'Resumen del mes'] };
}

function worstBaseAnswer(m: number): Answer {
  const rows = UNIT_NAMES.map((b) => ({ b, off: offTarget(b, m) })).sort((a, c) => c.off.length - a.off.length || c.off.reduce((s, x) => s + x.gap, 0) - a.off.reduce((s, x) => s + x.gap, 0));
  const w = rows[0];
  return { intent: 'peor-base', text: `En ${MONTH_FULL[m]} la base que más necesita atención es ${B(w.b)}: ${plural(w.off.length, 'indicador')} fuera de objetivo${w.off.length ? ` (${w.off.slice(0, 3).map((x) => `${METRICS[x.k].label} ${METRICS[x.k].fmt(x.v)}`).join(', ')})` : ''}.`, table: { head: ['Base', 'Fuera de objetivo', 'Principales'], rows: rows.map((r) => [r.b, String(r.off.length), r.off.slice(0, 2).map((x) => METRICS[x.k].label).join(', ') || '—']) }, actions: [{ kind: 'base', label: `Ficha de ${w.b}`, base: w.b }, { kind: 'panel', label: 'Comparativa entre bases', panel: 'cmp' }] };
}

// ---------- coches, OT, taller ----------
function unitAnswer(id: string): Answer {
  const u = unitById[id];
  const open = u.orders.filter(isOpen); const last = u.orders.filter((o) => o.status === 'Cerrada').slice(0, 4);
  const prevDue = u.km - u.lastPreventiveKm - PREVENTIVE_KM; const servDue = u.km - u.lastServiceKm - SERVICE_KM;
  const cost12 = u.orders.reduce((s, o) => s + orderCost(o), 0);
  const tires = TIRES.filter((t) => t.bus?.id === id && t.estado === 'Montada'); const worstTire = [...tires].sort((a, b) => (a.mm - a.limite) - (b.mm - b.limite))[0];
  const lines = [
    `${B(`Interno ${u.interno}`)} · ${u.plate} · ${u.base}, línea ${u.line} · ${u.chassis} (${u.year}).`,
    `• Estado: ${B(u.status)}${open.length ? ` — ${open[0].title} (${open[0].id}, ${open[0].status.toLowerCase()})` : ''}.`,
    `• Odómetro: ${fmt(u.km)} km.`,
    `• Preventivo 20.000 km: ${prevDue > 0 ? B(`vencido por ${fmt(prevDue)} km`) : `faltan ${fmt(-prevDue)} km`} · Service 30.000 km: ${servDue > 0 ? B(`vencido por ${fmt(servDue)} km`) : `faltan ${fmt(-servDue)} km`}.`,
    `• ${plural(u.orders.length, 'OT', 'OT')} en 12 meses, ${money(cost12, 0)} en materiales.`,
    ...(worstTire ? [`• Cubierta más gastada: ${worstTire.serie} (${worstTire.mm} mm, límite ${worstTire.limite} mm).`] : []),
  ];
  return { intent: 'coche', text: lines.join('\n'), table: last.length ? { head: ['OT', 'Fecha', 'Trabajo', 'Mecánico'], rows: last.map((o) => [o.id, o.opened.toLocaleDateString('es-AR'), o.title, o.mechanic]) } : undefined, actions: [{ kind: 'unit', label: 'Abrir la ficha técnica', interno: id, order: open[0]?.id }], next: [`Coches detenidos en ${u.base}`] };
}
function otAnswer(id: string): Answer | null {
  const o = ALL_ORDERS.find((x) => x.id.toLowerCase() === id.toLowerCase() || x.id.replace(/\D/g, '') === id.replace(/\D/g, '')); if (!o) return null;
  const mats = o.materials.map((m) => [m.code, m.name, `${fmt(m.qty)} ${m.unit}`, money(m.qty * m.price, 0)]);
  return { intent: 'ot', text: `${B(o.id)} · interno ${o.unit} (${o.base}) · ${o.type} · ${B(o.status)}.\n• ${o.title}: ${o.diagnosis}\n• Abierta el ${o.opened.toLocaleDateString('es-AR')}${o.closed ? `, cerrada el ${o.closed.toLocaleDateString('es-AR')}` : ''} · ${o.mechanic} · ${fmt(o.hours, 1)} h.\n• Componentes: ${o.components.map((c) => componentById[c]?.name ?? c).join(', ')}.\n• Materiales: ${money(orderCost(o), 0)}.`, table: mats.length ? { head: ['Código', 'Material', 'Cant.', 'Importe'], rows: mats } : undefined, actions: [{ kind: 'unit', label: 'Abrir la OT en la ficha del coche', interno: o.unit, order: o.id }] };
}
function stoppedAnswer(u: UnitFilter, onlyParts: boolean): Answer {
  const list = ALL_UNITS.filter((x) => unitsOf(u).includes(x.base as UnitName) && x.status !== 'Operativo' && (!onlyParts || x.status === 'Esperando repuesto'));
  const rows = list.map((x) => { const o = x.orders.find(isOpen); const days = o ? Math.max(0, Math.round((CORTE.getTime() - o.opened.getTime()) / 86400000)) : 0; return { x, o, days }; }).sort((a, b) => b.days - a.days);
  const by = (s: string) => list.filter((x) => x.status === s).length;
  const text = onlyParts ? `${B(plural(list.length, 'coche'))} esperando repuesto ${inUnit(u)}.` : `${B(plural(list.length, 'coche'))} detenidos ${inUnit(u)}: ${by('En taller')} en taller, ${by('Esperando repuesto')} esperando repuesto y ${by('Fuera de servicio')} fuera de servicio.`;
  return { intent: 'detenidos', text, table: { head: ['Interno', 'Base', 'Estado', 'Trabajo', 'Días'], rows: rows.slice(0, 15).map((r) => [r.x.interno, r.x.base, r.x.status, r.o?.title ?? '—', String(r.days)]), note: rows.length > 15 ? `Se muestran 15 de ${rows.length}.` : undefined }, actions: [{ kind: 'go', label: 'Ver en Taller en vivo', module: 'Taller', tab: 'Taller en vivo', unit: u }, ...rows.slice(0, 2).map((r) => ({ kind: 'unit' as const, label: `Ficha del ${r.x.interno}`, interno: r.x.interno, order: r.o?.id }))], next: ['Preventivos vencidos', 'OT abiertas'] };
}
function pendAnswer(u: UnitFilter): Answer {
  const rows = pendientes(u).filter((r) => r.estado !== 'PROGRAMADO').sort((a, b) => b.dias - a.dias);
  return { intent: 'preventivos', text: `${B(plural(rows.length, 'preventivo/service vencido', 'preventivos/services vencidos'))} ${inUnit(u)} al ${corteTxt} (plan por km: preventivo cada 20.000 km, service cada 30.000 km).`, table: { head: ['Interno', 'Base', 'Tipo', 'Días', 'Estado'], rows: rows.slice(0, 15).map((r) => [String(r.bus.interno), r.bus.unit, r.tipo, String(r.dias), r.estado]), note: rows.length > 15 ? `Se muestran 15 de ${rows.length}.` : undefined }, actions: [{ kind: 'go', label: 'Ir a Mantenimiento de flota', module: 'Taller', tab: 'Mantenimiento de flota', unit: u }, ...rows.slice(0, 2).map((r) => ({ kind: 'unit' as const, label: `Ficha del ${r.bus.interno}`, interno: r.bus.id }))] };
}
function openOtAnswer(u: UnitFilter): Answer {
  const list = ALL_ORDERS.filter((o) => isOpen(o) && unitsOf(u).includes(o.base as UnitName)).sort((a, b) => a.opened.getTime() - b.opened.getTime());
  const alta = list.filter((o) => o.priority === 'Alta').length;
  return { intent: 'ot-abiertas', text: `${B(plural(list.length, 'OT abierta', 'OT abiertas'))} ${inUnit(u)}: ${alta} de prioridad alta, ${list.filter((o) => o.status === 'Esperando repuesto').length} esperando repuesto. Abajo, las más antiguas.`, table: { head: ['OT', 'Interno', 'Base', 'Trabajo', 'Estado'], rows: list.slice(0, 12).map((o) => [o.id, o.unit, o.base, o.title, o.status]), note: list.length > 12 ? `Se muestran 12 de ${list.length}.` : undefined }, actions: [{ kind: 'go', label: 'Ver el registro de OT', module: 'Taller', tab: 'Taller en vivo', unit: u }, ...list.slice(0, 2).map((o) => ({ kind: 'unit' as const, label: `${o.id} · interno ${o.unit}`, interno: o.unit, order: o.id }))] };
}
function reincAnswer(u: UnitFilter, m: number): Answer {
  const r = tallerData(u, m).reinc;
  return { intent: 'reincidencias', text: `${B(plural(r.length, 'reincidencia'))} ${inUnit(u)} en ${MONTH_FULL[m]} (el coche volvió a entrar por el mismo componente dentro de los 90 días).`, table: r.length ? { head: ['Interno', 'Componente', 'Veces', 'Última'], rows: r.slice(0, 12).map((x) => [String(x.bus.interno), x.comp, String(x.veces), x.ultima]) } : undefined, actions: [{ kind: 'go', label: 'Ir a Reincidencias', module: 'Taller', tab: 'Reincidencias', unit: u }] };
}
function mechAnswer(u: UnitFilter, m: number, name?: string): Answer {
  const rows = production(u, m).sort((a, b) => b.total - a.total);
  if (name) { const r = rows.find((x) => norm(x.s.name).includes(name)); if (r) return { intent: 'mecanico', text: `${B(r.s.name)} (${r.s.unit} · ${r.s.sector}) en ${MONTH_FULL[m]}: ${B(plural(r.total, 'trabajo'))} — ${r.prev} preventivos, ${r.serv} services y ${r.corr} correctivos, ${fmt(r.horas, 1)} horas.`, actions: [{ kind: 'go', label: 'Ver productividad', module: 'Taller', tab: 'Productividad', unit: r.s.unit }] }; }
  return { intent: 'productividad', text: `Producción del taller ${inUnit(u)} en ${MONTH_FULL[m]}: ${B(plural(rows.reduce((s, r) => s + r.total, 0), 'trabajo'))} entre ${rows.length} mecánicos.`, table: { head: ['Mecánico', 'Base', 'Trabajos', 'Horas'], rows: rows.slice(0, 12).map((r) => [r.s.name, r.s.unit, String(r.total), fmt(r.horas, 1)]) }, actions: [{ kind: 'go', label: 'Ir a Productividad', module: 'Taller', tab: 'Productividad', unit: u }] };
}
function fleetAnswer(u: UnitFilter): Answer {
  const list = ALL_UNITS.filter((x) => unitsOf(u).includes(x.base as UnitName)); const c = (s: string) => list.filter((x) => x.status === s).length;
  const rows = unitsOf(u).map((b) => { const l = list.filter((x) => x.base === b); const op = l.filter((x) => x.status === 'Operativo').length; return [b, String(l.length), String(op), pct((op / Math.max(1, l.length)) * 100)]; });
  return { intent: 'flota', text: `Flota ${inUnit(u)}: ${B(plural(list.length, 'coche'))}, ${B(fmt(c('Operativo')))} operativos (${pct((c('Operativo') / Math.max(1, list.length)) * 100)}), ${c('En taller')} en taller, ${c('Esperando repuesto')} esperando repuesto y ${c('Fuera de servicio')} fuera de servicio.`, table: { head: ['Base', 'Coches', 'Operativos', 'Disponibilidad'], rows }, actions: [{ kind: 'go', label: 'Ir a Flota', module: 'Flota', unit: u }, { kind: 'metric', label: 'Disponibilidad · 12 meses', k: 'disp', unit: u, month: 11 }], next: ['Coches detenidos en taller', 'Preventivos vencidos'] };
}

// ---------- líneas, tráfico del día ----------
function lineAnswer(id: string | null, u: UnitFilter, m: number, worst?: boolean): Answer | null {
  const rows = lineRows(id ? 'Todos' : u, [m]);
  if (id) { const r = rows.find((x) => x.line.toLowerCase() === id); if (!r) return null; return { intent: 'linea', text: `${B(`Línea ${r.line}`)} (${r.unit}) en ${MONTH_FULL[m]}: ${B(pct(r.cumpl))} de km cumplidos (objetivo ≥ ${OBJ.km}%), ${fmt(r.kmExec)} km, IPK ${fmt(r.ipk, 2)}, ${r.sin} siniestros y ${r.exc} excesos de velocidad.`, actions: [{ kind: 'go', label: 'Ver Tráfico', module: 'Tráfico', unit: r.unit }, { kind: 'base', label: `Ficha de ${r.unit}`, base: r.unit }] }; }
  const sorted = [...rows].sort((a, b) => (worst ? a.cumpl - b.cumpl : b.cumpl - a.cumpl));
  return { intent: 'lineas', text: `Líneas ${inUnit(u)} en ${MONTH_FULL[m]}, ordenadas por cumplimiento de km (${worst ? 'la más baja primero' : 'la más alta primero'}): ${B(`línea ${sorted[0].line}`)} de ${sorted[0].unit} con ${B(pct(sorted[0].cumpl))}.`, table: { head: ['Línea', 'Base', 'Cumpl.', 'Km', 'IPK', 'Sin.'], rows: sorted.slice(0, 12).map((r) => [r.line, r.unit, pct(r.cumpl), fmt(r.kmExec), fmt(r.ipk, 2), String(r.sin)]) }, actions: [{ kind: 'go', label: 'Ir al Resumen (indicadores por línea)', module: 'Resumen', unit: u }] };
}
function todayAnswer(u: UnitFilter): Answer {
  const { iso, hour } = arNow() as { iso: string; hour: number }; const d = trafficDay(u, iso, hour);
  return { intent: 'trafico-hoy', text: `Tráfico de hoy ${inUnit(u)} (hasta las ${String(hour).padStart(2, '0')}:00): ${B(`${fmt(d.prod)} km`)} productivos contra ${fmt(d.ideal)} ideales (${d.dev >= 0 ? '+' : '−'}${fmt(Math.abs(d.dev))} km), ${B(`${d.activos} de ${d.flota}`)} coches en calle, ${fmt(d.pax)} pasajeros, puntualidad ${pct(d.puntual)} y ${plural(d.events.length, 'evento')}.\nEl tráfico del día es una simulación hasta conectar la foto horaria de Micronauta.`, table: d.events.length ? { head: ['Hora', 'Base', 'Evento', 'Detalle'], rows: d.events.slice(0, 8).map((e) => [e.hora, e.unit, e.tipo, e.detalle]) } : undefined, actions: [{ kind: 'go', label: 'Ir a Tráfico', module: 'Tráfico', unit: u }] };
}

// ---------- RR.HH., siniestros ----------
function empAnswer(q: string, m: number): Answer | null {
  const leg = /legajo\s*(\d{3,5})/.exec(q)?.[1];
  const e = leg ? EMPS.find((x) => String(x.legajo) === leg) : EMPS.find((x) => { const n = norm(x.nombre).split(' '); return n.length >= 2 && n.every((p) => has(q, p)); });
  if (!e) return null;
  const n = empMonths(e); const cur = n[m]; const acc = n.reduce((a, x) => ({ aus: a.aus + x.aus, carp: a.carp + x.carp, art: a.art + x.art, sus: a.sus + x.sus, sin: a.sin + x.sinCon + x.sinSin }), { aus: 0, carp: 0, art: 0, sus: 0, sin: 0 }); const risk = riskLevel(cur);
  return { intent: 'legajo', text: `${B(e.nombre)} · legajo ${e.legajo} · ${e.puesto} (${e.area}, ${e.unit}) · ingreso ${e.ingreso}.\n• ${MONTH_FULL[m]}: ${cur.aus} días de ausencia, ${cur.carp} de carpeta, ${cur.art} de ART, ${cur.sus} de suspensión. Semáforo: ${B(risk.label)}.\n• 12 meses: ${acc.aus} días de ausencia, ${acc.carp} de carpeta médica, ${acc.art} de ART, ${acc.sus} de suspensión y ${acc.sin} siniestros.${SOURCE.modo === 'demo' || !SNAP?.rrhh_mensual ? '\nLos legajos son de demostración hasta conectar Flitmo.' : ''}`, actions: [{ kind: 'go', label: 'Ir a Análisis por legajo', module: 'RRHH', tab: 'Análisis por legajo', unit: e.unit }] };
}
function hrAnswer(u: UnitFilter, m: number): Answer {
  const t = hrTotals(u, m); const L = hrLists(u, m);
  return { intent: 'rrhh', text: `RR.HH. ${inUnit(u)} · ${MONTH_FULL[m]}: ${B(fmt(t.activos))} personas activas, ${t.altas} altas y ${t.bajas} bajas.\n• Ausentismo ${B(pct(t.ausPct))} (${fmt(t.ausDias)} días) · objetivo ≤ ${OBJ.aus}%.\n• ${t.artCant} casos de ART (${fmt(t.artDias)} días) y ${t.carpCant} carpetas médicas (${fmt(t.carpDias)} días).\n• ${t.susCant} suspensiones (${fmt(t.susDias)} días) · remuneraciones ${moneyM(t.remun)}.`, table: L.aus.length ? { head: ['Legajo', 'Nombre', 'Días', 'Tipo'], rows: [...L.aus].sort((a, b) => b.dias - a.dias).slice(0, 8).map((x) => [String(x.emp.legajo), x.emp.nombre, String(x.dias), x.tipo]), note: 'Ausencias más largas del mes.' } : undefined, actions: [{ kind: 'go', label: 'Ir a RR.HH.', module: 'RRHH', unit: u }, { kind: 'metric', label: 'Ausentismo · 12 meses', k: 'aus', unit: u, month: m }] };
}
function sinAnswer(u: UnitFilter, m: number, drivers: boolean, eco: boolean): Answer {
  const s = sinData(u, m);
  if (eco) return { intent: 'siniestros-eco', text: `Seguimiento económico de siniestros ${inUnit(u)} · ${MONTH_FULL[m]}: ${B(plural(s.eco.abiertos, 'reclamo abierto', 'reclamos abiertos'))}.\n• A cargo de la empresa ${moneyM(s.eco.empresa)} · gestión interna ${moneyM(s.eco.interna)} · reclamado a terceros ${moneyM(s.eco.terceros)}.\n• Reconocido ${moneyM(s.eco.reconocido)} y cobrado ${B(moneyM(s.eco.cobrado))} · costo empresa pendiente ${moneyM(s.eco.costoPend)}.\nLos montos son de demostración hasta que Legales cargue los expedientes.`, actions: [{ kind: 'go', label: 'Ir a Seguimiento económico', module: 'Seguridad', tab: 'Seguimiento económico', unit: u }] };
  if (drivers) { const d = s.drivers.filter((x) => x.total > 0).sort((a, b) => b.acum - a.acum).slice(0, 10); return { intent: 'siniestros-choferes', text: `Conductores con hechos ${inUnit(u)} en ${MONTH_FULL[m]}: ${B(String(s.drivers.filter((x) => x.total > 0).length))}; ${s.drivers.filter((x) => x.estado === 'ALERTA').length} en alerta por reincidencia.`, table: { head: ['Conductor', 'Base', 'Mes', 'Acum.', 'Estado'], rows: d.map((x) => [x.d.name, x.d.unit, String(x.total), String(x.acum), x.estado]) }, actions: [{ kind: 'go', label: 'Ir a Reincidencia', module: 'Seguridad', tab: 'Reincidencia', unit: u }] }; }
  return { intent: 'siniestros', text: `Siniestros ${inUnit(u)} · ${MONTH_FULL[m]}: ${B(plural(s.events.length, 'siniestro'))} y ${plural(s.incs.length, 'incidente')}, ${plural(s.lesionados, 'lesionado')}.\n• Responsabilidad: chofer ${s.resp.Chofer}, tercero ${s.resp.Tercero}, en análisis ${s.resp['En análisis']}.\n• Reparaciones: ${s.rep.reparadas} reparadas, ${s.rep.enRep} en reparación y ${s.rep.pendientes} pendientes.`, table: s.events.length ? { head: ['Fecha', 'Interno', 'Conductor', 'Daño', 'Resp.'], rows: s.events.slice(0, 10).map((e) => [e.fecha, String(e.bus.interno), e.driver.name, e.damage, e.resp]) } : undefined, actions: [{ kind: 'go', label: 'Ir a Siniestros y Seguridad', module: 'Seguridad', unit: u }, { kind: 'metric', label: 'Siniestros · 12 meses', k: 'sin', unit: u, month: m }], next: ['Conductores con más siniestros', 'Seguimiento económico de siniestros'] };
}

// ---------- combustible, pañol ----------
function tankAnswer(u: UnitFilter): Answer {
  const { iso } = arNow() as { iso: string }; const ts = tanksOf(u).map((t) => tankState(t, iso));
  const low = ts.filter((t) => t.autonomia < 5);
  return { intent: 'tanques', text: `Tanques de gasoil ${inUnit(u)}: ${B(`${fmt(ts.reduce((s, t) => s + t.nivel, 0))} L`)} en stock.${low.length ? ` ${B(plural(low.length, 'tanque'))} con menos de 5 días de autonomía: ${low.map((t) => `${t.tank.unit} (${fmt(t.autonomia, 1)} días)`).join(', ')}.` : ' Todos con más de 5 días de autonomía.'}\nEl nivel se calcula por libros hasta cargar la medición diaria con regla.`, table: { head: ['Tanque', 'Base', 'Nivel', '% lleno', 'Autonomía'], rows: ts.map((t) => [t.tank.nombre, t.tank.unit, `${fmt(t.nivel)} L`, pct(t.pctLleno, 0), `${fmt(t.autonomia, 1)} días`]) }, actions: [{ kind: 'go', label: 'Ir a Combustible', module: 'Combustible', unit: u }, { kind: 'metric', label: 'Rendimiento km/l', k: 'kmpl', unit: u, month: 11 }] };
}
function stockAnswer(q: string, u: UnitFilter): Answer {
  const toks = q.split(' ').filter((w) => w.length > 3 && !/stock|cuant|tenemos|queda|quedan|panol|articulo|precio|valor|cuesta|para|sobre|cuanto|unidades/.test(w));
  const hit = toks.length ? ARTS.map((a) => ({ a, s: toks.filter((w) => norm(`${a.nombre} ${a.codigo}`).includes(w.replace(/s$/, ''))).length })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s) : [];
  if (hit.length && hit[0].s >= Math.min(2, toks.length)) {
    const list = hit.filter((x) => x.s === hit[0].s).slice(0, 6).map((x) => x.a);
    if (list.length === 1) { const a = list[0]; return { intent: 'articulo', text: `${B(a.nombre)} (${a.codigo} · ${a.cat}): ${B(`${fmt(stockOf(a, u))} ${a.unidad}`)} ${inUnit(u)}, mínimo ${fmt(minOf(a, u))}${bajoMin(a, u) ? ` — ${B('bajo mínimo')}` : ''}. Precio ${money(a.precio, 0)} · valorizado ${moneyM(valorOf(a, u))}.`, table: { head: ['Base', 'Stock', 'Mínimo', 'Ubicación'], rows: UNIT_NAMES.map((b) => [b, fmt(a.stock[b]), fmt(a.min[b]), a.ubic[b]]) }, actions: [{ kind: 'go', label: 'Ir a Pañol · Artículos', module: 'Pañol', tab: 'Artículos', unit: u }] }; }
    return { intent: 'articulos', text: `Encontré ${B(String(list.length))} artículos que coinciden ${inUnit(u)}.`, table: { head: ['Código', 'Artículo', 'Stock', 'Mínimo'], rows: list.map((a) => [a.codigo, a.nombre, `${fmt(stockOf(a, u))} ${a.unidad}`, fmt(minOf(a, u))]) }, actions: [{ kind: 'go', label: 'Ir a Pañol · Artículos', module: 'Pañol', tab: 'Artículos', unit: u }] };
  }
  const low = ARTS.filter((a) => bajoMin(a, u)); const val = ARTS.reduce((s, a) => s + valorOf(a, u), 0);
  if (hasRe(q, /minimo|faltante|reponer|comprar|critico|quiebre/)) return { intent: 'stock-bajo', text: `${B(plural(low.length, 'artículo'))} bajo el mínimo ${inUnit(u)}.`, table: { head: ['Código', 'Artículo', 'Stock', 'Mínimo'], rows: low.slice(0, 15).map((a) => [a.codigo, a.nombre, fmt(stockOf(a, u)), fmt(minOf(a, u))]), note: low.length > 15 ? `Se muestran 15 de ${low.length}.` : undefined }, actions: [{ kind: 'go', label: 'Ir a Pañol', module: 'Pañol', tab: 'Stock valorizado', unit: u }] };
  return { intent: 'stock', text: `Pañol ${inUnit(u)}: ${B(moneyM(val))} en stock valorizado, ${fmt(ARTS.length)} artículos y ${B(String(low.length))} bajo el mínimo.\nEl stock es de demostración hasta conectar el maestro de pañol.`, table: { head: ['Artículo', 'Categoría', 'Valorizado'], rows: [...ARTS].sort((a, b) => valorOf(b, u) - valorOf(a, u)).slice(0, 8).map((a) => [a.nombre, a.cat, moneyM(valorOf(a, u))]), note: 'Los 8 de mayor valor.' }, actions: [{ kind: 'go', label: 'Ir a Pañol', module: 'Pañol', unit: u }], next: ['Artículos bajo el mínimo', 'Cubiertas a cambiar'] };
}
function tireAnswer(q: string, u: UnitFilter): Answer {
  const serie = /\b([a-z]-?\d{4,5})\b/.exec(q)?.[1];
  if (serie) { const t = TIRES.find((x) => norm(x.serie).replace('-', '') === serie.replace('-', '')); if (t) return { intent: 'cubierta', text: `Cubierta ${B(t.serie)} · ${t.marca} ${t.medida} (${t.tipo}) · ${t.unit}.\n• ${t.estado}${t.bus ? ` en el interno ${t.bus.interno}, ${t.ubic}` : ` · ${t.ubic}`}.\n• Dibujo ${B(`${t.mm} mm`)} (límite ${t.limite} mm), ${t.psi} psi, ${fmt(t.kmTotal)} km.${t.fechaCambio ? `\n• Cambio estimado: ${B(t.fechaCambio)}.` : ''}`, actions: [{ kind: 'go', label: 'Ir a Neumáticos', module: 'Pañol', tab: 'Neumáticos', unit: t.unit }] }; }
  const ts = tiresOf(u).filter((t) => t.estado === 'Montada'); const now = ts.filter((t) => t.mm <= t.limite); const soon = ts.filter((t) => t.diasCambio !== null && t.diasCambio <= 30 && t.mm > t.limite);
  const pr = proyeccion(u);
  return { intent: 'cubiertas', text: `Cubiertas ${inUnit(u)}: ${fmt(ts.length)} montadas. ${B(plural(now.length, 'cubierta'))} ya en el límite de dibujo y ${B(String(soon.length))} más para cambiar en 30 días.\nCompra proyectada a 6 meses: ${B(moneyM(pr.reduce((s, m) => s + m.costo, 0)))}.`, table: { head: ['Mes', 'Nuevas', 'Precuradas', 'Compra'], rows: pr.map((m) => [m.label, String(m.nuevas), String(m.precuradas), moneyM(m.costo)]) }, actions: [{ kind: 'go', label: 'Ir a Neumáticos', module: 'Pañol', tab: 'Neumáticos', unit: u }, { kind: 'go', label: 'Ver proyecciones', module: 'Pañol', tab: 'Proyecciones', unit: u }] };
}

// ---------- Sistemas: fuentes, cobertura, conexión ----------
function sourceAnswer(): Answer {
  const b = snapshotBlocks(); const av = avance(); const f = SNAP?.meta?.fuentes ?? [];
  const tipo = SOURCE.config.tipo === 'supabase' ? 'Supabase' : SOURCE.config.tipo === 'json' ? 'archivo JSON' : 'ninguna';
  const lines = [
    `Estado de la conexión: ${B(sourceLabel())}. Fuente configurada: ${B(tipo)}${SOURCE.config.url ? ` (${SOURCE.config.url})` : ''}.`,
    ...(SOURCE.error ? [`• Último error: ${SOURCE.error}`] : []),
    ...(SOURCE.cargado ? [`• Snapshot ${SOURCE.modo === 'cache' ? 'guardado' : 'bajado'} el ${new Date(SOURCE.cargado).toLocaleString('es-AR')}${SOURCE.ms ? ` en ${SOURCE.ms} ms` : ''}.`] : []),
    `• Ventana del tablero: ${MONTH_FULL[0]} a ${MONTH_FULL[11]} (corte ${corteTxt}).`,
    ...(SNAP ? [`• Filas recibidas: mensual ${b.mensual}, RR.HH. ${b.rrhh_mensual}, unidades ${b.unidades}, OT ${b.ot}.`] : []),
    `• Avance hacia cero demo: ${B(pct(av.pct, 0))} (${av.real} indicadores reales, ${av.parcial} parciales y ${av.demo} de demostración).`,
    ...(SOURCE.avisos.length ? [`• Avisos de la carga: ${SOURCE.avisos.slice(0, 3).join(' · ')}`] : []),
  ];
  return { intent: 'fuentes', text: lines.join('\n'), table: f.length ? { head: ['Fuente', 'Estado', 'Corte', 'Frescura'], rows: f.map((x) => [x.nombre, x.estado ?? '—', x.corte ?? '—', x.frescura ?? '—']) } : undefined, actions: [{ kind: 'panel', label: 'Abrir Fuente de datos', panel: 'fuentes' }], next: ['¿Qué falta para sacar los datos demo?', '¿Cómo conecto la base?', '¿Qué indicadores son reales?'] };
}
function coverageAnswer(mod: Target | null): Answer {
  const av = avance(); const keys = (Object.keys(METRICS) as MetricKey[]).filter((k) => !mod || METRICS[k].module === mod);
  const rows = keys.map((k) => { const c = coverage(k, 'Todos', 11); return [METRICS[k].label, MOD_LABEL[METRICS[k].module], c === 'real' ? 'Real' : c === 'parcial' ? `Parcial (${realBases(k, 11).join(', ')})` : 'Demo']; }).sort((a, b) => a[2].localeCompare(b[2]));
  return { intent: 'cobertura', text: `Avance hacia cero demo: ${B(pct(av.pct, 0))} — ${av.real} indicadores reales, ${av.parcial} parciales y ${av.demo} de demostración sobre ${av.total}.\n${av.porModulo.map((x) => `• ${MOD_LABEL[x.modulo]}: ${pct(x.pct, 0)} (${x.real} reales, ${x.parcial} parciales, ${x.demo} demo)`).join('\n')}${SOURCE.modo === 'demo' ? '\nHoy no hay ninguna base conectada, por eso todo figura como demostración.' : ''}`, table: { head: ['Indicador', 'Módulo', 'Estado'], rows }, actions: [{ kind: 'panel', label: 'Abrir Fuente de datos', panel: 'fuentes' }], next: ['¿Qué falta para sacar los datos demo?', '¿Cómo conecto la base?'] };
}
function missingAnswer(mod: string | null): Answer {
  const list = FALTANTES.filter((f) => !mod || f.modulo === mod);
  return { intent: 'faltantes', text: `${B(plural(list.length, 'dato'))} sin fuente todavía${mod ? ` en ${mod}` : ''}. Cada uno indica qué indicadores completa, quién lo tiene y en qué tabla de la base limpia se carga.`, table: { head: ['Módulo', 'Dato que falta', 'Quién lo tiene', 'Tabla'], rows: list.map((f) => [f.modulo, f.dato, f.area, f.bloque]) }, actions: [{ kind: 'panel', label: 'Abrir Fuente de datos', panel: 'fuentes' }], next: ['¿Cómo conecto la base?', '¿Qué indicadores son reales?'] };
}
function connectAnswer(): Answer {
  return { intent: 'conectar', text: `Para conectar el tablero a la base:\n• ${B('1.')} En Supabase, correr base_limpia/sql/01_esquema.sql (crea el esquema «tablero») y 03_snapshot.sql (crea la función tablero_snapshot).\n• ${B('2.')} Cargar las tablas con los conectores (cada fuente reemplaza solo sus filas).\n• ${B('3.')} En el tablero: menú «Fuente de datos» → Supabase, pegar la dirección del proyecto y la clave pública (anon) y tocar «Probar conexión».\n• ${B('4.')} Guardar: el tablero se recarga y marca cada indicador como real o demo.\nEl tablero pide un solo resultado con agregados; no lee tablas ni usa la clave service_role. También acepta un archivo JSON con el mismo formato (hay un ejemplo en datos/ejemplo-snapshot.json).`, actions: [{ kind: 'panel', label: 'Abrir Fuente de datos', panel: 'fuentes' }], next: ['¿Qué tablas tiene la base?', '¿Qué formato tiene el snapshot?', 'Estado de la conexión'] };
}
function schemaAnswer(): Answer {
  const rows = [['fuente · carga_log · aviso', 'Catálogo de fuentes, bitácora de cargas y avisos de calidad'], ['unidad · plan_mant · vencimiento', 'Flota: estado, odómetro, plan por km y vencimientos'], ['ot · ot_material · auxilio', 'Taller: órdenes de trabajo, materiales y auxilios'], ['trafico_dia · trafico_linea_mes · trafico_hora', 'Tráfico: km, pasajeros, recaudación y foto horaria'], ['comb_mes · comb_dia · comb_ingreso · comb_aforo', 'Combustible: consumos, ingresos y aforos'], ['panol_stock · panol_mov · cubierta…', 'Pañol y cubiertas'], ['siniestro · siniestro_geo · exceso_velocidad', 'Siniestros, incidentes y excesos'], ['personal · rrhh_novedad · rrhh_mes', 'RR.HH. (Flitmo)'], ['finanzas_mes', 'Costos e ingresos (Contabilidad)']];
  return { intent: 'esquema', text: `La base limpia vive en el esquema ${B('tablero')} (base_limpia/sql/01_esquema.sql). Cada fila guarda de qué fuente vino; cada conector reemplaza solo lo suyo. El tablero lee todo a través de ${B('public.tablero_snapshot()')}.`, table: { head: ['Tablas', 'Contenido'], rows }, next: ['¿Qué formato tiene el snapshot?', '¿Cómo conecto la base?'] };
}
function contractAnswer(): Answer {
  const rows = [['meta', 'hasta (AAAA-MM, último mes cerrado), corte, generado y la lista de fuentes con su estado'], ['mensual', 'Una fila por base y mes: kmProg, kmExec, pax, reg, lts, sin, exc, aux, aus, cob, cost, inc, otClosed, otOpen, prevDone, horas, total, oper…'], ['rrhh_mensual', 'Una fila por base y mes: activos, altas, bajas, ausDias, ausPct, artCant, artDias, carpCant, carpDias, susCant, susDias, remun'], ['unidades', 'Flota: base, interno, dominio, chasis, año, km, línea, estado'], ['ot', 'Órdenes de trabajo con tipo, estado, fechas, mecánico, horas, componentes y materiales']];
  return { intent: 'contrato', text: `El tablero recibe un único JSON («snapshot»). Solo ${B('meta')} es obligatorio; cada bloque que llega reemplaza a los datos de demostración y lo que no llega queda en demo y marcado.\nEl mes ${B(ymOf(11))} es hoy el último de la ventana.`, table: { head: ['Bloque', 'Contenido'], rows }, next: ['¿Cómo conecto la base?', '¿Qué tablas tiene la base?'] };
}

function helpAnswer(): Answer {
  return { intent: 'ayuda', text: `Soy el asistente del tablero. Respondo con los mismos datos que ves en pantalla; no uso ninguna IA externa ni tengo costo. Puedo ayudarte con:\n• ${B('Indicadores')}: valor, objetivo, evolución, ranking y comparación entre bases.\n• ${B('Flota y taller')}: un coche por interno, una OT, detenidos, preventivos vencidos, reincidencias, productividad.\n• ${B('RR.HH. y seguridad')}: ausentismo, un legajo, siniestros, conductores, reclamos.\n• ${B('Combustible y pañol')}: tanques, rendimiento, stock de un artículo, cubiertas a cambiar.\n• ${B('Sistemas')}: estado de la conexión, qué datos son reales, qué falta y cómo conectar la base.`, next: ['Resumen del mes', '¿Qué está fuera de objetivo?', 'Interno 512', '¿Qué falta para sacar los datos demo?'] };
}

// ---------- intérprete ----------
export function answer(raw: string, ctx: Ctx): { a: Answer; mem: Memory } {
  const q = norm(raw); const mem: Memory = { ...ctx.mem };
  const done = (a: Answer, patch: Memory = {}) => ({ a, mem: { ...mem, ...patch, intent: a.intent } });
  if (!q) return done(helpAnswer());

  const bases = findBases(q); const allWord = ALL_WORDS.test(q);
  const explicitUnit: UnitFilter | null = bases.length === 1 ? bases[0] : bases.length > 1 || allWord ? 'Todos' : null;
  const unit: UnitFilter = explicitUnit ?? (mem.unit && isFollowUp(q) ? mem.unit : ctx.unit);
  const mFound = findMonth(q); const month = mFound ?? (isFollowUp(q) && mem.month !== undefined ? mem.month : 11);
  const span = findSpan(q);
  const k = findMetric(q);

  // --- saludos y ayuda
  if (hasRe(q, /^(hola|buen dia|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey)( |$)/) && q.split(' ').length <= 3) return done(helpAnswer());
  if (hasRe(q, /(^| )(ayuda|que podes hacer|que sabes hacer|que puedo preguntar|como te uso|para que servis|que haces)( |$)/)) return done(helpAnswer());
  if (hasRe(q, /^(gracias|muchas gracias|genial|perfecto|ok|listo|dale)( |$)/)) return done({ intent: 'cortesia', text: 'De nada. Cuando quieras seguimos.', next: ['Resumen del mes', '¿Qué está fuera de objetivo?'] });

  // --- Sistemas
  if (hasRe(q, /como (conecto|conectar|se conecta|enlazo|configuro)|conectar (la )?base|configurar (la )?(fuente|base|conexion)|pasos para conectar/)) return done(connectAnswer());
  if (hasRe(q, /formato|contrato|snapshot|json|que (campos|bloques)|estructura del (archivo|snapshot)/)) return done(contractAnswer());
  if (hasRe(q, /tablas|esquema|base limpia|modelo de datos|estructura de la base/)) return done(schemaAnswer());
  if (hasRe(q, /que falta|faltan|faltantes|pendientes de datos|cero demo|sacar (los )?(datos )?demo|datos que faltan|para completar/)) { const mod = MOD_WORDS.find(([re]) => re.test(q))?.[1] ?? null; return done(missingAnswer(mod === 'Resumen' ? null : mod)); }
  if (hasRe(q, /(son|es|esta|estan) (real|reales|demo)|datos reales|datos demo|que (datos|indicadores) son|cobertura de datos|avance|porcentaje de avance|de demostracion/)) { const mod = MOD_WORDS.find(([re]) => re.test(q))?.[1] ?? null; return done(coverageAnswer(mod === 'Resumen' ? null : mod)); }
  if (hasRe(q, /fuente|fuentes|conexion|conectad|supabase|base de datos|ultima (carga|actualizacion)|cuando se actualizo|de donde (sale|salen|viene|vienen)|origen de los datos|estado de la (base|carga)|sincroniz|errores de carga|avisos/)) return done(sourceAnswer());

  // --- entidades concretas
  const otId = /(^| )ot[ -]?s?(\d{3,6})( |$)/.exec(q)?.[2];
  if (otId) { const a = otAnswer(otId); if (a) return done(a); return done({ intent: 'no-encontrado', text: `No encuentro la OT ${otId}.`, next: ['OT abiertas'] }); }
  const unitM = /(interno|coche|unidad|colectivo|micro|bondi|movil)\s*(n|nro|numero)?\s*(\d{2,4})( |$)/.exec(q)?.[3] ?? (/^\d{3,4}$/.test(q) ? q : null);
  if (unitM) { if (unitById[unitM]) return done(unitAnswer(unitM)); return done({ intent: 'no-encontrado', text: `No hay ningún coche con el interno ${unitM}. Los internos van de ${ALL_UNITS[0].interno} a ${ALL_UNITS[ALL_UNITS.length - 1].interno}.`, next: ['¿Cuántos coches tiene la flota?'] }); }
  const lineM = /linea\s+([a-z]|\d{1,3})( |$)/.exec(q)?.[1];
  if (lineM) { const a = lineAnswer(lineM, unit, month); if (a) return done(a); }
  if (hasRe(q, /legajo\s*\d{3,5}/) || EMPS.some((e) => { const n = norm(e.nombre).split(' '); return n.length >= 2 && n.every((p) => has(q, p)); })) { const a = empAnswer(q, month); if (a) return done(a); }
  for (const b of UNIT_NAMES) for (const mName of mechanicsByBase[b]) if (norm(mName).split(' ').every((p) => has(q, p))) return done(mechAnswer(b, month, norm(mName)));
  for (const b of UNIT_NAMES) { const d = DRIVERS[b].find((x) => norm(x.name).split(' ').every((p) => has(q, p))); if (d) { const row = sinData(b, month).drivers.find((x) => x.d.id === d.id); return done({ intent: 'conductor', text: `${B(d.name)} · legajo ${d.legajo} · ${b}. En ${MONTH_FULL[month]}: ${row?.sin ?? 0} siniestros y ${row?.inc ?? 0} incidentes; acumulado 12 meses ${B(String(row?.acum ?? 0))}. Estado: ${B(row?.estado ?? 'NORMAL')}.`, actions: [{ kind: 'go', label: 'Ver histórico de conductores', module: 'Seguridad', tab: 'Histórico de conductores', unit: b }] }); } }

  // --- navegación
  if (hasRe(q, /^(ir a|abrir|abri|mostrar|mostrame|llevame a|ver|anda a|ve a) /)) { const mod = MOD_WORDS.find(([re]) => re.test(q))?.[1]; if (mod && !k) return done({ intent: 'navegar', text: `Abro ${B(MOD_LABEL[mod])}${explicitUnit && explicitUnit !== 'Todos' ? ` de ${explicitUnit}` : ''}.`, actions: [{ kind: 'go', label: `Ir a ${MOD_LABEL[mod]}`, module: mod, unit: explicitUnit ?? undefined }] }); }

  // --- temas operativos (antes que el indicador genérico, porque son listados)
  if (hasRe(q, /esperando repuesto|espera de repuesto|por repuesto|falta de repuesto/)) return done(stoppedAnswer(unit, true), { unit });
  if (hasRe(q, /deten|parad|en (el )?taller|inmoviliz|rotos|que coches (estan|hay)/) && !hasRe(q, /cuant[oa]s? (horas|ot)/)) return done(stoppedAnswer(unit, false), { unit });
  if (hasRe(q, /(preventiv|service|servis|mantenimiento).*(vencid|pendient|atrasad)|(vencid|pendient|atrasad).*(preventiv|service|mantenimiento)/)) return done(pendAnswer(unit), { unit, k: 'prevPend' });
  if (hasRe(q, /(ot|ordenes)( de trabajo)? (abiert|pendient)|que ot|listado de ot/)) return done(openOtAnswer(unit), { unit, k: 'otOpen' });
  if (hasRe(q, /reinciden|retrabajo/) && !hasRe(q, /chofer|conductor/)) return done(reincAnswer(unit, month), { unit, month, k: 'reinc' });
  if (hasRe(q, /productividad|mecanico|quien (trabajo|reparo)|produccion del taller/)) return done(mechAnswer(unit, month), { unit, month });
  if (hasRe(q, /tanque|autonomia|stock de (gasoil|combustible)|nivel de (gasoil|combustible)|cuanto gasoil (hay|queda)|cuanto combustible (hay|queda)/)) return done(tankAnswer(unit), { unit });
  if (hasRe(q, /cubierta|neumatic|goma|gomeria|rodado/)) return done(tireAnswer(q, unit), { unit });
  if (hasRe(q, /stock|panol|articulo|repuesto .*(hay|queda|tenemos)|bajo (el )?minimo|faltantes de panol|cuant[oa]s? .* (hay|quedan|tenemos) en/) && k !== 'gastoRep') return done(stockAnswer(q, unit), { unit });
  if (hasRe(q, /(conductor|chofer)(es)? (con|que) (mas|mayor)|reincidencia de (conductores|choferes)|peores (choferes|conductores)|ranking de (choferes|conductores)/)) return done(sinAnswer(unit, month, true, false), { unit, month, k: 'sin' });
  if (hasRe(q, /reclamo|seguimiento economico|aseguradora|cobrado|reconocido/)) return done(sinAnswer(unit, month, false, true), { unit, month });
  if (hasRe(q, /(peor|mejor|ranking de) lineas?|lineas? (con|que) (peor|mejor|mas|menos)|que linea|cuales lineas|por linea/)) { const a = lineAnswer(null, unit, month, !hasRe(q, /mejor/)); if (a) return done(a, { unit, month }); }
  if (hasRe(q, /trafico (de )?hoy|como (viene|va|esta) (el )?(dia|trafico|servicio)|en la calle|en calle ahora|ahora en calle/)) return done(todayAnswer(unit), { unit });
  if (hasRe(q, /(que|cual) base (necesita|esta peor|anda peor|preocupa)|peor base|base (mas )?(complicada|critica)|donde estamos peor/) && !k) return done(worstBaseAnswer(month), { month });

  // --- panorama
  if (!k && hasRe(q, /resumen|panorama|como (estamos|venimos|andamos|vamos|viene)|situacion|que paso|novedades|estado general|informe|reporte|sintesis/)) return done(summaryAnswer(unit, month), { unit, month });
  if (!k && hasRe(q, /alerta|problema|fuera de objetivo|que esta mal|que anda mal|atencion|preocup|critico|rojo|riesgo|desvio/)) return done(alertsAnswer(unit, month), { unit, month });
  if (!k && hasRe(q, /cuant[oa]s? (coches|unidades|colectivos|micros|internos)|tamano de (la )?flota|estado de (la )?flota|(^| )flota( |$)/)) return done(fleetAnswer(unit), { unit });
  if (!k && hasRe(q, /rrhh|rr hh|recursos humanos/)) return done(hrAnswer(unit, month), { unit, month });

  // --- indicadores
  const followK = !k && isFollowUp(q) && (explicitUnit || mFound !== null || span) ? mem.k : null;
  const kk = k ?? followK ?? null;
  if (kk) {
    const patch: Memory = { k: kk, unit, month };
    if (hasRe(q, /que es|que significa|como se calcula|definicion|que mide|explica|formula|de donde sale/)) return done(defineAnswer(kk), patch);
    if (bases.length >= 2) return done(compareAnswer(kk, bases, month, span), patch);
    if (hasRe(q, /compar|versus|(^| )vs( |$)|entre bases|por base|cada base|las bases/)) return done(compareAnswer(kk, [...UNIT_NAMES], month, span), patch);
    if (hasRe(q, /(peor|mejor|mas alt|mas baj|mayor|menor|mas |menos |ranking|top|lider|ultim[oa] lugar)/) && hasRe(q, /base|unidad de negocio|sede|donde|quien|ranking|cual/)) { const worst = hasRe(q, /peor|necesita|preocup|ultim[oa] lugar/) || (!hasRe(q, /mejor/) && hasRe(q, METRICS[kk].goodUp ? /mas baj|menor|menos |minim/ : /mas alt|mayor|(^| )mas |maxim/)); return done(rankAnswer(kk, month, span, worst), patch); }
    if (hasRe(q, /evolucion|tendencia|historic|ultimos meses|como viene|como vino|12 meses|doce meses|mes a mes|serie|grafico|trayectoria|sube o baja|esta subiendo|esta bajando/) && span !== 'trimestre') return done(trendAnswer(kk, unit), patch);
    if (kk === 'sin' && !followK && !span && !hasRe(q, /cuant|objetivo|numero|cantidad|total/)) return done(sinAnswer(unit, month, false, false), patch);
    return done(valueAnswer(kk, unit, month, span), patch);
  }

  // --- seguimiento sin indicador («¿y en Comodoro?»)
  if (isFollowUp(q) && mem.intent === 'resumen') return done(summaryAnswer(unit, month), { unit, month });
  if (isFollowUp(q) && mem.intent === 'alertas') return done(alertsAnswer(unit, month), { unit, month });
  if (bases.length === 1 && q.split(' ').length <= 4) return done(summaryAnswer(bases[0], month), { unit: bases[0], month });
  const mod = MOD_WORDS.find(([re]) => re.test(q))?.[1];
  if (mod) return done({ intent: 'modulo', text: `Eso está en ${B(MOD_LABEL[mod])}. ¿Lo abro o preferís un dato puntual?`, actions: [{ kind: 'go', label: `Ir a ${MOD_LABEL[mod]}`, module: mod, unit: explicitUnit ?? undefined }], next: suggestFor(mod) });

  return done({ intent: 'no-entendi', text: `No llegué a entender la pregunta. Trabajo con los datos del tablero: probá nombrar un indicador (ausentismo, disponibilidad, costo por km…), una base, un interno o una OT.`, next: ['Resumen del mes', '¿Qué está fuera de objetivo?', 'Disponibilidad por base', '¿Qué puedo preguntar?'] });
}
const isFollowUp = (q: string) => /^(y |e |tambien |ahora |entonces |pero )/.test(q) || q.split(' ').length <= 4;
const suggestFor = (m: Target): string[] => ({ Resumen: ['Resumen del mes', '¿Qué está fuera de objetivo?'], Tráfico: ['Cumplimiento de km por base', 'Peor línea del mes', 'Tráfico de hoy'], Flota: ['¿Cuántos coches tiene la flota?', 'Coches detenidos', 'Disponibilidad por base'], Taller: ['OT abiertas', 'Preventivos vencidos', 'Reincidencias del mes', 'Gasto de mantenimiento'], RRHH: ['Ausentismo por base', 'Altas y bajas del mes', 'Días de ART'], Combustible: ['Rendimiento km por litro', 'Estado de los tanques', 'Litros consumidos'], Seguridad: ['Siniestros del mes', 'Conductores con más siniestros', 'Excesos de velocidad por base'], Pañol: ['Artículos bajo el mínimo', 'Cubiertas a cambiar', 'Valor del stock'] }[m]);

/** Preguntas de arranque según quién consulta y en qué pantalla está. */
export const STARTERS = {
  gerencia: ['Resumen del mes', '¿Qué está fuera de objetivo?', '¿Qué base necesita más atención?', 'Costo por km por base', 'Coches detenidos en taller', 'Evolución del ausentismo', 'Siniestros del mes', 'Comparar disponibilidad entre Córdoba y Comodoro'],
  sistemas: ['Estado de la conexión', '¿Qué indicadores son reales?', '¿Qué falta para sacar los datos demo?', '¿Cómo conecto la base?', '¿Qué tablas tiene la base?', '¿Qué formato tiene el snapshot?'],
  porModulo: suggestFor,
};
