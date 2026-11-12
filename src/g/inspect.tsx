/* Capa de interacción general del tablero:
   · Explorador: cualquier panel (gráfico o tabla) se amplía, muestra sus datos en una tabla que se ordena y se filtra, y se descarga.
   · Inspector: todo dato que no tiene una acción propia (una fila, una tarjeta, un ítem de leyenda) abre una ficha con sus
     valores y accesos directos (coche, OT, base, indicador, asistente).
   Así no queda ningún número «muerto» en pantalla. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownAZ, ArrowUpAZ, ArrowUpRight, Copy, Download, Maximize2, Search, Sparkles, X } from 'lucide-react';
import { unitById, orders as ALL_ORDERS } from '../data/fleet';
import { UNIT_NAMES, type UnitName } from './data';
import { METRICS } from './metrics';
import { useDrill } from './drill';
import { useOpenUnit } from './openUnit';
import { useTopEscape } from './esc';
import { askAssistant } from './asistente/Asistente';
import { findMetric, norm } from './asistente/engine';

// ---------- explorador ----------
export type Row = Record<string, string | number | null | undefined>;
export interface Explore { title: string; kicker?: string; columns: { key: string; label: string }[]; rows: Row[]; chart?: React.ReactNode }
export const explore = (e: Explore) => window.dispatchEvent(new CustomEvent('solbus-explore', { detail: e }));

const isEl = (n: unknown): n is React.ReactElement<Record<string, unknown>> => React.isValidElement(n);
const prim = (v: unknown): v is string | number => typeof v === 'string' || typeof v === 'number';
const SKIP = /^(color|fill|stroke|i|id|key|hi)$/;
/** Busca en los hijos de un panel el primer gráfico (elemento con «data») y arma sus columnas con los nombres de las series. */
export function chartData(node: React.ReactNode): Pick<Explore, 'columns' | 'rows'> | null {
  let found: { data: Record<string, unknown>[]; el: React.ReactElement<Record<string, unknown>> } | null = null;
  const walk = (n: React.ReactNode, depth: number) => {
    if (found || depth > 8) return;
    React.Children.forEach(n, (c) => {
      if (found || !isEl(c)) return;
      const d = c.props.data;
      if (Array.isArray(d) && d.length && typeof d[0] === 'object' && d[0] !== null) { found = { data: d as Record<string, unknown>[], el: c }; return; }
      walk(c.props.children as React.ReactNode, depth + 1);
    });
  };
  walk(node, 0);
  if (!found) return null;
  const { data, el } = found as { data: Record<string, unknown>[]; el: React.ReactElement<Record<string, unknown>> };
  const names = new Map<string, string>(); let xKey: string | null = null;
  React.Children.forEach(el.props.children as React.ReactNode, (c) => {
    if (!isEl(c)) return; const dk = c.props.dataKey; if (typeof dk !== 'string') return;
    const tn = (c.type as { displayName?: string; name?: string }).displayName ?? (c.type as { name?: string }).name ?? '';
    if (/XAxis/.test(tn)) xKey = dk; else if (!/YAxis/.test(tn)) names.set(dk, typeof c.props.name === 'string' ? c.props.name : dk);
  });
  const present = [...new Set(data.flatMap((r) => Object.keys(r)))].filter((k) => !SKIP.test(k) && data.some((r) => prim(r[k])));
  // si el gráfico declara sus series, se muestran solo esas (más el eje); si no, todas las columnas del dato
  const declared = present.filter((k) => names.has(k) || k === xKey);
  const keys = names.size && declared.length > 1 ? [...present.filter((k) => k === xKey || (!names.has(k) && data.some((r) => typeof r[k] === 'string'))).slice(0, 1), ...present.filter((k) => names.has(k))].filter((k, i, a) => a.indexOf(k) === i) : present;
  if (!keys.length) return null;
  const first = xKey && keys.includes(xKey) ? xKey : keys.find((k) => data.some((r) => typeof r[k] === 'string')) ?? keys[0];
  const ordered = [first, ...keys.filter((k) => k !== first)];
  const LABEL: Record<string, string> = { m: 'Mes', h: 'Hora', name: 'Concepto', value: 'Valor', v: 'Valor', label: 'Concepto', fecha: 'Fecha', u: 'Base' };
  return { columns: ordered.map((k) => ({ key: k, label: names.get(k) ?? LABEL[k] ?? k.charAt(0).toUpperCase() + k.slice(1) })), rows: data.map((r) => Object.fromEntries(ordered.map((k) => [k, prim(r[k]) ? r[k] : null])) as Row) };
}
/** Lee una tabla HTML ya dibujada (encabezados y celdas) para explorarla. */
export function tableData(table: HTMLTableElement): Pick<Explore, 'columns' | 'rows'> | null {
  const heads = headersOf(table); const trs = [...table.querySelectorAll('tbody tr')] as HTMLTableRowElement[];
  if (!trs.length) return null;
  const n = Math.max(heads.length, ...trs.map((tr) => tr.cells.length));
  const columns = Array.from({ length: n }, (_, i) => ({ key: `c${i}`, label: heads[i] || `Columna ${i + 1}` }));
  const rows = trs.filter((tr) => tr.cells.length > 1).map((tr) => Object.fromEntries([...tr.cells].map((td, i) => [`c${i}`, clean(td.textContent)])) as Row);
  return rows.length ? { columns, rows } : null;
}
const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
/** Encabezados de una tabla, resolviendo los agrupados (colSpan / rowSpan) como «Grupo · Columna». */
function headersOf(table: HTMLTableElement): string[] {
  const rows = [...(table.tHead?.rows ?? [])]; if (!rows.length) return [];
  const grid: string[][] = [];
  rows.forEach((tr, r) => { let c = 0; [...tr.cells].forEach((th) => { while (grid[r]?.[c] !== undefined) c++; for (let dr = 0; dr < th.rowSpan; dr++) for (let dc = 0; dc < th.colSpan; dc++) { (grid[r + dr] ??= [])[c + dc] = clean(th.textContent); } c += th.colSpan; }); });
  const n = Math.max(...grid.map((g) => g.length));
  return Array.from({ length: n }, (_, c) => { const parts = grid.map((g) => g[c]).filter((x, i, a) => x && a.indexOf(x) === i); return parts.join(' · '); });
}
const toNum = (v: unknown) => { if (typeof v === 'number') return v; const s = String(v ?? '').replace(/[^\d,.\-−]/g, '').replace('−', '-'); if (!/\d/.test(s)) return NaN; return Number(s.replace(/\./g, '').replace(',', '.')); };
const show = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('es-AR', { maximumFractionDigits: 2 }) : v == null || v === '' ? '—' : String(v));
export function downloadCsv(name: string, columns: Explore['columns'], rows: Row[]) {
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const body = [columns.map((c) => esc(c.label)).join(';'), ...rows.map((r) => columns.map((c) => esc(typeof r[c.key] === 'number' ? String(r[c.key]).replace('.', ',') : r[c.key])).join(';'))].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
  a.download = `solbus_${norm(name).replace(/[^a-z0-9]+/g, '-').slice(0, 50) || 'datos'}.csv`; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function Explorer({ e, onClose }: { e: Explore; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null); useTopEscape(ref, onClose);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const nq = norm(q); let r = nq ? e.rows.filter((row) => norm(Object.values(row).join(' ')).includes(nq)) : e.rows;
    if (sort) { const numeric = r.every((x) => x[sort.key] == null || x[sort.key] === '' || !isNaN(toNum(x[sort.key]))); r = [...r].sort((a, b) => (numeric ? (toNum(a[sort.key]) || 0) - (toNum(b[sort.key]) || 0) : String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), 'es')) * sort.dir); }
    return r;
  }, [e.rows, q, sort]);
  const totals = useMemo(() => e.columns.map((c, i) => { if (i === 0) return null; const vs = rows.map((r) => r[c.key]).filter((v): v is number => typeof v === 'number'); return vs.length === rows.length && vs.length > 1 ? vs.reduce((a, b) => a + b, 0) / vs.length : null; }), [e.columns, rows]);
  const mk = findMetric(norm(e.title));
  return <motion.div ref={ref} data-modal="" className="modal-backdrop bus-backdrop px-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="sn-modal wide px-modal" role="dialog" aria-modal="true" aria-label={e.title} initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(ev) => ev.stopPropagation()}>
      <header className="sn-modal-head"><div><span className="section-kicker">{e.kicker ?? 'Explorar'}</span><h2>{e.title}</h2></div>
        {mk && <button className="cfg-btn" onClick={() => { onClose(); askAssistant(`Evolución de ${METRICS[mk].label.toLowerCase()}`); }}><Sparkles size={14} /> Preguntar al asistente</button>}
        <button className="cfg-btn" onClick={() => downloadCsv(e.title, e.columns, rows)}><Download size={14} /> Descargar</button>
        <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>
      {e.chart && <div className="px-chart">{e.chart}</div>}
      <div className="px-tools"><label className="px-search"><Search size={14} /><input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Filtrar filas…" aria-label="Filtrar filas" /></label><span>{rows.length === e.rows.length ? `${rows.length} filas` : `${rows.length} de ${e.rows.length} filas`} · tocá un encabezado para ordenar</span></div>
      <div className="g-table-wrap px-table-wrap"><table className="g-table px-table"><thead><tr>{e.columns.map((c) => <th key={c.key} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}><button onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 }))}>{c.label}{sort?.key === c.key && (sort.dir === 1 ? <ArrowUpAZ size={12} /> : <ArrowDownAZ size={12} />)}</button></th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{e.columns.map((c) => <td key={c.key}>{show(r[c.key])}</td>)}</tr>)}{!rows.length && <tr><td colSpan={e.columns.length} className="muted-cell">Ninguna fila coincide con el filtro.</td></tr>}</tbody>
        {totals.some((t) => t !== null) && <tfoot><tr>{e.columns.map((c, i) => <td key={c.key}>{i === 0 ? 'Promedio' : totals[i] === null ? '' : show(totals[i])}</td>)}</tr></tfoot>}</table></div>
    </motion.div></motion.div>;
}

// ---------- inspector ----------
interface Field { label: string; value: string }
interface Link { label: string; run: () => void }
interface Inspect { x: number; y: number; title: string; kicker: string; fields: Field[]; raw: string; links: { kind: 'unit' | 'ot' | 'base' | 'metric' | 'ask' | 'panel'; label: string; arg: string }[] }
const BOUNDARY = 'main, .detail-drawer, .sn-modal, .unit-sheet, .as-panel, .sheet, [data-modal]';
const NATIVE = 'button, a, input, select, textarea, label, summary, [role="button"], [role="tab"], [contenteditable]';
const CANDIDATE = 'tbody tr, .t-tile, .t-legend li, .t-hbars li, .recharts-legend-item, .detail-list > div, .md-stats > div, .rh-acc li, .g-kpi, .rh-two > div, .rh-profile-data > div, .bd-kpi, .as-table tbody tr';
const reactProps = (el: Element): Record<string, unknown> | null => { const k = Object.keys(el).find((x) => x.startsWith('__reactProps$')); return k ? ((el as unknown as Record<string, unknown>)[k] as Record<string, unknown>) : null; };
/** ¿El elemento (o un ancestro dentro de su contenedor) ya tiene una acción propia? */
function hasOwnAction(target: Element, boundary: Element | null): boolean {
  for (let e: Element | null = target; e && e !== boundary && e !== document.body; e = e.parentElement) {
    if (e.matches(NATIVE)) return true;
    const p = reactProps(e); if (p && (p.onClick || p.onMouseDown || p.onPointerDown || p.onDoubleClick)) return true;
    if (e.classList.contains('recharts-wrapper') && e.querySelector('[cursor="pointer"]')) return true;
  }
  return false;
}
const titleOf = (el: Element) => clean(el.closest('.panel, .g-panel, section, .sn-modal, .detail-drawer, .as-a')?.querySelector('h3, h2, h4')?.textContent) || 'Detalle';

function buildInspect(el: Element, x: number, y: number): Inspect | null {
  const fields: Field[] = []; let title = ''; const kicker = titleOf(el);
  if (el instanceof HTMLTableRowElement) {
    const table = el.closest('table') as HTMLTableElement; const heads = headersOf(table);
    [...el.cells].forEach((td, i) => { const v = clean(td.textContent); if (v) fields.push({ label: heads[i] || `Columna ${i + 1}`, value: v }); });
    title = fields[0]?.value ?? 'Fila';
  } else if (el.matches('.t-tile, .g-kpi, .bd-kpi')) {
    const label = clean(el.querySelector('.t-tile-label, .g-kpi-label, span')?.textContent); const value = clean(el.querySelector('.t-tile-value strong, .g-kpi-value strong, strong')?.textContent);
    title = label || 'Indicador'; if (value) fields.push({ label: 'Valor', value });
    const sub = clean(el.querySelector('.t-tile-value small, small')?.textContent); if (sub && sub !== value) fields.push({ label: 'Detalle', value: sub });
    const d = clean(el.querySelector('.delta')?.textContent); if (d) fields.push({ label: 'Variación', value: d });
  } else {
    const kids = [...el.children].map((c) => clean(c.textContent)).filter(Boolean);
    const own = clean([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '));
    const parts = own ? [own, ...kids] : kids;
    if (!parts.length) return null;
    title = parts[0]; parts.slice(1).forEach((p, i) => fields.push({ label: i === 0 ? 'Valor' : i === 1 && /%/.test(p) ? 'Participación' : `Dato ${i + 1}`, value: p }));
    if (!fields.length) return null;
  }
  if (!fields.length && !title) return null;
  const raw = [title, ...fields.map((f) => `${f.label}: ${f.value}`)].join('\n');
  // accesos directos: coche, OT, base, indicador
  const links: Inspect['links'] = []; const seen = new Set<string>();
  const add = (kind: Inspect['links'][number]['kind'], label: string, arg: string) => { const k = kind + arg; if (!seen.has(k) && links.length < 5) { seen.add(k); links.push({ kind, label, arg }); } };
  const all = [{ label: 'Título', value: title }, ...fields];
  for (const f of all) {
    const ot = /OT-\w?\d{3,6}/i.exec(f.value)?.[0]; if (ot && ALL_ORDERS.some((o) => o.id === ot.toUpperCase())) add('ot', `Abrir ${ot.toUpperCase()}`, ot.toUpperCase());
    const lab = norm(f.label); const num = /^\d{3,4}$/.exec(f.value)?.[0] ?? (/(interno|coche|unidad|bus)/.test(lab) ? /\b\d{3,4}\b/.exec(f.value)?.[0] : undefined) ?? /interno (\d{3,4})/i.exec(f.value)?.[1];
    if (num && unitById[num] && (/(interno|coche|unidad|bus|titulo)/.test(lab) || /interno/i.test(f.value))) add('unit', `Ficha del coche ${num}`, num);
    const base = UNIT_NAMES.find((b) => f.value === b || f.value.startsWith(`${b} `) || f.value.includes(` ${b}`)); if (base) add('base', `Ficha de ${base}`, base);
  }
  const mk = findMetric(norm(title)) ?? findMetric(norm(kicker)); if (mk) add('metric', `Indicador: ${METRICS[mk].label}`, mk);
  if (el.closest('[data-panel]')) add('panel', 'Ampliar el panel', '');
  add('ask', 'Preguntar al asistente', mk ? METRICS[mk].label : title);
  return { x, y, title, kicker, fields: fields.slice(0, 14), raw, links };
}

/** Monta el explorador y el inspector. Va una sola vez, al final de la aplicación. */
export function InteractionLayer({ notify }: { notify: (m: string) => void }) {
  const drill = useDrill(); const openUnit = useOpenUnit();
  const [ex, setEx] = useState<Explore | null>(null);
  const [ins, setIns] = useState<Inspect | null>(null);
  const insEl = useRef<Element | null>(null);
  useEffect(() => {
    const onExplore = (e: Event) => { setIns(null); setEx((e as CustomEvent<Explore>).detail); };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null; if (!t || e.button !== 0 || !(t instanceof Element)) return;
      if (t.closest('.ins-pop')) return;
      setIns(null);
      if (window.getSelection()?.toString()) return; // está seleccionando texto
      const boundary = t.closest(BOUNDARY); if (!boundary || t.closest('.px-modal')) return;
      if (hasOwnAction(t, boundary)) return;
      const chart = t.closest('.recharts-wrapper, .t-donut-chart');
      if (chart) { const p = chart.closest('[data-panel]'); if (p) p.dispatchEvent(new CustomEvent('solbus-expand')); return; }
      const el = t.closest(CANDIDATE); if (!el || !boundary.contains(el)) return;
      if (el.querySelector('.muted-cell') || el.closest('tfoot')) return;
      const info = buildInspect(el, e.clientX, e.clientY); if (info) { insEl.current = el; setIns(info); }
    };
    const close = () => setIns(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIns(null); };
    window.addEventListener('solbus-explore', onExplore); document.addEventListener('click', onClick, true);
    window.addEventListener('resize', close); window.addEventListener('keydown', onKey); document.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('solbus-explore', onExplore); document.removeEventListener('click', onClick, true); window.removeEventListener('resize', close); window.removeEventListener('keydown', onKey); document.removeEventListener('scroll', close, true); };
  }, []);
  const run = (l: Inspect['links'][number]) => {
    setIns(null);
    if (l.kind === 'unit') openUnit(l.arg);
    else if (l.kind === 'ot') { const o = ALL_ORDERS.find((x) => x.id === l.arg); if (o) openUnit(o.unit, { order: o.id }); }
    else if (l.kind === 'base') drill.openBase(l.arg as UnitName);
    else if (l.kind === 'metric') drill.openMetric(l.arg as keyof typeof METRICS);
    else if (l.kind === 'panel') insEl.current?.closest('[data-panel]')?.dispatchEvent(new CustomEvent('solbus-expand'));
    else askAssistant(l.arg);
  };
  const W = 320; const left = ins ? Math.min(Math.max(12, ins.x + 14), window.innerWidth - W - 12) : 0; const top = ins ? Math.min(Math.max(12, ins.y + 12), window.innerHeight - 340) : 0;
  return <>
    <AnimatePresence>{ins && <motion.div className="ins-pop" role="dialog" aria-label={`Detalle: ${ins.title}`} style={{ left, top, width: W }} initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.13 }}>
      <header><div><span className="section-kicker">{ins.kicker}</span><strong>{ins.title}</strong></div><button className="icon-button" onClick={() => setIns(null)} aria-label="Cerrar"><X size={15} /></button></header>
      {ins.fields.length > 0 && <dl>{ins.fields.map((f, i) => <div key={i}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
      <div className="ins-links">{ins.links.map((l, i) => <button key={i} className={l.kind === 'ask' ? 'ask' : ''} onClick={() => run(l)}>{l.kind === 'ask' ? <Sparkles size={13} /> : l.kind === 'panel' ? <Maximize2 size={13} /> : <ArrowUpRight size={13} />}{l.label}</button>)}
        <button onClick={() => { navigator.clipboard?.writeText(ins.raw).then(() => notify('Copiado al portapapeles'), () => notify('No se pudo copiar')); setIns(null); }}><Copy size={13} />Copiar</button></div>
    </motion.div>}</AnimatePresence>
    <AnimatePresence>{ex && <Explorer key={ex.title} e={ex} onClose={() => setEx(null)} />}</AnimatePresence>
  </>;
}

/** Botón «ampliar» de un panel + escucha del pedido de ampliación que hace el inspector al tocar un gráfico. */
export function usePanelExplore(ref: React.RefObject<HTMLDivElement>, title: React.ReactNode, kicker: string | undefined, children: React.ReactNode) {
  const kids = useRef(children); kids.current = children;
  const open = useRef(() => {});
  open.current = () => {
    const el = ref.current; const t = typeof title === 'string' ? title : clean(el?.querySelector('h3')?.textContent) || 'Panel';
    const cd = chartData(kids.current);
    if (cd) return explore({ title: t, kicker, ...cd, chart: kids.current });
    const tb = el?.querySelector('table'); const td = tb ? tableData(tb as HTMLTableElement) : null;
    if (td) explore({ title: t, kicker, ...td });
  };
  useEffect(() => { const el = ref.current; if (!el) return; const h = () => open.current(); el.addEventListener('solbus-expand', h); return () => el.removeEventListener('solbus-expand', h); }, [ref]);
  return () => open.current();
}
/** ¿Tiene el panel algo para explorar (un gráfico o una tabla)? */
export const explorable = (children: React.ReactNode) => { let ok = false; const walk = (n: React.ReactNode, d: number) => { if (ok || d > 8) return; React.Children.forEach(n, (c) => { if (ok || !isEl(c)) return; if (c.type === 'table' || (Array.isArray(c.props.data) && c.props.data.length)) { ok = true; return; } walk(c.props.children as React.ReactNode, d + 1); }); }; walk(children, 0); return ok; };
