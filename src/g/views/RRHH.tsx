import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Download, FileWarning, HeartPulse, MinusCircle, Search, ShieldCheck, ShieldPlus, TrendingUp, UserCheck, UserPlus, Users } from 'lucide-react';
import { MONTH_FULL, MONTH_LABELS, UNIT_COLOR, UnitFilter, UnitName, unitsOf } from '../data';
import { AREAS, AREA_COLOR, Area, Emp, areaRows, empHistory, empMonths, hrLists, hrTotals, riskLevel } from '../rrhh';
import { HRListDrawer, type HRKind } from './HRList';
import { AXIS, GRID, Panel, TOOLTIP_STYLE, fmt, moneyM, pct } from '../ui';
import { useDrill } from '../drill';
import { exportView } from '../export';
import type { MetricKey } from '../metrics';

const Tip = <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} />;
function Delta({ cur, prev, goodUp = true }: { cur: number; prev: number | null; goodUp?: boolean }) {
  if (prev === null || !prev) return <span className="delta neutral">s/d</span>;
  const p = ((cur - prev) / prev) * 100; const good = (p > 0) === goodUp; const zero = Math.abs(p) < 0.05;
  return <span className={`delta ${zero ? 'neutral' : good ? 'up-good' : 'up-bad'}`}>{p >= 0 ? '▲' : '▼'} {fmt(Math.abs(p), 1)}%<em>vs. mes ant.</em></span>;
}
function Mini({ data, kind, color, title }: { data: { m: string; v: number }[]; kind: 'line' | 'bar'; color: string; title: string }) {
  return <div className="rh-mini"><span>{title}</span><div><ResponsiveContainer width="100%" height="100%">{kind === 'line'
    ? <LineChart data={data} margin={{ top: 6, right: 6, left: -26, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ ...AXIS, fontSize: 9 }} interval={2} /><YAxis axisLine={false} tickLine={false} tick={{ ...AXIS, fontSize: 9 }} width={40} />{Tip}<Line dataKey="v" stroke={color} strokeWidth={2} dot={{ r: 2, fill: color }} /></LineChart>
    : <BarChart data={data} margin={{ top: 6, right: 6, left: -26, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ ...AXIS, fontSize: 9 }} interval={2} /><YAxis axisLine={false} tickLine={false} tick={{ ...AXIS, fontSize: 9 }} width={40} />{Tip}<Bar dataKey="v" fill={color} radius={[3, 3, 0, 0]} /></BarChart>}</ResponsiveContainer></div></div>;
}

export function RRHHView({ unit, notify }: { unit: UnitFilter; notify: (m: string) => void }) {
  const [tab, setTab] = useState<'Resumen mensual' | 'Análisis por legajo'>('Resumen mensual');
  const [m, setM] = useState(11);
  const drill = useDrill();
  const [list, setList] = useState<{ kind: HRKind; area?: Area | null } | null>(null);
  const [pick, setPick] = useState<Emp | null>(null);
  const openEmp = (e: Emp) => { setList(null); setPick(e); setTab('Análisis por legajo'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <div className="rrhh">
    <section className="t-header">
      <div className="t-title"><span className="t-title-icon" style={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)' }}><Users size={24} /></span><div><span className="section-kicker">Recursos humanos</span><h2>Dashboard RR.HH.</h2><p>{unit === 'Todos' ? 'Todas las unidades de negocio' : unit}</p></div></div>
      <div className="t-header-tools"><label className="g-select"><CalendarDays size={16} /><span>Mes seleccionado<select value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTH_FULL.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></span></label><button className="export-button" onClick={() => { const n = exportView('RRHH'); notify(`Exportado a Excel: ${n} tablas de RR.HH.`); }}><Download size={15} /> Exportar</button></div>
    </section>
    <nav className="t-tabs" role="tablist">{(['Resumen mensual', 'Análisis por legajo'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
    {tab === 'Resumen mensual' ? <Resumen unit={unit} m={m} onList={(kind, area) => setList({ kind, area })} /> : <Legajo key={pick?.legajo ?? 0} unit={unit} m={m} pick={pick} />}
    {list && <HRListDrawer key={list.kind + (list.area ?? '')} kind={list.kind} area={list.area ?? null} unit={unit} m={m} onClose={() => setList(null)} onEmp={openEmp} onMetric={(k) => { setList(null); drill.openMetric(k, { unit, month: m }); }} />}
  </div>;
}

function Resumen({ unit, m, onList }: { unit: UnitFilter; m: number; onList: (k: HRKind, area?: Area | null) => void }) {
  const t = useMemo(() => hrTotals(unit, m), [unit, m]);
  const L = useMemo(() => hrLists(unit, m), [unit, m]);
  const p = m > 0 ? hrTotals(unit, m - 1) : null;
  const rows = useMemo(() => areaRows(t).map((r) => { const inA = <T extends { emp: Emp }>(xs: T[]) => xs.filter((x) => x.emp.area === r.area); const sd = (xs: { dias: number }[]) => xs.reduce((s2, x) => s2 + x.dias, 0);
    return { ...r, activos: L.activos.filter((e) => e.area === r.area).length, altas: inA(L.altas).length, bajas: inA(L.bajas).length, artCant: inA(L.art).length, artDias: sd(inA(L.art)), carpCant: inA(L.carp).length, carpDias: sd(inA(L.carp)) }; }), [t, L]);
  const tot = rows.reduce((a, r) => ({ activos: a.activos + r.activos, altas: a.altas + r.altas, bajas: a.bajas + r.bajas, remun: a.remun + r.remun, feriados: a.feriados + r.feriados, guardias: a.guardias + r.guardias, susCant: a.susCant + r.susCant, susDias: a.susDias + r.susDias, artCant: a.artCant + r.artCant, artDias: a.artDias + r.artDias, carpCant: a.carpCant + r.carpCant, carpDias: a.carpDias + r.carpDias }), { activos: 0, altas: 0, bajas: 0, remun: 0, feriados: 0, guardias: 0, susCant: 0, susDias: 0, artCant: 0, artDias: 0, carpCant: 0, carpDias: 0 });
  const series = useMemo(() => MONTH_LABELS.map((lb, i) => { const x = hrTotals(unit, i); return { m: lb, activos: x.activos, altas: x.altas, bajas: x.bajas, aus: +x.ausPct.toFixed(1), sus: x.susCant, art: x.artDias, carp: x.carpDias, susD: x.susDias, remun: x.remun }; }), [unit]);
  const dash = (v: number) => (v ? fmt(v) : '–');
  const tiles = [
    { i: Users, h: 'activos' as HRKind, k: 'activos' as MetricKey, l: 'Activos totales', v: fmt(t.activos), c: '#2563eb', d: <Delta cur={t.activos} prev={p?.activos ?? null} /> },
    { i: UserPlus, h: 'altas' as HRKind, k: 'altas' as MetricKey, l: 'Altas del mes', v: fmt(t.altas), c: '#22c55e', d: <Delta cur={t.altas} prev={p?.altas ?? null} /> },
    { i: MinusCircle, h: 'bajas' as HRKind, k: 'bajas' as MetricKey, l: 'Bajas del mes', v: fmt(t.bajas), c: '#ef4444', d: <Delta cur={t.bajas} prev={p?.bajas ?? null} goodUp={false} /> },
    { i: UserCheck, h: 'aus' as HRKind, k: 'ausDias' as MetricKey, l: 'Días de ausentismo', v: fmt(t.ausDias), c: '#f97316', d: <Delta cur={t.ausDias} prev={p?.ausDias ?? null} goodUp={false} /> },
    { i: ShieldPlus, h: 'art' as HRKind, k: 'artDias' as MetricKey, l: 'Días ART', v: fmt(t.artDias), c: '#8b5cf6', d: <Delta cur={t.artDias} prev={p?.artDias ?? null} goodUp={false} /> },
    { i: HeartPulse, h: 'carp' as HRKind, k: 'carpDias' as MetricKey, l: 'Días carpetas', v: fmt(t.carpDias), c: '#14b8a6', d: <Delta cur={t.carpDias} prev={p?.carpDias ?? null} goodUp={false} /> },
  ];
  return <>
    <section className="t-kpis rh-kpis">{tiles.map((x) => <div className="t-tile clickable" role="button" tabIndex={0} title="Ver el listado" onClick={() => onList(x.h)} onKeyDown={(e) => { if (e.key === 'Enter') onList(x.h); }} key={x.l} style={{ ['--tone' as string]: x.c }}><div className="t-tile-top"><span className="t-tile-icon"><x.i size={19} /></span><span className="t-tile-label">{x.l}</span></div><div className="t-tile-value"><strong>{x.v}</strong></div>{x.d}<small className="rh-hint">Ver listado →</small></div>)}</section>
    <Panel kicker="Consolidado · tocá un área o una cifra para ver el listado" title="Resumen mensual por área" className="rh-table-panel"><div className="g-table-wrap"><table className="g-table rh-area clickable"><thead><tr><th rowSpan={2}>Área</th><th rowSpan={2}>Activos</th><th rowSpan={2}>Altas</th><th rowSpan={2}>Bajas</th><th rowSpan={2}>Remuneración ($)</th><th rowSpan={2}>Feriados pagados</th><th rowSpan={2}>Guardias pagadas</th><th colSpan={2} className="c-orange">Suspensiones aplicadas</th><th colSpan={2} className="c-purple">ART</th><th colSpan={2} className="c-teal">Carpetas médicas</th></tr><tr><th className="c-orange">Cant.</th><th className="c-orange">Días</th><th className="c-purple">Cant.</th><th className="c-purple">Días</th><th className="c-teal">Cant.</th><th className="c-teal">Días</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.area} onClick={() => onList('activos', r.area)}><td><span className="sector-tag"><i style={{ background: AREA_COLOR[r.area] }} />{r.area}</span></td><td>{fmt(r.activos)}</td><td className="cell-link" onClick={(e) => { e.stopPropagation(); onList('altas', r.area); }}>{dash(r.altas)}</td><td className="cell-link" onClick={(e) => { e.stopPropagation(); onList('bajas', r.area); }}>{dash(r.bajas)}</td><td>{moneyM(r.remun)}</td><td>{dash(r.feriados)}</td><td>{dash(r.guardias)}</td><td>{dash(r.susCant)}</td><td>{dash(r.susDias)}</td><td className="cell-link" onClick={(e) => { e.stopPropagation(); onList('art', r.area); }}>{dash(r.artCant)}</td><td className="cell-link" onClick={(e) => { e.stopPropagation(); onList('art', r.area); }}>{dash(r.artDias)}</td><td className="cell-link" onClick={(e) => { e.stopPropagation(); onList('carp', r.area); }}>{dash(r.carpCant)}</td><td className="cell-link" onClick={(e) => { e.stopPropagation(); onList('carp', r.area); }}>{dash(r.carpDias)}</td></tr>)}</tbody>
      <tfoot><tr><td>TOTAL GENERAL</td><td>{fmt(tot.activos)}</td><td>{dash(tot.altas)}</td><td>{dash(tot.bajas)}</td><td>{moneyM(tot.remun)}</td><td>{dash(tot.feriados)}</td><td>{dash(tot.guardias)}</td><td>{dash(tot.susCant)}</td><td>{dash(tot.susDias)}</td><td>{dash(tot.artCant)}</td><td>{dash(tot.artDias)}</td><td>{dash(tot.carpCant)}</td><td>{dash(tot.carpDias)}</td></tr></tfoot></table></div></Panel>
    <h3 className="rh-section">Evolución de los últimos 12 meses</h3>
    <section className="rh-grid">
      <Panel title="1. Evolución de activos"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={AXIS} />{Tip}<Line dataKey="activos" name="Activos" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--dot-bg)', stroke: '#3b82f6', strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div></Panel>
      <Panel title="2. Altas vs. bajas"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} />{Tip}<Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: 'var(--ax)' }} /><Bar dataKey="altas" name="Altas" fill="#22c55e" radius={[3, 3, 0, 0]} /><Bar dataKey="bajas" name="Bajas" fill="#ef4444" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="3. Ausentismo (%)"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${v}%`} />{Tip}<Line dataKey="aus" name="Ausentismo %" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--dot-bg)', stroke: '#f97316', strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div></Panel>
      <Panel title="4. Suspensiones aplicadas (cantidad)"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} />{Tip}<Bar dataKey="sus" name="Suspensiones" fill="#f97316" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="5. Días perdidos por causa"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} />{Tip}<Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: 'var(--ax)' }} /><Bar dataKey="art" name="ART" stackId="a" fill="#8b5cf6" /><Bar dataKey="carp" name="Carpetas médicas" stackId="a" fill="#14b8a6" /><Bar dataKey="susD" name="Suspensiones" stackId="a" fill="#f97316" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="6. Remuneraciones ($)"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 8, right: 8, left: -2, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${fmt(v / 1e9, 2)} B`} /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [moneyM(v), 'Remuneraciones']} /><Line dataKey="remun" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--dot-bg)', stroke: '#3b82f6', strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div></Panel>
      <Panel title="7. Días de ART"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} />{Tip}<Bar dataKey="art" name="Días ART" fill="#8b5cf6" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Panel>
      <Panel title="8. Distribución de activos por área"><div className="t-donut"><div className="t-donut-chart"><PieChart width={150} height={150}><Pie data={rows.map((r) => ({ name: r.area, value: r.activos }))} dataKey="value" innerRadius="60%" outerRadius="94%" paddingAngle={2} stroke="none">{rows.map((r) => <Cell key={r.area} fill={AREA_COLOR[r.area]} />)}</Pie><Tooltip contentStyle={TOOLTIP_STYLE} /></PieChart><div className="t-donut-center"><strong>{fmt(tot.activos)}</strong><span>ACTIVOS</span></div></div><ul className="t-legend">{rows.map((r) => <li key={r.area}><i style={{ background: AREA_COLOR[r.area] }} />{r.area}<b>{fmt(r.activos)}</b><em>{pct((r.activos / tot.activos) * 100)}</em></li>)}</ul></div></Panel>
    </section>
  </>;
}

function Legajo({ unit, m, pick }: { unit: UnitFilter; m: number; pick: Emp | null }) {
  const [area, setArea] = useState('Todas');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(pick?.legajo ?? null);
  const all = useMemo(() => { const L = hrLists(unit, m); const xs = [...L.activos, ...L.altas.map((a) => a.emp)]; if (pick && !xs.some((e) => e.legajo === pick.legajo)) xs.unshift(pick); return xs; }, [unit, m, pick]);
  const pool = useMemo(() => all.filter((e) => unitsOf(unit).includes(e.unit) && (area === 'Todas' || e.area === area) && `${e.legajo} ${e.nombre}`.toLowerCase().includes(q.toLowerCase())), [all, unit, area, q]);
  const emp: Emp | undefined = pool.find((e) => e.legajo === sel) ?? pool[0];
  const nov = useMemo(() => (emp ? empMonths(emp) : []), [emp]);
  if (!emp) return <div className="empty-state">No hay legajos que coincidan con los filtros.</div>;
  const cur = nov[m]; const risk = riskLevel(cur); const hist = empHistory(emp, m, cur);
  const acc = nov.reduce((a, n) => ({ aus: a.aus + n.aus, carp: a.carp + n.carp, art: a.art + n.art, inf: a.inf + n.inf, aper: a.aper + n.aper, sus: a.sus + n.sus, sinCon: a.sinCon + n.sinCon, sinSin: a.sinSin + n.sinSin, inc: a.inc + n.inc }), { aus: 0, carp: 0, art: 0, inf: 0, aper: 0, sus: 0, sinCon: 0, sinSin: 0, inc: 0 });
  const ser = (k: keyof typeof acc) => nov.map((n, i) => ({ m: MONTH_LABELS[i], v: n[k] }));
  const dist = [{ name: 'Carpetas médicas', value: acc.carp, color: '#22c55e' }, { name: 'Ausencias', value: acc.aus, color: '#3b82f6' }, { name: 'Informes', value: acc.inf, color: '#f97316' }, { name: 'Apercibimientos', value: acc.aper, color: '#facc15' }, { name: 'Suspensiones', value: acc.sus, color: '#ef4444' }, { name: 'Otros', value: acc.inc + acc.sinCon + acc.sinSin + acc.art, color: '#a855f7' }];
  const dTot = dist.reduce((s, x) => s + x.value, 0) || 1;
  const tiles = [
    { i: CalendarDays, l: 'Ausencias del mes', v: cur.aus, u: 'días', c: '#f97316' }, { i: HeartPulse, l: 'Carpetas médicas del mes', v: cur.carp, u: 'días', c: '#22c55e' }, { i: ShieldPlus, l: 'ART del mes', v: cur.art, u: 'días', c: '#8b5cf6' },
    { i: ClipboardList, l: 'Informes del mes', v: cur.inf, u: 'informes', c: '#fb923c' }, { i: AlertTriangle, l: 'Apercibimientos del mes', v: cur.aper, u: 'casos', c: '#facc15' }, { i: FileWarning, l: 'Suspensiones del mes', v: cur.sus, u: 'días', c: '#ef4444' },
  ];
  return <div className="rh-legajo">
    <aside className="rh-filters">
      <h4>Filtros</h4>
      <label>Área<select value={area} onChange={(e) => { setArea(e.target.value); setSel(null); }}><option>Todas</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></label>
      <label>Buscar legajo<div className="rh-search"><input placeholder="Legajo o apellido…" value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} /><Search size={14} /></div></label>
      <h4>Legajos ({pool.length})</h4>
      <ul className="rh-recent">{(pool.slice(0, 12).includes(emp) ? pool.slice(0, 12) : [emp, ...pool.slice(0, 11)]).map((e) => <li key={e.legajo}><button className={e.legajo === emp.legajo ? 'active' : ''} onClick={() => setSel(e.legajo)}><b>{e.legajo}</b>{e.nombre}</button></li>)}</ul>
    </aside>
    <div className="rh-legajo-main">
      <section className="rh-profile">
        <div className="rh-avatar"><Users size={34} /></div>
        <div className="rh-profile-data">
          <div><span>Legajo</span><b className="blue">{emp.legajo}</b></div><div><span>Apellido y nombre</span><b className="blue">{emp.nombre}</b></div><div><span>Área</span><b className="blue">{emp.area}</b></div><div><span>Sector</span><b className="blue">{emp.sector}</b></div><div><span>Puesto</span><b>{emp.puesto}</b></div><div><span>Turno</span><b>{emp.turno}</b></div>
          <div><span>Unidad</span><b><i className="unit-dot" style={{ background: UNIT_COLOR[emp.unit as UnitName] }} />{emp.unit}</b></div><div><span>Fecha de ingreso</span><b>{emp.ingreso}</b></div><div><span>Antigüedad</span><b className="blue">{emp.antig}</b></div><div><span>Estado</span><b className="green"><CheckCircle2 size={13} /> ACTIVO</b></div><div><span>Supervisor</span><b className="blue">{emp.supervisor}</b></div>
        </div>
        <div className={`rh-semaforo ${risk.tone}`}><span>SEMÁFORO DE DESEMPEÑO</span><div><i /><strong>{risk.label}</strong></div><small>{risk.text}</small></div>
      </section>
      <section className="t-kpis rh-tiles">{tiles.map((x) => <div className="t-tile" key={x.l} style={{ ['--tone' as string]: x.c }}><div className="t-tile-top"><span className="t-tile-icon"><x.i size={19} /></span><span className="t-tile-label">{x.l}</span></div><div className="t-tile-value"><strong>{x.v}</strong><small>{x.u}</small></div></div>)}
        <div className="t-tile wide2"><div className="t-tile-top"><span className="t-tile-label">Siniestros del mes</span></div><div className="rh-two"><div><small>Con culpabilidad</small><strong>{cur.sinCon}</strong></div><div><small>Sin culpabilidad</small><strong>{cur.sinSin}</strong></div></div></div>
        <div className="t-tile" style={{ ['--tone' as string]: '#ef4444' }}><div className="t-tile-top"><span className="t-tile-icon"><ShieldCheck size={19} /></span><span className="t-tile-label">Incidentes del mes</span></div><div className="t-tile-value"><strong>{cur.inc}</strong><small>casos</small></div></div></section>
      <section className="rh-two-col">
        <Panel kicker={MONTH_FULL[m]} title="Historial de novedades"><div className="g-table-wrap tall"><table className="g-table"><thead><tr><th>Fecha</th><th>Tipo de novedad</th><th>Detalle</th><th>Días</th></tr></thead><tbody>{hist.length ? hist.map((h, i) => <tr key={i}><td>{h.fecha}</td><td>{h.tipo}</td><td>{h.detalle}</td><td>{h.dias}</td></tr>) : <tr><td colSpan={4} className="muted-cell">Sin novedades en el mes seleccionado.</td></tr>}</tbody></table></div></Panel>
        <Panel kicker="12 meses" title="Acumulado y distribución"><div className="rh-acc"><ul>{([['Ausencias (días)', acc.aus], ['Carpetas médicas (días)', acc.carp], ['ART (días)', acc.art], ['Informes (cant.)', acc.inf], ['Apercibimientos (cant.)', acc.aper], ['Suspensiones (días)', acc.sus], ['Siniestros con culpabilidad', acc.sinCon], ['Siniestros sin culpabilidad', acc.sinSin], ['Incidentes (cant.)', acc.inc]] as [string, number][]).map(([l, v]) => <li key={l}><span>{l}</span><b>{v}</b></li>)}</ul>
          <div className="t-donut-chart small"><PieChart width={130} height={130}><Pie data={dist} dataKey="value" innerRadius="55%" outerRadius="95%" paddingAngle={2} stroke="none">{dist.map((x) => <Cell key={x.name} fill={x.color} />)}</Pie><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${v} (${fmt((v / dTot) * 100, 0)}%)`, n]} /></PieChart></div></div>
          <ul className="t-legend compact cols">{dist.map((x) => <li key={x.name}><i style={{ background: x.color }} />{x.name}<em>{fmt((x.value / dTot) * 100, 0)}%</em></li>)}</ul></Panel>
      </section>
      <h3 className="rh-section">Evolución de novedades · últimos 12 meses</h3>
      <section className="rh-mini-grid">
        <Mini title="Ausencias (días)" data={ser('aus')} kind="line" color="#3b82f6" /><Mini title="Suspensiones (días)" data={ser('sus')} kind="bar" color="#ef4444" /><Mini title="Carpetas médicas (días)" data={ser('carp')} kind="line" color="#22c55e" /><Mini title="ART (días)" data={ser('art')} kind="bar" color="#8b5cf6" />
        <Mini title="Informes (cantidad)" data={ser('inf')} kind="line" color="#f97316" /><Mini title="Apercibimientos (cantidad)" data={ser('aper')} kind="bar" color="#facc15" /><Mini title="Siniestros con culpabilidad" data={ser('sinCon')} kind="bar" color="#3b82f6" /><Mini title="Incidentes (cantidad)" data={ser('inc')} kind="line" color="#ef4444" />
      </section>
    </div>
  </div>;
}
