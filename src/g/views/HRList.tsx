import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Search, X } from 'lucide-react';
import { MONTH_FULL, UNIT_COLOR, UNIT_NAMES, UnitFilter, UnitName } from '../data';
import { AREAS, AREA_COLOR, Area, Emp, hrLists } from '../rrhh';
import { fmt, pct } from '../ui';
import { useTopEscape } from '../esc';
import type { MetricKey } from '../metrics';

export type HRKind = 'activos' | 'altas' | 'bajas' | 'aus' | 'art' | 'carp';
const META: Record<HRKind, { title: string; metric: MetricKey; color: string; empty: string }> = {
  activos: { title: 'Activos totales', metric: 'activos', color: '#2563eb', empty: 'Sin legajos para los filtros.' },
  altas: { title: 'Altas del mes', metric: 'altas', color: '#22c55e', empty: 'No hubo altas en el mes.' },
  bajas: { title: 'Bajas del mes', metric: 'bajas', color: '#ef4444', empty: 'No hubo bajas en el mes.' },
  aus: { title: 'Ausencias del mes', metric: 'ausDias', color: '#f97316', empty: 'Sin ausencias registradas.' },
  art: { title: 'Casos ART del mes', metric: 'artDias', color: '#8b5cf6', empty: 'Sin casos de ART en el mes.' },
  carp: { title: 'Carpetas médicas del mes', metric: 'carpDias', color: '#14b8a6', empty: 'Sin carpetas médicas en el mes.' },
};
interface Row { emp: Emp; cells: React.ReactNode[]; dias?: number; tag?: string; search: string }
const LIMIT = 200;

export function HRListDrawer({ kind, unit, m, area: area0 = null, onClose, onEmp, onMetric }: { kind: HRKind; unit: UnitFilter; m: number; area?: Area | null; onClose: () => void; onEmp: (e: Emp) => void; onMetric: (k: MetricKey) => void }) {
  const ref = useRef<HTMLDivElement>(null); useTopEscape(ref, onClose);
  const L = useMemo(() => hrLists(unit, m), [unit, m]);
  const [area, setArea] = useState<Area | null>(area0);
  const [base, setBase] = useState<UnitName | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const meta = META[kind];

  const { head, rows } = useMemo((): { head: string[]; rows: Row[] } => {
    const who = (e: Emp) => [<b key="l">{e.legajo}</b>, e.nombre];
    const s = (e: Emp, ...x: string[]) => `${e.legajo} ${e.nombre} ${e.area} ${e.unit} ${x.join(' ')}`.toLowerCase();
    switch (kind) {
      case 'activos': return { head: ['Legajo', 'Apellido y nombre', 'Base', 'Área', 'Puesto', 'Turno', 'Ingreso', 'Antigüedad'], rows: L.activos.map((e) => ({ emp: e, tag: e.convenio, search: s(e, e.puesto), cells: [...who(e), e.unit, e.area, e.puesto, e.turno, e.ingreso, e.antig] })) };
      case 'altas': return { head: ['Fecha', 'Legajo', 'Apellido y nombre', 'Base', 'Área', 'Puesto', 'Motivo'], rows: L.altas.map((x) => ({ emp: x.emp, tag: x.motivo, search: s(x.emp, x.motivo), cells: [x.fecha, ...who(x.emp), x.emp.unit, x.emp.area, x.emp.puesto, x.motivo] })) };
      case 'bajas': return { head: ['Fecha', 'Legajo', 'Apellido y nombre', 'Base', 'Área', 'Antigüedad', 'Motivo'], rows: L.bajas.map((x) => ({ emp: x.emp, tag: x.motivo, search: s(x.emp, x.motivo), cells: [x.fecha, ...who(x.emp), x.emp.unit, x.emp.area, x.emp.antig, x.motivo] })) };
      case 'aus': return { head: ['Fecha', 'Legajo', 'Apellido y nombre', 'Base', 'Área', 'Tipo', 'Días', 'Justificada'], rows: L.aus.map((x) => ({ emp: x.emp, dias: x.dias, tag: x.tipo, search: s(x.emp, x.tipo), cells: [x.fecha, ...who(x.emp), x.emp.unit, x.emp.area, x.tipo, <b key="d">{x.dias}</b>, x.justificada ? <span key="j" className="pill mini good">Sí</span> : <span key="j" className="pill mini bad">No</span>] })) };
      case 'art': return { head: ['Fecha', 'Legajo', 'Apellido y nombre', 'Base', 'Tipo', 'Lesión', 'Días', 'Estado', 'Siniestro ART'], rows: L.art.map((x) => ({ emp: x.emp, dias: x.dias, tag: x.estado, search: s(x.emp, x.lesion, x.tipo), cells: [x.fecha, ...who(x.emp), x.emp.unit, x.tipo, x.lesion, <b key="d">{x.dias}</b>, <span key="e" className={`pill mini ${x.estado === 'Alta médica' ? 'good' : 'warn'}`}>{x.estado}</span>, `${x.siniestro} · ${x.prestador}`] })) };
      default: return { head: ['Desde', 'Hasta', 'Legajo', 'Apellido y nombre', 'Base', 'Área', 'Diagnóstico', 'Días', 'Control'], rows: L.carp.map((x) => ({ emp: x.emp, dias: x.dias, tag: x.diagnostico, search: s(x.emp, x.diagnostico), cells: [x.desde, x.hasta, ...who(x.emp), x.emp.unit, x.emp.area, x.diagnostico, <b key="d">{x.dias}</b>, <span key="v" className={`pill mini ${x.validacion.startsWith('Validada') ? 'good' : 'warn'}`}>{x.validacion.startsWith('Validada') ? 'Validada' : 'Pendiente'}</span>] })) };
    }
  }, [kind, L]);

  const scoped = rows.filter((r) => (!base || r.emp.unit === base));
  const filtered = scoped.filter((r) => (!area || r.emp.area === area) && (!tag || r.tag === tag) && (!q || r.search.includes(q.toLowerCase())));
  const totalDias = filtered.reduce((s, r) => s + (r.dias ?? 0), 0);
  const tags = [...new Set(rows.map((r) => r.tag).filter(Boolean) as string[])];
  const countBy = <T,>(xs: Row[], f: (r: Row) => T) => xs.reduce((m2, r) => m2.set(f(r), (m2.get(f(r)) ?? 0) + 1), new Map<T, number>());
  const byArea = countBy(scoped.filter((r) => !tag || r.tag === tag), (r) => r.emp.area);
  const byTag = countBy(scoped.filter((r) => !area || r.emp.area === area), (r) => r.tag);
  const people = kind === 'aus' ? [...filtered.reduce((mm, r) => mm.set(r.emp.legajo, { e: r.emp, d: (mm.get(r.emp.legajo)?.d ?? 0) + (r.dias ?? 0), n: (mm.get(r.emp.legajo)?.n ?? 0) + 1 }), new Map<number, { e: Emp; d: number; n: number }>()).values()].sort((a, b) => b.d - a.d).slice(0, 5) : [];

  const stats: [string, string][] = kind === 'activos' ? [['Legajos', fmt(filtered.length)], ['Conducción', fmt(filtered.filter((r) => r.emp.area === 'Conducción').length)], ['Convenio UTA', pct((filtered.filter((r) => r.emp.convenio === 'UTA').length / Math.max(1, filtered.length)) * 100, 0)]]
    : kind === 'altas' || kind === 'bajas' ? [[kind === 'altas' ? 'Ingresos' : 'Egresos', fmt(filtered.length)], ['Conducción', fmt(filtered.filter((r) => r.emp.area === 'Conducción').length)], ['Motivo principal', [...byTag.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '–']]
      : kind === 'aus' ? [['Días', fmt(totalDias)], ['Eventos', fmt(filtered.length)], ['Injustificadas', pct((filtered.filter((r) => r.tag === 'Injustificada').length / Math.max(1, filtered.length)) * 100, 0)]]
        : kind === 'art' ? [['Casos', fmt(filtered.length)], ['Días perdidos', fmt(totalDias)], ['En tratamiento', fmt(filtered.filter((r) => r.tag === 'En tratamiento').length)]]
          : [['Carpetas', fmt(filtered.length)], ['Días', fmt(totalDias)], ['Promedio', `${fmt(totalDias / Math.max(1, filtered.length), 1)} días`]];

  return <motion.div ref={ref} data-modal="" className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
    <motion.aside className="detail-drawer hr-drawer" style={{ ['--tone' as string]: meta.color }} initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 28 }} onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header"><div><span className="section-kicker">RR.HH. · {MONTH_FULL[m]} · {unit === 'Todos' ? 'todas las bases' : unit}</span><h2>{meta.title}</h2><small>{fmt(filtered.length)} {kind === 'activos' ? 'legajos' : 'registros'}{totalDias ? ` · ${fmt(totalDias)} días` : ''} · tocá una fila para abrir el legajo</small></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      <div className="hr-stats">{stats.map(([l, v]) => <div key={l}><span>{l}</span><b>{v}</b></div>)}</div>
      {unit === 'Todos' && <div className="hr-chips"><span>Base</span><button className={!base ? 'on' : ''} onClick={() => setBase(null)}>Todas</button>{UNIT_NAMES.map((u) => <button key={u} className={base === u ? 'on' : ''} onClick={() => setBase(base === u ? null : u)}><i style={{ background: UNIT_COLOR[u] }} />{u} <em>{rows.filter((r) => r.emp.unit === u).length}</em></button>)}</div>}
      <div className="hr-chips"><span>Área</span><button className={!area ? 'on' : ''} onClick={() => setArea(null)}>Todas</button>{AREAS.map((a) => <button key={a} className={area === a ? 'on' : ''} onClick={() => setArea(area === a ? null : a)}><i style={{ background: AREA_COLOR[a] }} />{a} <em>{byArea.get(a) ?? 0}</em></button>)}</div>
      {kind !== 'activos' && tags.length > 1 && <div className="hr-chips"><span>{kind === 'aus' ? 'Tipo' : kind === 'art' ? 'Estado' : kind === 'carp' ? 'Diagnóstico' : 'Motivo'}</span><button className={!tag ? 'on' : ''} onClick={() => setTag(null)}>Todos</button>{tags.map((t) => <button key={t} className={tag === t ? 'on' : ''} onClick={() => setTag(tag === t ? null : t)}>{t} <em>{byTag.get(t) ?? 0}</em></button>)}</div>}
      {people.length > 0 && <div className="hr-top"><span className="section-kicker">Más días de ausencia</span>{people.map((p) => <button key={p.e.legajo} onClick={() => onEmp(p.e)}><b>{p.e.legajo}</b> {p.e.nombre}<em>{p.d} días · {p.n} {p.n === 1 ? 'evento' : 'eventos'}</em></button>)}</div>}
      <div className="hr-search"><Search size={14} /><input placeholder="Buscar por legajo, apellido, puesto, motivo…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="g-table-wrap hr-table"><table className="g-table clickable"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{filtered.slice(0, LIMIT).map((r, i) => <tr key={i} onClick={() => onEmp(r.emp)}>{r.cells.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
          {!filtered.length && <tr><td colSpan={head.length} className="empty-cell">{meta.empty}</td></tr>}</tbody></table></div>
      {filtered.length > LIMIT && <p className="md-desc">Mostrando {LIMIT} de {fmt(filtered.length)}: usá el buscador o los filtros para acotar.</p>}
      <button className="drawer-cta" onClick={() => onMetric(meta.metric)}>Ver evolución de 12 meses <ArrowRight size={16} /></button>
    </motion.aside>
  </motion.div>;
}
