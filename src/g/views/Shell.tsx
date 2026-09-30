import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BusFront, Building2, ChevronRight, ClipboardList, CornerDownLeft, Keyboard, LayoutDashboard, MousePointerClick, Moon, RotateCcw, Search, Sun, UserRound, Wrench, X } from 'lucide-react';
import { orders as ALL_ORDERS, mechanicsByBase, units as ALL_UNITS } from '../../data/fleet';
import { MONTH_LABELS, UNIT_COLOR, UNIT_NAMES, UnitFilter, UnitName } from '../data';
import { DRIVERS } from '../siniestros';
import { METRICS, MetricKey, Target } from '../metrics';
import { useDrill } from '../drill';
import { useTopEscape } from '../esc';
import { useOpenUnit } from '../openUnit';

// ---------- búsqueda global ----------
type Hit = { kind: 'Coche' | 'OT' | 'Mecánico' | 'Conductor' | 'Base' | 'Módulo'; title: string; sub: string; run: () => void };
const MODULES: { t: Target; label: string; words: string }[] = [
  { t: 'Resumen', label: 'Resumen · Tablero de control integral', words: 'resumen gerencia panel kpi indicadores' },
  { t: 'Tráfico', label: 'Tráfico · Flota en vivo', words: 'trafico micronauta vivo lineas' },
  { t: 'Flota', label: 'Flota · Estado de los coches', words: 'flota coches internos' },
  { t: 'Taller', label: 'Taller & Mantenimiento', words: 'taller mantenimiento preventivo correctivo ot stock pañol repuestos' },
  { t: 'RRHH', label: 'RR.HH.', words: 'rrhh personal ausentismo legajo' },
  { t: 'Combustible', label: 'Combustible', words: 'combustible gasoil litros rendimiento' },
  { t: 'Seguridad', label: 'Siniestros y Seguridad', words: 'siniestros seguridad incidentes reclamos' },
];
export function GlobalSearch({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  const drill = useDrill(); const openUnit = useOpenUnit();
  const [open, setOpen] = useState(false); const [sel, setSel] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase(); if (q.length < 2) return [];
    const out: Hit[] = [];
    ALL_UNITS.filter((u) => `${u.interno} ${u.plate} línea ${u.line} ${u.body}`.toLowerCase().includes(q)).slice(0, 5).forEach((u) => out.push({ kind: 'Coche', title: `Interno ${u.interno} · ${u.plate}`, sub: `${u.base} · línea ${u.line} · ${u.status}`, run: () => openUnit(u.interno) }));
    ALL_ORDERS.filter((o) => o.id.toLowerCase().includes(q) || o.title.toLowerCase().includes(q)).slice(0, 4).forEach((o) => out.push({ kind: 'OT', title: `${o.id} · ${o.title}`, sub: `Interno ${o.unit} · ${o.base} · ${o.status}`, run: () => openUnit(o.unit, { order: o.id }) }));
    UNIT_NAMES.forEach((b) => mechanicsByBase[b].filter((m) => m.toLowerCase().includes(q)).forEach((m) => out.push({ kind: 'Mecánico', title: m, sub: `Taller ${b} · productividad`, run: () => drill.go('Taller', { tab: 'Productividad', unit: b }) })));
    UNIT_NAMES.forEach((b) => DRIVERS[b].filter((d) => d.name.toLowerCase().includes(q)).slice(0, 3).forEach((d) => out.push({ kind: 'Conductor', title: d.name, sub: `${b} · legajo ${d.legajo} · siniestros`, run: () => drill.go('Seguridad', { tab: 'Histórico de conductores', unit: b }) })));
    UNIT_NAMES.filter((b) => b.toLowerCase().includes(q)).forEach((b) => out.push({ kind: 'Base', title: b, sub: 'Ficha de la unidad de negocio', run: () => drill.openBase(b) }));
    MODULES.filter((m) => m.words.includes(q) || m.label.toLowerCase().includes(q)).forEach((m) => out.push({ kind: 'Módulo', title: m.label, sub: 'Ir al módulo', run: () => drill.go(m.t) }));
    return out.slice(0, 12);
  }, [query, drill, openUnit]);
  const pick = (h: Hit) => { h.run(); setOpen(false); setQuery(''); ref.current?.blur(); };
  const ICON = { Coche: BusFront, OT: ClipboardList, Mecánico: Wrench, Conductor: UserRound, Base: Building2, Módulo: LayoutDashboard };
  return <div className="search gsearch"><Search size={16} />
    <input ref={ref} placeholder="Buscar interno, dominio, OT, mecánico, chofer…  ( / )" value={query} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 180)}
      onChange={(e) => { setQuery(e.target.value); setSel(0); setOpen(true); }}
      onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } else if (e.key === 'Enter' && hits[sel]) pick(hits[sel]); else if (e.key === 'Escape') { setOpen(false); ref.current?.blur(); } }} />
    {query && <button className="gsearch-clear" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery('')} aria-label="Limpiar"><X size={13} /></button>}
    {open && query.trim().length >= 2 && <div className="gsearch-pop">{hits.length ? hits.map((h, i) => { const I = ICON[h.kind]; return <button key={h.kind + h.title + i} className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}><I size={15} /><div><strong>{h.title}</strong><small>{h.kind} · {h.sub}</small></div>{i === sel && <CornerDownLeft size={13} />}</button>; }) : <p>Sin resultados para “{query}”.</p>}</div>}
  </div>;
}

// ---------- selector de unidad (Grupo Solbus) ----------
export function WorkspaceMenu({ unit, setUnit, onClose }: { unit: UnitFilter; setUnit: (u: UnitFilter) => void; onClose: () => void }) {
  const drill = useDrill();
  return <div className="ws-pop" onMouseLeave={onClose}>
    <button className={unit === 'Todos' ? 'on' : ''} onClick={() => { setUnit('Todos'); onClose(); }}><i style={{ background: '#ff6b1a' }} /><span>Grupo Solbus · todas</span></button>
    {UNIT_NAMES.map((u) => <div key={u} className="ws-row"><button className={unit === u ? 'on' : ''} onClick={() => { setUnit(u); onClose(); }}><i style={{ background: UNIT_COLOR[u] }} /><span>{u}</span></button><button className="ws-info" title={`Ficha de ${u}`} onClick={() => { onClose(); drill.openBase(u); }}><ChevronRight size={14} /></button></div>)}
  </div>;
}

// ---------- modales ----------
function Modal({ title, kicker, onClose, children, wide }: { title: string; kicker: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null); useTopEscape(ref, onClose);
  return <motion.div ref={ref} data-modal="" className="modal-backdrop bus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
    <motion.div className={`sn-modal ${wide ? 'wide' : ''}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <header className="sn-modal-head"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>
      {children}
    </motion.div></motion.div>;
}

export function SettingsModal({ theme, toggleTheme, unit, setUnit, onClose, notify }: { theme: 'dark' | 'light'; toggleTheme: () => void; unit: UnitFilter; setUnit: (u: UnitFilter) => void; onClose: () => void; notify: (m: string) => void }) {
  const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const [def, setDef] = useState(read('solbus-unit', 'Todos'));
  const [live, setLive] = useState(read('micronauta-live-url', 'http://localhost:8765'));
  return <Modal kicker="Preferencias de este navegador" title="Configuración" onClose={onClose}>
    <div className="cfg-list">
      <div className="cfg-row"><div><b>Tema</b><small>Modo claro u oscuro.</small></div><button className="cfg-btn" onClick={toggleTheme}>{theme === 'dark' ? <><Sun size={15} /> Pasar a claro</> : <><Moon size={15} /> Pasar a oscuro</>}</button></div>
      <div className="cfg-row"><div><b>Unidad de negocio al abrir</b><small>Con qué unidad arranca el tablero.</small></div><select value={def} onChange={(e) => setDef(e.target.value)}>{['Todos', ...UNIT_NAMES].map((u) => <option key={u}>{u}</option>)}</select></div>
      <div className="cfg-row"><div><b>Servicio Micronauta en vivo</b><small>Dirección de <code>micronauta-live</code> (Tráfico).</small></div><input value={live} onChange={(e) => setLive(e.target.value)} /></div>
      <div className="cfg-row"><div><b>Unidad actual</b><small>Filtra todo el tablero ahora.</small></div><select value={unit} onChange={(e) => setUnit(e.target.value as UnitFilter)}>{['Todos', ...UNIT_NAMES].map((u) => <option key={u}>{u}</option>)}</select></div>
    </div>
    <div className="sn-actions cfg-actions">
      <button className="text-button" onClick={() => { try { ['solbus-unit', 'micronauta-live-url', 'solbus-theme'].forEach((k) => localStorage.removeItem(k)); } catch { /* */ } notify('Preferencias restablecidas'); onClose(); }}><RotateCcw size={14} /> Restablecer</button>
      <button className="export-button" onClick={() => { write('solbus-unit', def); write('micronauta-live-url', live.trim().replace(/\/$/, '')); notify('Configuración guardada'); onClose(); }}>Guardar</button>
    </div>
  </Modal>;
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return <Modal kicker="Centro de soporte" title="Cómo usar el tablero" onClose={onClose}>
    <ul className="help-list">
      <li><MousePointerClick size={16} /><div><b>Todo se toca</b><small>Cada indicador abre su detalle de 12 meses y por base; cada coche, OT o reparación abre la ficha técnica con la imagen del bus.</small></div></li>
      <li><Building2 size={16} /><div><b>Unidad de negocio</b><small>El selector de arriba (o “Grupo Solbus” en el menú) filtra todas las pantallas. Las tarjetas de cada base abren su ficha con accesos directos.</small></div></li>
      <li><Search size={16} /><div><b>Búsqueda</b><small>Interno, dominio, número de OT, mecánico, conductor, base o módulo. Enter abre el primer resultado.</small></div></li>
      <li><Keyboard size={16} /><div><b>Atajos</b><small><kbd>/</kbd> buscar · <kbd>Esc</kbd> cerrar ventanas · flechas para moverse en la búsqueda.</small></div></li>
      <li><ClipboardList size={16} /><div><b>Exportar</b><small>El botón Exportar descarga en Excel (CSV) los indicadores y tablas de la pantalla actual.</small></div></li>
    </ul>
    <p className="md-desc">Datos demostrativos · se reemplazan por los sistemas de Solbus (Emenuve, Flitmo, Micronauta, SUBE) al conectarlos.</p>
  </Modal>;
}

const CMP: MetricKey[] = ['cumpl', 'reg', 'disp', 'aux', 'aus', 'cob', 'sin', 'exc', 'cost', 'inc', 'ipk', 'otOpen', 'prevPend', 'kmpl', 'costoMantKm'];
export function Comparativa({ onClose }: { onClose: () => void }) {
  const drill = useDrill(); const m = 11;
  const vals = useMemo(() => CMP.map((k) => ({ k, row: UNIT_NAMES.map((u) => METRICS[k].get(u, m)), all: METRICS[k].get('Todos', m) })), []);
  return <Modal kicker={`Comparativa entre bases · ${MONTH_LABELS[m]} 2026`} title="Las 4 unidades de negocio" onClose={onClose} wide>
    <div className="g-table-wrap"><table className="g-table clickable cmp-table"><thead><tr><th>Indicador</th>{UNIT_NAMES.map((u) => <th key={u}><button className="cmp-base" onClick={() => { onClose(); drill.openBase(u); }}><i style={{ background: UNIT_COLOR[u] }} />{u}</button></th>)}<th>Grupo</th></tr></thead>
      <tbody>{vals.map(({ k, row, all }) => { const d = METRICS[k]; const best = d.goodUp ? Math.max(...row) : Math.min(...row); const worst = d.goodUp ? Math.min(...row) : Math.max(...row);
        return <tr key={k}><td><b>{d.label}</b></td>{row.map((v, i) => <td key={i} className={v === best ? 'ok' : v === worst ? 'low' : ''} onClick={() => { onClose(); drill.openMetric(k, { unit: UNIT_NAMES[i] as UnitName }); }}>{d.fmt(v)}</td>)}<td onClick={() => { onClose(); drill.openMetric(k, { unit: 'Todos' }); }}>{d.fmt(all)}</td></tr>; })}</tbody></table></div>
    <p className="md-desc">Verde: mejor base del indicador · rojo: la que más necesita atención. Tocá un valor para ver su detalle o el nombre de la base para abrir su ficha.</p>
  </Modal>;
}
