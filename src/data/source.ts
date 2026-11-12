/* Fuente de datos del tablero.
   El tablero arranca siempre: si no hay fuente configurada (o falla) usa los datos de demostración.
   Cuando hay fuente, se baja UN «snapshot» (JSON con agregados) antes de dibujar y cada módulo reemplaza
   sus valores demo por los reales que encuentre ahí. El contrato del snapshot está documentado en
   base_limpia/README.md y lo arma la función SQL public.tablero_snapshot() (base_limpia/sql/03_snapshot.sql). */

export type SourceKind = 'demo' | 'json' | 'supabase';
export interface SourceConfig {
  tipo: SourceKind;
  /** json: dirección del archivo/endpoint · supabase: https://<proyecto>.supabase.co */
  url?: string;
  /** supabase: clave pública (anon). Nunca la service_role. */
  anonKey?: string;
  /** supabase: nombre de la función RPC (por defecto tablero_snapshot) */
  rpc?: string;
}

/** Fila mensual por base: cualquiera de estas columnas reemplaza al valor demo de ese mes. */
export interface SnapMensual {
  base: string; mes: string; // 'AAAA-MM'
  kmProg?: number; kmExec?: number; reg?: number; total?: number; oper?: number; out?: number;
  aux?: number; aus?: number; cob?: number; sin?: number; exc?: number; cost?: number; inc?: number; pax?: number;
  otClosed?: number; otOpen?: number; prevDone?: number; prevPend?: number; reinc?: number;
  itcVenc?: number; itc30?: number; itc60?: number; enRep?: number; espRep?: number; fuera?: number;
  repTime?: number; personal?: number; horas?: number; lts?: number;
}
export interface SnapRRHH {
  base: string; mes: string;
  activos?: number; altas?: number; bajas?: number; ausDias?: number; ausPct?: number; artCant?: number; artDias?: number;
  carpCant?: number; carpDias?: number; susCant?: number; susDias?: number; remun?: number; feriados?: number; guardias?: number;
}
export interface SnapUnidad {
  base: string; interno: string; dominio?: string; chasis?: string; carroceria?: string; anio?: number; km?: number; linea?: string;
  /** Operativo | En taller | Esperando repuesto | Fuera de servicio */
  estado?: string; ultServiceKm?: number; ultPreventivoKm?: number;
}
export interface SnapOT {
  id: string; base: string; interno: string;
  /** Correctivo | Preventivo 20K | Service 30K | Auxilio en calle | Siniestro */
  tipo?: string;
  /** Abierta | En curso | Esperando repuesto | Cerrada */
  estado?: string;
  prioridad?: string; abierta: string; cerrada?: string | null; km?: number; origen?: string; titulo?: string; diagnostico?: string;
  mecanico?: string; horas?: number;
  /** ids del catálogo de componentes del bus (src/data/catalog.ts); los que no existan se ignoran */
  componentes?: string[];
  materiales?: { codigo: string; nombre: string; unidad?: string; cantidad: number; precio: number; origen?: string }[];
}
export interface SnapFuente { id: string; nombre: string; tipo?: string; estado?: string; ultima_carga?: string | null; corte?: string | null; filas?: number | null; frescura?: string | null; detalle?: string | null }
export interface Snapshot {
  meta: { generado?: string; /** último mes cerrado que muestra el tablero, 'AAAA-MM' */ hasta?: string; /** fecha del último dato, 'AAAA-MM-DD' */ corte?: string; fuentes?: SnapFuente[] };
  mensual?: SnapMensual[];
  rrhh_mensual?: SnapRRHH[];
  unidades?: SnapUnidad[];
  ot?: SnapOT[];
}

export interface SourceState {
  config: SourceConfig;
  /** demo: sin fuente · real: snapshot recién bajado · cache: no se pudo bajar y se usa el último guardado */
  modo: 'demo' | 'real' | 'cache';
  error?: string;
  cargado?: string;
  ms?: number;
  avisos: string[];
}

const LS_CFG = 'solbus-datasource';
const LS_SNAP = 'solbus-snapshot';

export let SNAP: Snapshot | null = null;
export const SOURCE: SourceState = { config: { tipo: 'demo' }, modo: 'demo', avisos: [] };

const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }, del: (k: string) => { try { localStorage.removeItem(k); } catch { /* */ } } };

export function readConfig(): SourceConfig {
  try { const raw = ls.get(LS_CFG); if (raw) { const c = JSON.parse(raw) as SourceConfig; if (c && (c.tipo === 'demo' || c.tipo === 'json' || c.tipo === 'supabase')) return c; } } catch { /* configuración ilegible: se ignora */ }
  const w = (globalThis as { SOLBUS_CONFIG?: { fuente?: SourceConfig } }).SOLBUS_CONFIG;
  if (w?.fuente?.tipo) return w.fuente;
  return { tipo: 'demo' };
}
export function saveConfig(c: SourceConfig) { if (c.tipo === 'demo') ls.del(LS_CFG); else ls.set(LS_CFG, JSON.stringify(c)); }

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
/** Valida la forma mínima del snapshot; devuelve el texto del problema o null si sirve. */
export function validate(x: unknown): string | null {
  if (!isObj(x)) return 'La respuesta no es un objeto JSON.';
  if (!isObj(x.meta)) return 'Falta el bloque «meta».';
  for (const k of ['mensual', 'rrhh_mensual', 'unidades', 'ot'] as const) if (x[k] !== undefined && x[k] !== null && !Array.isArray(x[k])) return `El bloque «${k}» tiene que ser una lista.`;
  const hasta = (x.meta as { hasta?: unknown }).hasta;
  if (hasta !== undefined && hasta !== null && !/^\d{4}-\d{2}$/.test(String(hasta))) return '«meta.hasta» tiene que ser AAAA-MM.';
  return null;
}

async function fetchSnapshot(c: SourceConfig, signal: AbortSignal): Promise<unknown> {
  if (c.tipo === 'supabase') {
    if (!c.url || !c.anonKey) throw new Error('Falta la dirección del proyecto o la clave pública.');
    const r = await fetch(`${c.url.replace(/\/$/, '')}/rest/v1/rpc/${c.rpc || 'tablero_snapshot'}`, { method: 'POST', signal, headers: { apikey: c.anonKey, Authorization: `Bearer ${c.anonKey}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) throw new Error(`Supabase respondió ${r.status}${r.status === 404 ? ' (¿está creada la función tablero_snapshot?)' : r.status === 401 || r.status === 403 ? ' (clave o permisos)' : ''}`);
    return r.json();
  }
  if (!c.url) throw new Error('Falta la dirección del archivo de datos.');
  const r = await fetch(c.url, { signal, cache: 'no-store' });
  if (!r.ok) throw new Error(`La fuente respondió ${r.status}`);
  return r.json();
}

/** Baja el snapshot (si hay fuente configurada). Nunca lanza: ante cualquier problema el tablero sigue con el último snapshot guardado o con la demo. */
export async function loadSource(cfg: SourceConfig = readConfig(), opts: { timeoutMs?: number; apply?: boolean } = {}): Promise<{ state: SourceState; snap: Snapshot | null }> {
  const state: SourceState = { config: cfg, modo: 'demo', avisos: [] };
  let snap: Snapshot | null = null;
  if (cfg.tipo !== 'demo') {
    const t0 = Date.now(); const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 9000);
    try {
      const raw = await fetchSnapshot(cfg, ctl.signal);
      const bad = validate(raw); if (bad) throw new Error(bad);
      snap = raw as Snapshot; state.modo = 'real'; state.cargado = new Date().toISOString(); state.ms = Date.now() - t0;
      if (opts.apply !== false) ls.set(LS_SNAP, JSON.stringify({ t: state.cargado, snap }));
    } catch (e) {
      state.error = (e as Error).name === 'AbortError' ? 'La fuente no respondió a tiempo.' : (e as Error).message || 'No se pudo leer la fuente.';
      if (opts.apply !== false) try { const c = JSON.parse(ls.get(LS_SNAP) ?? 'null') as { t: string; snap: Snapshot } | null; if (c?.snap && !validate(c.snap)) { snap = c.snap; state.modo = 'cache'; state.cargado = c.t; } } catch { /* sin copia */ }
    } finally { clearTimeout(timer); }
  }
  if (opts.apply !== false) { SNAP = snap; Object.assign(SOURCE, state); SOURCE.error = state.error; SOURCE.cargado = state.cargado; SOURCE.ms = state.ms; }
  return { state, snap };
}

// ---------- cobertura: qué números son reales ----------
const real = new Set<string>();
/** Marca un dato (campo · base · mes de la ventana) como real. */
export const markReal = (campo: string, base: string, m: number) => { real.add(`${campo}|${base}|${m}`); };
export const isRealCell = (campo: string, base: string, m: number) => real.has(`${campo}|${base}|${m}`);
export const realCount = () => real.size;
export const warn = (msg: string) => { if (!SOURCE.avisos.includes(msg) && SOURCE.avisos.length < 40) SOURCE.avisos.push(msg); };
