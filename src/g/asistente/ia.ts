/* Asistente con Gemini (opcional).
   El tablero NUNCA tiene la clave de Gemini: llama a la función «asistente» de Supabase (supabase/functions/asistente),
   que guarda la clave como secreto y habla con Google. Si la función no está o falla, queda la respuesta local.
   A Gemini solo se le manda la pregunta, la respuesta que ya calculó el tablero y un resumen de indicadores
   (totales por base y mes). Nunca nombres, DNI ni legajos. */
import { SOURCE } from '../../data/source';
import { MONTH_FULL, MONTH_LABELS, UNIT_NAMES, type UnitFilter } from '../data';
import { METRICS, type MetricKey } from '../metrics';
import type { Answer } from './engine';

interface IaConfig { url: string; anonKey: string }
type WinCfg = { SOLBUS_CONFIG?: { asistente?: { ia?: boolean; url?: string; anonKey?: string } } };

/** Dónde está la función: la indicada en config.js o, si el tablero lee de Supabase, la del mismo proyecto. */
export function iaConfig(): IaConfig | null {
  const w = (globalThis as WinCfg).SOLBUS_CONFIG?.asistente;
  if (w?.ia === false) return null;
  if (w?.url && w.anonKey) return { url: w.url, anonKey: w.anonKey };
  const c = SOURCE.config;
  if (c.tipo === 'supabase' && c.url && c.anonKey) return { url: `${c.url.replace(/\/$/, '')}/functions/v1/asistente`, anonKey: c.anonKey };
  return null;
}
export const iaReady = () => iaConfig() !== null;

/** Respuestas que no se mandan a Gemini: tienen datos de personas o son internas. */
const LOCAL_ONLY = new Set(['empleado', 'legajo', 'conductor', 'mecanico', 'productividad', 'siniestros', 'siniestros-choferes', 'rrhh', 'ot', 'reservado', 'fuentes', 'cobertura', 'faltantes', 'conectar', 'esquema', 'contrato', 'cortesia', 'navegar', 'no-encontrado']);
export const goesToIa = (a: Answer) => !LOCAL_ONLY.has(a.intent);

const KEYS = Object.keys(METRICS) as MetricKey[];
/** Resumen compacto de todos los indicadores: último mes y anterior por base, y 12 meses del grupo. */
export function contexto(unit: UnitFilter, month: number): string {
  const m0 = month, m1 = Math.max(0, month - 1);
  const safe = (k: MetricKey, u: UnitFilter, m: number) => { try { const v = METRICS[k].get(u, m); return isFinite(v) ? METRICS[k].fmt(v) : '—'; } catch { return '—'; } };
  const head = `Período del tablero: ${MONTH_FULL[0]} a ${MONTH_FULL[11]}. Mes consultado: ${MONTH_FULL[m0]}. Unidad seleccionada en pantalla: ${unit === 'Todos' ? 'todas las bases' : unit}.`;
  const rows = KEYS.map((k) => {
    const d = METRICS[k]; const o = d.obj?.('Todos');
    const bases = (['Todos', ...UNIT_NAMES] as UnitFilter[]).map((u) => `${u === 'Todos' ? 'Grupo' : u}: ${safe(k, u, m0)} (antes ${safe(k, u, m1)})`).join(' | ');
    return `- ${d.label}${o ? ` [objetivo ${o.txt}]` : ''}${d.goodUp ? ' (mejor si sube)' : ' (mejor si baja)'}: ${bases}`;
  });
  const serie = (['cumpl', 'disp', 'aus', 'cost', 'sin', 'ipk'] as MetricKey[]).filter((k) => METRICS[k]).map((k) => `- ${METRICS[k].label}: ${MONTH_LABELS.map((lb, i) => `${lb} ${safe(k, unit, i)}`).join(', ')}`);
  return [head, `Indicadores (${MONTH_LABELS[m0]} y mes anterior):`, ...rows, `Evolución 12 meses (${unit === 'Todos' ? 'grupo' : unit}):`, ...serie].join('\n');
}

export interface IaTurn { q: string; a: string }
/** Pide la redacción a Gemini. Devuelve el texto o lanza un error (el asistente se queda con la respuesta local). */
export async function askIa(q: string, local: Answer, unit: UnitFilter, month: number, history: IaTurn[]): Promise<string> {
  const cfg = iaConfig(); if (!cfg) throw new Error('sin configurar');
  const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(cfg.url, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.anonKey}`, apikey: cfg.anonKey },
      body: JSON.stringify({ pregunta: q.slice(0, 300), respuestaTablero: local.text.slice(0, 4000), tablaTablero: local.table ? { head: local.table.head, rows: local.table.rows.slice(0, 25) } : null, contexto: contexto(unit, month), historial: history.slice(-4) }),
    });
    const j = (await res.json().catch(() => ({}))) as { texto?: string; error?: string };
    if (!res.ok || !j.texto) throw new Error(j.error ?? `HTTP ${res.status}`);
    return j.texto.trim();
  } finally { window.clearTimeout(t); }
}
