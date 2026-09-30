import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowUpRight, ChevronRight, CircleDollarSign, Clock3, Hammer, PackageSearch, Timer, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BusDiagram } from '../components/BusDiagram';
import { statusClass } from '../components/UnitSheet';
import { componentById, components } from '../data/catalog';
import { bases, daysBetween, isOpen, now, orderCost, orders as allOrders, periodDays, SERVICE_KM, units } from '../data/fleet';
import { componentStats, summarizeMaterials } from '../data/stats';
import type { BusView, OTType, WorkOrder } from '../data/types';
import { ago, date, fmt, money, moneyShort } from '../lib/format';

export type OpenUnit = (interno: string, opts?: { order?: string; component?: string }) => void;

const typeGroups: { key: string; label: string; types: OTType[]; color: string }[] = [
  { key: 'plan', label: 'Preventivo y service', types: ['Preventivo 20K', 'Service 30K'], color: '#199e70' },
  { key: 'corr', label: 'Correctivo', types: ['Correctivo'], color: '#E85818' },
  { key: 'urg', label: 'Auxilio y siniestro', types: ['Auxilio en calle', 'Siniestro'], color: '#d55181' },
];
const tooltipStyle = { background: '#151a2b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, color: '#fff', fontSize: 12 };

export function Taller({ baseFilter, query, period, onOpenUnit }: { baseFilter: string; query: string; period: string; onOpenUnit: OpenUnit }) {
  const [view, setView] = useState<BusView>('corte');
  const [component, setComponent] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('Todas');
  const [limit, setLimit] = useState(12);
  const days = periodDays[period] ?? 30;

  const scoped = useMemo(() => allOrders.filter((o) => baseFilter === 'Todas las bases' || o.base === baseFilter), [baseFilter]);
  const inRange = useMemo(() => scoped.filter((o) => isOpen(o) || daysBetween(o.opened, now) <= days), [scoped, days]);
  const scopedUnits = units.filter((u) => baseFilter === 'Todas las bases' || u.base === baseFilter);
  const stats = useMemo(() => componentStats(inRange), [inRange]);
  const open = scoped.filter(isOpen);
  const q = query.trim().toLowerCase();
  const table = inRange.filter((o) => (!component || o.components.includes(component)) && (typeFilter === 'Todas' || typeGroups.find((g) => g.key === typeFilter)?.types.includes(o.type)) && (!q || `${o.id} ${o.unit} ${o.title} ${o.mechanic} ${o.base}`.toLowerCase().includes(q)));
  const cost = inRange.reduce((s, o) => s + orderCost(o), 0);
  const closed = inRange.filter((o) => o.closed);
  const mttr = closed.reduce((s, o) => s + daysBetween(o.opened, o.closed!), 0) / Math.max(1, closed.length);
  const overdue = scopedUnits.filter((u) => u.km - u.lastServiceKm >= SERVICE_KM);
  const ranking = components.map((c) => ({ c, ...(stats[c.id] ?? { count: 0, cost: 0, open: false }) })).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const maxRank = Math.max(1, ...ranking.map((r) => r.count));
  const materials = useMemo(() => summarizeMaterials(inRange, component).slice(0, 8), [inRange, component]);

  const monthly = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const inMonth = scoped.filter((o) => o.opened.getFullYear() === d.getFullYear() && o.opened.getMonth() === d.getMonth() && (!component || o.components.includes(component)));
    const row: Record<string, number | string> = { month: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '') };
    typeGroups.forEach((g) => { row[g.key] = inMonth.filter((o) => g.types.includes(o.type)).length; });
    return row;
  }), [scoped, component]);
  const byBase = bases.filter((b) => baseFilter === 'Todas las bases' || b.name === baseFilter).map((b) => ({ name: b.name, color: b.color, cost: inRange.filter((o) => o.base === b.name && (!component || o.components.includes(component))).reduce((s, o) => s + orderCost(o), 0), units: b.vehicles }));

  const board: { title: string; items: WorkOrder[] }[] = [
    { title: 'Ingresadas', items: open.filter((o) => o.status === 'Abierta') },
    { title: 'En reparación', items: open.filter((o) => o.status === 'En curso') },
    { title: 'Esperando repuesto', items: open.filter((o) => o.status === 'Esperando repuesto') },
  ];

  const kpis = [
    { label: 'OT abiertas', value: fmt(open.length), detail: `${open.filter((o) => o.priority === 'Alta').length} de prioridad alta`, icon: Hammer, tone: open.length > 20 ? 'warn' : 'good', action: () => document.getElementById('taller-board')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Esperando repuesto', value: fmt(board[2].items.length), detail: 'coches detenidos por pañol', icon: PackageSearch, tone: 'warn', action: () => document.getElementById('taller-board')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Materiales del período', value: moneyShort(cost), detail: `${fmt(inRange.length)} OT · ${period}`, icon: CircleDollarSign, tone: 'good', action: () => document.getElementById('taller-materials')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Tiempo medio en taller', value: `${fmt(mttr, 1)} días`, detail: `${fmt(closed.reduce((s, o) => s + o.hours, 0))} horas hombre`, icon: Timer, tone: mttr > 1.5 ? 'warn' : 'good', action: () => document.getElementById('taller-orders')?.scrollIntoView({ behavior: 'smooth' }) },
    { label: 'Service vencidos', value: fmt(overdue.length), detail: overdue.slice(0, 4).map((u) => u.interno).join(' · ') || 'flota al día', icon: AlertTriangle, tone: overdue.length ? 'bad' : 'good', action: () => overdue[0] && onOpenUnit(overdue[0].interno) },
  ];

  return <>
    <section className="metrics-grid five">{kpis.map((k, i) => <motion.button initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }} whileHover={{ y: -4 }} className="metric-card" key={k.label} onClick={k.action}><div className="metric-top"><span className="metric-icon"><k.icon size={18} /></span><span className={`change ${k.tone}`}>{k.tone === 'good' ? 'En rango' : k.tone === 'warn' ? 'Atención' : 'Crítico'}</span></div><span className="metric-label">{k.label}</span><strong>{k.value}</strong><span className="metric-description">{k.detail}<ArrowUpRight size={13} /></span></motion.button>)}</section>

    <section className="fleet-map">
      <div className="panel bus-panel">
        <div className="panel-heading"><div><span className="section-kicker">Mapa de intervenciones · {baseFilter === 'Todas las bases' ? 'toda la flota' : baseFilter} · {period}</span><h2>¿Dónde se rompen los coches?</h2></div>{component && <button className="clear-filter" onClick={() => setComponent(null)}>{componentById[component].name} <X size={13} /></button>}</div>
        <BusDiagram view={view} onView={setView} stats={stats} showOpen={false} selected={component} onSelect={(c) => { setComponent(c); setLimit(12); }} />
      </div>
      <div className="panel rank-panel">
        <div className="panel-heading"><div><span className="section-kicker">Ranking de componentes</span><h2>Más intervenidos</h2></div></div>
        <div className="rank-list">{ranking.slice(0, 12).map((r) => <button key={r.c.id} className={`rank-row ${component === r.c.id ? 'on' : ''}`} onClick={() => setComponent(component === r.c.id ? null : r.c.id)}>
          <span className="rank-name">{r.c.name}</span>
          <span className="rank-bar"><i style={{ width: `${(r.count / maxRank) * 100}%` }} /></span>
          <b>{r.count}</b><small>{moneyShort(r.cost ?? 0)}</small>
        </button>)}</div>
      </div>
    </section>

    <section className="chart-row">
      <div className="panel">
        <div className="panel-heading"><div><span className="section-kicker">Últimos 12 meses{component ? ` · ${componentById[component].name}` : ''}</span><h2>Órdenes de trabajo por mes</h2></div></div>
        <div className="chart-legend">{typeGroups.map((g) => <span key={g.key}><i style={{ background: g.color }} /> {g.label}</span>)}</div>
        <div className="chart-wrap short"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} barCategoryGap="28%"><CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#7f8aa3', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#7f8aa3', fontSize: 11 }} width={30} allowDecimals={false} /><Tooltip cursor={{ fill: 'rgba(255,255,255,.04)' }} contentStyle={tooltipStyle} formatter={(v, n) => [v, typeGroups.find((g) => g.key === n)?.label ?? n]} />{typeGroups.map((g, i) => <Bar key={g.key} dataKey={g.key} stackId="a" fill={g.color} stroke="#0f1322" strokeWidth={2} radius={i === typeGroups.length - 1 ? [4, 4, 0, 0] : 0} />)}</BarChart></ResponsiveContainer></div>
      </div>
      <div className="panel">
        <div className="panel-heading"><div><span className="section-kicker">{period}{component ? ` · ${componentById[component].name}` : ''}</span><h2>Materiales por base</h2></div></div>
        <div className="base-cost">{byBase.map((b) => <div key={b.name}><span><i style={{ background: b.color }} />{b.name}</span><div className="sys-bar"><i style={{ width: `${(b.cost / Math.max(1, ...byBase.map((x) => x.cost))) * 100}%`, background: b.color }} /></div><b>{moneyShort(b.cost)}</b><small>{moneyShort(b.cost / b.units)} por coche</small></div>)}</div>
      </div>
    </section>

    <div className="section-header compact" id="taller-board"><div><span className="section-kicker">Ahora en el taller</span><h2>Coches detenidos</h2></div><span className="alert-badge">{open.length} OT abiertas</span></div>
    <section className="kanban">{board.map((col) => <div className="kanban-col" key={col.title}>
      <div className="kanban-head"><span>{col.title}</span><b>{col.items.length}</b></div>
      {col.items.map((o) => <motion.button layout whileHover={{ y: -3 }} key={o.id} className={`kanban-card prio-${o.priority.toLowerCase()}`} onClick={() => onOpenUnit(o.unit, { order: o.id })}>
        <div className="kc-top"><span className="kc-int">{o.unit}</span><small>{o.base}</small><small className="kc-ago">{ago(o.opened, now)}</small></div>
        <strong>{o.title}</strong>
        <span className="ot-comps">{o.components.map((c) => <i key={c}>{componentById[c].name}</i>)}</span>
        <div className="kc-foot"><span>{o.mechanic}</span><span>{o.id}</span></div>
      </motion.button>)}
      {!col.items.length && <div className="empty-state">Sin coches</div>}
    </div>)}</section>

    <div className="section-header compact" id="taller-orders"><div><span className="section-kicker">Registro · {period}</span><h2>Órdenes de trabajo</h2></div>
      <div className="chips">{[{ key: 'Todas', label: 'Todas' }, ...typeGroups].map((g) => <button key={g.key} className={typeFilter === g.key ? 'on' : ''} onClick={() => setTypeFilter(g.key)}>{g.label}</button>)}</div>
    </div>
    <section className="records-panel ot-table">
      <div className="ot-row ot-head"><span>OT</span><span>Coche</span><span>Trabajo</span><span>Tipo</span><span>Mecánico</span><span>Estado</span><span>Materiales</span></div>
      {table.slice(0, limit).map((o) => <button key={o.id} className="ot-row" onClick={() => onOpenUnit(o.unit, { order: o.id })}>
        <span className="mono">{o.id}<small>{date(o.opened)}</small></span>
        <span><b className="kc-int">{o.unit}</b><small>{o.base}</small></span>
        <span><strong>{o.title}</strong><small>{o.components.map((c) => componentById[c].name).join(' · ')}</small></span>
        <span><i className={`ot-dot t-${statusClass(o.type)}`} /> {o.type}</span>
        <span>{o.mechanic}<small>{fmt(o.hours, 1)} h</small></span>
        <span><span className={`status-pill ${statusClass(o.status)}`}>{o.status}</span></span>
        <span className="num">{money(orderCost(o))}</span>
      </button>)}
      {!table.length && <div className="empty-state">No hay órdenes que coincidan con los filtros.</div>}
      {table.length > limit && <button className="more-button" onClick={() => setLimit(limit + 20)}>Ver más ({table.length - limit} restantes) <ChevronRight size={14} /></button>}
    </section>

    <div className="section-header compact" id="taller-materials"><div><span className="section-kicker">Pañol · {period}{component ? ` · ${componentById[component].name}` : ''}</span><h2>Materiales con mayor costo</h2></div></div>
    <section className="records-panel mat-fleet">
      {materials.map((m, i) => <div className="mat-fleet-row" key={m.code}><span className="rank-n">{i + 1}</span><span className="mono">{m.code}</span><strong>{m.name}</strong><span>{fmt(m.qty)} {m.unit}</span><span>{m.orders} OT</span><b>{money(m.cost)}</b></div>)}
      {!materials.length && <div className="empty-state">Sin consumos de pañol en el período.</div>}
    </section>
    <p className="footnote"><Clock3 size={12} /> Datos de demostración generados para Solbus. Se reemplazan por la API del sistema de mantenimiento cuando esté disponible.</p>
  </>;
}
