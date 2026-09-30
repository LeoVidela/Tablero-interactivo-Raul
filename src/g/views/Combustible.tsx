import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarDays, Droplets, Fuel, Gauge, Route, TrendingDown, Wallet } from 'lucide-react';
import { MONTH_FULL, MONTH_LABELS, UNIT_COLOR, UNIT_NAMES, UnitFilter, aggregate } from '../data';
import { AXIS, GRID, Panel, TOOLTIP_STYLE, fmt, money, moneyM } from '../ui';
import { tallerData, unitConsumption } from '../taller';
import { useDrill } from '../drill';
import { useOpenUnit } from '../openUnit';
import { exportView } from '../export';
import { Bars, C, TD, Tile } from './shared';

export const PRECIO_LITRO = 1350; // $ por litro de gasoil (referencia demo)

export function CombustibleView({ unit, notify }: { unit: UnitFilter; notify: (m: string) => void }) {
  const drill = useDrill(); const openUnit = useOpenUnit();
  const [m, setM] = useState(11);
  const a = useMemo(() => aggregate(unit, [m]), [unit, m]);
  const p = useMemo(() => (m > 0 ? aggregate(unit, [m - 1]) : null), [unit, m]);
  const series = useMemo(() => MONTH_LABELS.map((lb, i) => { const x = aggregate(unit, [i]); return { m: lb, i, lts: x.lts, kmpl: +(x.kmExec / x.lts).toFixed(2) }; }), [unit]);
  const cons = useMemo(() => unitConsumption(tallerData(unit, m)), [unit, m]);
  const avgKmpl = a.kmExec / a.lts;
  const desvios = cons.filter((r) => r.kmpl < avgKmpl * 0.9).sort((x, y) => x.kmpl - y.kmpl);
  const porBase = UNIT_NAMES.map((u) => { const x = aggregate(u, [m]); return { u, lts: x.lts, kmpl: x.kmExec / x.lts, costo: x.lts * PRECIO_LITRO, km: x.kmExec }; });
  const [rank, setRank] = useState<'peores' | 'mejores'>('peores');
  const ranked = [...cons].sort((x, y) => (rank === 'peores' ? x.kmpl - y.kmpl : y.kmpl - x.kmpl)).slice(0, 10);

  return <div className="taller combustible">
    <section className="t-header">
      <div className="t-title"><span className="t-title-icon" style={{ background: 'linear-gradient(135deg,#f97316,#f59e0b)' }}><Fuel size={24} /></span><div><span className="section-kicker">Gestión de combustible</span><h2>Consumo y rendimiento</h2><p>{unit === 'Todos' ? 'Todas las unidades' : unit} · gasoil de flota · precio de referencia {money(PRECIO_LITRO, 0)}/L</p></div></div>
      <div className="t-header-tools"><label className="g-select"><CalendarDays size={16} /><span>Mes seleccionado<select value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTH_FULL.map((nm, i) => <option key={nm} value={i}>{nm}</option>)}</select></span></label>
        <button className="export-button" onClick={() => { const n = exportView('Combustible'); notify(`Exportado a Excel (${n} tablas)`); }}>Exportar</button></div>
    </section>
    <section className="t-kpis six">
      <Tile icon={Fuel} label="Litros consumidos" value={fmt(a.lts)} sub="L" color={C.orange} onClick={() => drill.openMetric('lts', { unit, month: m })}><TD cur={a.lts} prev={p ? p.lts : null} goodUp={false} mode="pct" /></Tile>
      <Tile icon={Gauge} label="Rendimiento" value={fmt(avgKmpl, 2)} sub="km/l" color={C.green} onClick={() => drill.openMetric('kmpl', { unit, month: m })}><TD cur={avgKmpl} prev={p ? p.kmExec / p.lts : null} mode="pct" /></Tile>
      <Tile icon={Wallet} label="Costo de combustible" value={moneyM(a.lts * PRECIO_LITRO)} color={C.red} onClick={() => drill.openMetric('lts', { unit, month: m })}><TD cur={a.lts} prev={p ? p.lts : null} goodUp={false} mode="pct" /></Tile>
      <Tile icon={Route} label="Km ejecutados" value={fmt(a.kmExec)} sub="km" color={C.blue} onClick={() => drill.openMetric('kmExec', { unit, month: m })}><TD cur={a.kmExec} prev={p ? p.kmExec : null} mode="pct" /></Tile>
      <Tile icon={Droplets} label="Combustible por km" value={money((a.lts * PRECIO_LITRO) / a.kmExec)} sub="pesos por km" color={C.purple} onClick={() => drill.openMetric('kmpl', { unit, month: m })} />
      <Tile icon={AlertTriangle} label="Coches con desvío" value={desvios.length} sub="-10% del promedio" color={C.amber} onClick={() => setRank('peores')} />
    </section>
    <section className="mt-grid two">
      <Panel kicker="12 meses · tocá un mes" title="Litros y rendimiento"><div className="g-chart-box"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={series} margin={{ top: 8, right: 4, left: -4, bottom: 0 }} onClick={(e) => { const i = MONTH_LABELS.indexOf(String(e?.activeLabel)); if (i >= 0) setM(i); }}>
        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis yAxisId="l" axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${fmt(v / 1000, 0)}k`} /><YAxis yAxisId="r" orientation="right" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} formatter={(v: number, nm: string) => (nm === 'Km por litro' ? [fmt(v, 2), nm] : [`${fmt(v)} L`, nm])} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: 'var(--ax)' }} />
        <Bar yAxisId="l" dataKey="lts" name="Litros" fill={C.orange} radius={[4, 4, 0, 0]} isAnimationActive={false} /><Line yAxisId="r" dataKey="kmpl" name="Km por litro" stroke={C.green} strokeWidth={2.5} dot={{ r: 3, fill: 'var(--dot-bg)', stroke: C.green, strokeWidth: 2 }} isAnimationActive={false} />
      </ComposedChart></ResponsiveContainer></div></Panel>
      <Panel kicker={MONTH_FULL[m]} title="Por unidad de negocio"><div className="g-table-wrap"><table className="g-table clickable"><thead><tr><th>Base</th><th>Litros</th><th>Km/l</th><th>Costo</th></tr></thead>
        <tbody>{porBase.map((r) => <tr key={r.u} onClick={() => drill.openBase(r.u)}><td><span className="unit-tag"><i style={{ background: UNIT_COLOR[r.u] }} />{r.u}</span></td><td>{fmt(r.lts)}</td><td className={r.kmpl >= avgKmpl ? 'ok' : 'low'}>{fmt(r.kmpl, 2)}</td><td>{moneyM(r.costo)}</td></tr>)}</tbody></table></div>
        <p className="md-desc">Tocá una base para ver su ficha completa.</p></Panel>
    </section>
    <section className="mt-grid two">
      <Panel kicker={`${MONTH_FULL[m]} · tocá un coche para ver su ficha`} title="Rendimiento por coche" right={<div className="sn-chips inline">{(['peores', 'mejores'] as const).map((x) => <button key={x} className={rank === x ? 'active' : ''} onClick={() => setRank(x)}>{x === 'peores' ? 'Menor rendimiento' : 'Mayor rendimiento'}</button>)}</div>}>
        <Bars color={C.orange} fmtV={(v) => `${fmt(v, 2)} km/l`} rows={ranked.map((r) => ({ key: r.bus.id, label: <><b>{r.bus.interno}</b><small>{r.bus.unit} · {fmt(r.lts)} L</small></>, value: r.kmpl, color: r.kmpl < avgKmpl * 0.9 ? C.red : C.green }))} onClick={(k) => openUnit(k)} />
      </Panel>
      <Panel kicker="Control" title={`Coches con desvío de consumo · ${desvios.length}`}><div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Int.</th><th>Base</th><th>Km</th><th>Litros</th><th>Km/l</th><th>Desvío</th></tr></thead>
        <tbody>{desvios.slice(0, 12).map((r) => <tr key={r.bus.id} onClick={() => openUnit(r.bus.id)}><td><b>{r.bus.interno}</b></td><td>{r.bus.unit}</td><td>{fmt(r.km)}</td><td>{fmt(r.lts)}</td><td className="low">{fmt(r.kmpl, 2)}</td><td className="low"><TrendingDown size={12} /> {fmt(((r.kmpl - avgKmpl) / avgKmpl) * 100, 1)}%</td></tr>)}
          {!desvios.length && <tr><td colSpan={6} className="empty-cell">Sin desvíos este mes.</td></tr>}</tbody></table></div></Panel>
    </section>
    <p className="t-note"><Fuel size={13} /> Datos demostrativos · se reemplazan por el registro de cargas de combustible (app de ingresos de gasoil) al conectarlo.</p>
  </div>;
}
