import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarDays, Clock3, Droplets, Fuel, Gauge, Ruler, TrendingDown, Truck, Wallet } from 'lucide-react';
import { MONTH_FULL, UNIT_COLOR, UNIT_NAMES, UnitFilter, aggregate } from '../data';
import { AXIS, GRID, Panel, TOOLTIP_STYLE, fmt, money, moneyM, pct } from '../ui';
import { tallerData, unitConsumption } from '../taller';
import { useDrill } from '../drill';
import { useOpenUnit } from '../openUnit';
import { exportView } from '../export';
import { tankState, tanksOf, type TankState } from '../tanques';
import { arNow } from './Greeting';
import { Bars, C, Tile } from './shared';

export const PRECIO_LITRO = 1350; // $ por litro de gasoil (referencia demo)
const lvlColor = (p: number) => (p >= 50 ? '#22c55e' : p >= 30 ? '#f59e0b' : '#ef4444');

/** Tanque cilíndrico horizontal con el nivel medido por regla. */
function TankGraphic({ s }: { s: TankState }) {
  const W = 260; const H = 110; const h = (s.ultimo.regla / s.tank.diam) * H; const re = H - (s.reorder / s.tank.cap) * H;
  const id = `clip-${s.tank.id}`;
  return <svg viewBox={`0 0 ${W} ${H + 8}`} className="tank-svg" aria-hidden>
    <defs><clipPath id={id}><rect x={2} y={2} width={W - 4} height={H - 4} rx={(H - 4) / 2} /></clipPath>
      <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={lvlColor(s.pctLleno)} stopOpacity=".95" /><stop offset="1" stopColor={lvlColor(s.pctLleno)} stopOpacity=".55" /></linearGradient></defs>
    <rect x={2} y={2} width={W - 4} height={H - 4} rx={(H - 4) / 2} className="tank-shell" />
    <g clipPath={`url(#${id})`}><rect x={0} y={H - h} width={W} height={h} fill={`url(#${id}-g)`} /><rect x={0} y={H - h} width={W} height={3} fill="#fff" opacity=".35" /></g>
    <line x1={14} x2={W - 14} y1={re} y2={re} className="tank-reorder" />
    <rect x={2} y={2} width={W - 4} height={H - 4} rx={(H - 4) / 2} fill="none" className="tank-outline" />
    <line x1={W / 2} x2={W / 2} y1={6} y2={H - 6} className="tank-rule" />
  </svg>;
}

export function CombustibleView({ unit, notify }: { unit: UnitFilter; notify: (m: string) => void }) {
  const drill = useDrill(); const openUnit = useOpenUnit();
  const { iso } = arNow();
  const [m, setM] = useState(11);
  const tanks = useMemo(() => tanksOf(unit).map((t) => tankState(t, iso)), [unit, iso]);
  const [selId, setSelId] = useState<string | null>(null);
  const sel = tanks.find((t) => t.tank.id === selId) ?? tanks[0];
  const [day, setDay] = useState<number | null>(null);
  const [onlyRev, setOnlyRev] = useState(false);

  const stock = tanks.reduce((s, t) => s + t.nivel, 0); const cap = tanks.reduce((s, t) => s + t.tank.cap, 0);
  const consProm = tanks.reduce((s, t) => s + t.consProm, 0);
  const ing30 = tanks.flatMap((t) => { const f = new Set(t.days.slice(-30).map((d) => d.fecha)); return t.ingresos.filter((x) => f.has(x.fecha)); });
  const ingL = ing30.reduce((s, x) => s + x.recibido, 0);
  const dif30 = tanks.reduce((s, t) => s + t.ultimo.dif, 0);
  const a = useMemo(() => aggregate(unit, [m]), [unit, m]);
  const l100 = (a.lts / a.kmExec) * 100;

  const cons = useMemo(() => unitConsumption(tallerData(unit, m)), [unit, m]);
  const avgKmpl = a.kmExec / a.lts;
  const desvios = cons.filter((r) => r.kmpl < avgKmpl * 0.9).sort((x, y) => x.kmpl - y.kmpl);
  const porBase = UNIT_NAMES.map((u) => { const x = aggregate(u, [m]); return { u, lts: x.lts, kmpl: x.kmExec / x.lts, costo: x.lts * PRECIO_LITRO, km: x.kmExec }; });
  const [rank, setRank] = useState<'peores' | 'mejores'>('peores');
  const ranked = [...cons].sort((x, y) => (rank === 'peores' ? x.kmpl - y.kmpl : y.kmpl - x.kmpl)).slice(0, 10);

  if (!sel) return null;
  const sd = sel.days[day ?? sel.days.length - 1];
  const med = (onlyRev ? sel.days.filter((d) => Math.abs(d.difPct) > 0.8) : sel.days).slice().reverse().slice(0, 15);
  const ingresos = tanks.flatMap((t) => t.ingresos).sort((x, y) => y.fecha.split('/').reverse().join('').localeCompare(x.fecha.split('/').reverse().join(''))).slice(0, 10);

  return <div className="taller combustible">
    <section className="t-header">
      <div className="t-title"><span className="t-title-icon" style={{ background: 'linear-gradient(135deg,#f97316,#f59e0b)' }}><Fuel size={24} /></span><div><span className="section-kicker">Combustible · medición de tanques</span><h2>Stock de gasoil y consumo</h2><p>{unit === 'Todos' ? 'Todas las unidades' : unit} · aforo diario con regla · {tanks.length} {tanks.length === 1 ? 'tanque' : 'tanques'} · precio de referencia {money(PRECIO_LITRO, 0)}/L</p></div></div>
      <div className="t-header-tools"><label className="g-select"><CalendarDays size={16} /><span>Mes (consumo por coche)<select value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTH_FULL.map((nm, i) => <option key={nm} value={i}>{nm}</option>)}</select></span></label>
        <button className="export-button" onClick={() => { const n = exportView('Combustible'); notify(`Exportado a Excel (${n} tablas)`); }}>Exportar</button></div>
    </section>

    <section className="t-kpis six">
      <Tile icon={Droplets} label="Stock en tanques" value={fmt(stock)} sub={`L · ${pct((stock / cap) * 100)} de ${fmt(cap)} L`} color={lvlColor((stock / cap) * 100)} onClick={() => { setSelId(tanks.slice().sort((x, y) => x.pctLleno - y.pctLleno)[0].tank.id); setDay(null); }} />
      <Tile icon={Clock3} label="Autonomía" value={fmt(stock / consProm, 1)} sub="días al consumo actual" color={C.blue} onClick={() => { setSelId(tanks.slice().sort((x, y) => x.autonomia - y.autonomia)[0].tank.id); setDay(null); }} />
      <Tile icon={Gauge} label="Consumo diario" value={fmt(consProm)} sub="L/día · promedio 7 días (medidor)" color={C.orange} onClick={() => drill.openMetric('lts', { unit })} />
      <Tile icon={Truck} label="Ingresos 30 días" value={fmt(ingL)} sub={`L · ${ing30.length} descargas de cisterna`} color={C.green} onClick={() => document.getElementById('cb-ingresos')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <Tile icon={Ruler} label="Medición vs libros" value={`${dif30 >= 0 ? '+' : '−'}${fmt(Math.abs(dif30))}`} sub="L de diferencia en el último aforo" color={Math.abs(dif30) > stock * 0.006 ? C.red : C.teal} onClick={() => { setOnlyRev(true); document.getElementById('cb-mediciones')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />
      <Tile icon={Wallet} label="Consumo de flota" value={fmt(l100, 2)} sub={`L/100 km · ${MONTH_FULL[m]}`} color={C.purple} onClick={() => drill.openMetric('kmpl', { unit, month: m })} />
    </section>

    <section className="tank-grid">{tanks.map((s) => <button key={s.tank.id} className={`tank-card ${s.tank.id === sel.tank.id ? 'on' : ''}`} style={{ ['--tone' as string]: UNIT_COLOR[s.tank.unit] }} onClick={() => { setSelId(s.tank.id); setDay(null); }}>
      <div className="tank-head"><span className="section-kicker">{s.tank.unit} · {s.tank.id}</span><b>{s.tank.nombre}</b></div>
      <TankGraphic s={s} />
      <div className="tank-level"><strong>{fmt(s.nivel)}</strong><span>litros</span><em style={{ color: lvlColor(s.pctLleno) }}>{pct(s.pctLleno, 0)}</em></div>
      <div className="tank-meta"><span>Capacidad <b>{fmt(s.tank.cap)} L</b></span><span>Regla <b>{fmt(s.ultimo.regla, 1)} cm</b></span><span>Autonomía <b className={s.autonomia < 3 ? 'low' : ''}>{fmt(s.autonomia, 1)} días</b></span></div>
      {s.nivel < s.reorder * 1.15 && <div className="tank-alert"><AlertTriangle size={13} /> Cerca del punto de pedido ({fmt(s.reorder)} L)</div>}
    </button>)}</section>

    <Panel kicker={`${sel.tank.unit} · ${sel.tank.nombre} · últimos 60 días · tocá un día`} title="Nivel del tanque" className="tank-chart-panel">
      <div className="tg-strip"><div><b>{sd.fecha}</b><span>{day === null ? 'último aforo' : 'día seleccionado'}</span></div><div><b>{fmt(sd.medido)} L</b><span>medido con regla ({fmt(sd.regla, 1)} cm)</span></div><div><b>{fmt(sd.libro)} L</b><span>stock según libros</span></div>
        <div className={Math.abs(sd.difPct) > 0.8 ? 'bad' : 'good'}><b>{sd.dif >= 0 ? '+' : '−'}{fmt(Math.abs(sd.dif))} L ({fmt(sd.difPct, 2)}%)</b><span>diferencia{sd.ingreso ? ` · ingreso ${fmt(sd.ingreso)} L` : ''}</span></div></div>
      <div className="g-chart-box tall-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={sel.days} margin={{ top: 10, right: 12, left: 4, bottom: 0 }} onClick={(e) => { const i = e?.activeTooltipIndex; if (typeof i === 'number') setDay(i === sel.days.length - 1 ? null : i); }}>
        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} interval={6} /><YAxis domain={[0, sel.tank.cap]} axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${fmt(v / 1000, 0)}k`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${fmt(v)} L`, n]} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, color: 'var(--ax)' }} />
        <ReferenceLine y={sel.tank.cap} stroke="var(--ax)" strokeDasharray="2 4" label={{ value: 'Capacidad', fill: 'var(--ax)', fontSize: 10, position: 'insideTopLeft' }} />
        <ReferenceLine y={sel.reorder} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Punto de pedido', fill: '#ef4444', fontSize: 10, position: 'insideBottomLeft' }} />
        {day !== null && <ReferenceLine x={sel.days[day].label} stroke="var(--ax)" strokeDasharray="3 3" />}
        <Line dataKey="libro" name="Stock según libros" stroke="#8b96ad" strokeDasharray="5 5" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line dataKey="medido" name="Medido con regla" stroke="#f97316" strokeWidth={2.4} isAnimationActive={false} dot={(p: { cx?: number; cy?: number; index?: number }) => { const dd = sel.days[p.index ?? 0]; return dd?.ingreso ? <circle key={p.index} cx={p.cx} cy={p.cy} r={5} fill="#22c55e" stroke="var(--dot-bg)" strokeWidth={2} /> : <g key={p.index} />; }} activeDot={{ r: 6 }} />
      </LineChart></ResponsiveContainer></div>
      <p className="md-desc">El serrucho baja con el consumo diario y sube con cada descarga de cisterna (punto verde). La línea punteada es el stock teórico por libros (stock anterior + ingresos − salidas del medidor); si la medición con regla se aleja más de 0,8 % conviene revisar.</p>
    </Panel>

    <section className="mt-grid two">
      <Panel kicker={`${sel.tank.id} · salidas por medidor de surtidor`} title="Consumo diario (litros)"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={sel.days.slice(-30)} margin={{ top: 8, right: 8, left: -4, bottom: 0 }} onClick={(e) => { const i = e?.activeTooltipIndex; if (typeof i === 'number') setDay(sel.days.length - 30 + i); }}>
        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} interval={4} /><YAxis axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${fmt(v / 1000, 1)}k`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} formatter={(v: number) => [`${fmt(v)} L`, 'Consumo']} />
        <Bar dataKey="consumo" radius={[4, 4, 0, 0]} isAnimationActive={false}>{sel.days.slice(-30).map((d) => <Cell key={d.i} fill="#f97316" fillOpacity={day === d.i ? 1 : 0.6} cursor="pointer" />)}</Bar></BarChart></ResponsiveContainer></div></Panel>
      <Panel kicker="Diferencia diaria medición − libros" title="Control de mermas (%)"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={sel.days.slice(-30)} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} interval={4} /><YAxis axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${fmt(v, 1)}%`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} formatter={(v: number) => [`${fmt(v, 2)}%`, 'Diferencia']} /><ReferenceLine y={-0.8} stroke="#ef4444" strokeDasharray="4 4" /><ReferenceLine y={0} stroke="var(--ax)" />
        <Bar dataKey="difPct" radius={[3, 3, 3, 3]} isAnimationActive={false}>{sel.days.slice(-30).map((d) => <Cell key={d.i} fill={Math.abs(d.difPct) > 0.8 ? '#ef4444' : '#14b8a6'} />)}</Bar></BarChart></ResponsiveContainer></div></Panel>
    </section>

    <section className="mt-grid two">
      <div id="cb-mediciones"><Panel kicker={`${sel.tank.id} · aforo diario`} title="Mediciones del tanque" right={<div className="sn-chips inline"><button className={!onlyRev ? 'active' : ''} onClick={() => setOnlyRev(false)}>Todas</button><button className={onlyRev ? 'active' : ''} onClick={() => setOnlyRev(true)}>A revisar</button></div>}>
        <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Fecha</th><th>Regla</th><th>Medido</th><th>Libros</th><th>Diferencia</th><th>Salidas</th><th>Ingreso</th><th>Estado</th></tr></thead>
          <tbody>{med.map((d) => <tr key={d.i} className={day === d.i ? 'row-active' : ''} onClick={() => setDay(d.i)}><td>{d.fecha}</td><td>{fmt(d.regla, 1)} cm</td><td><b>{fmt(d.medido)}</b></td><td>{fmt(d.libro)}</td><td className={Math.abs(d.difPct) > 0.8 ? 'low' : ''}>{d.dif >= 0 ? '+' : '−'}{fmt(Math.abs(d.dif))} ({fmt(d.difPct, 2)}%)</td><td>{fmt(d.consumo)}</td><td>{d.ingreso ? fmt(d.ingreso) : '–'}</td><td>{Math.abs(d.difPct) > 0.8 ? <span className="pill mini bad">Revisar</span> : <span className="pill mini good">OK</span>}</td></tr>)}
            {!med.length && <tr><td colSpan={8} className="empty-cell">Sin mediciones fuera de tolerancia.</td></tr>}</tbody></table></div></Panel></div>
      <div id="cb-ingresos"><Panel kicker="Camión cisterna · remito contra medición" title="Ingresos de combustible">
        <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Fecha</th><th>Tanque</th><th>Proveedor</th><th>Remito</th><th>Facturado</th><th>Recibido</th><th>Dif.</th></tr></thead>
          <tbody>{ingresos.map((x) => <tr key={x.remito} onClick={() => { setSelId(x.tank.id); const i = tankState(x.tank, iso).days.findIndex((d) => d.fecha === x.fecha); setDay(i >= 0 ? i : null); }}><td>{x.fecha}</td><td>{x.tank.id}</td><td>{x.proveedor}</td><td>{x.remito}</td><td>{fmt(x.facturado)}</td><td><b>{fmt(x.recibido)}</b></td><td className="low">{fmt(x.dif)}</td></tr>)}
            {!ingresos.length && <tr><td colSpan={7} className="empty-cell">Sin ingresos en el período.</td></tr>}</tbody></table></div>
        <p className="md-desc">Tocá un ingreso para verlo en el gráfico del tanque. Se carga desde la app de ingresos de gasoil.</p></Panel></div>
    </section>

    <section className="mt-grid two">
      <Panel kicker={MONTH_FULL[m]} title="Consumo por unidad de negocio"><div className="g-table-wrap"><table className="g-table clickable"><thead><tr><th>Base</th><th>Litros</th><th>Km/l</th><th>Costo</th></tr></thead>
        <tbody>{porBase.map((r) => <tr key={r.u} onClick={() => drill.openBase(r.u)}><td><span className="unit-tag"><i style={{ background: UNIT_COLOR[r.u] }} />{r.u}</span></td><td>{fmt(r.lts)}</td><td className={r.kmpl >= avgKmpl ? 'ok' : 'low'}>{fmt(r.kmpl, 2)}</td><td>{moneyM(r.costo)}</td></tr>)}</tbody></table></div>
        <p className="md-desc">Tocá una base para ver su ficha completa.</p></Panel>
      <Panel kicker={`${MONTH_FULL[m]} · tocá un coche para ver su ficha`} title="Rendimiento por coche" right={<div className="sn-chips inline">{(['peores', 'mejores'] as const).map((x) => <button key={x} className={rank === x ? 'active' : ''} onClick={() => setRank(x)}>{x === 'peores' ? 'Menor' : 'Mayor'}</button>)}</div>}>
        <Bars color={C.orange} fmtV={(v) => `${fmt(v, 2)} km/l`} rows={ranked.map((r) => ({ key: r.bus.id, label: <><b>{r.bus.interno}</b><small>{r.bus.unit} · {fmt(r.lts)} L</small></>, value: r.kmpl, color: r.kmpl < avgKmpl * 0.9 ? C.red : C.green }))} onClick={(k) => openUnit(k)} />
      </Panel>
    </section>
    <Panel kicker="Control" title={`Coches con desvío de consumo · ${desvios.length}`}><div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Int.</th><th>Base</th><th>Km</th><th>Litros</th><th>Km/l</th><th>Desvío</th></tr></thead>
      <tbody>{desvios.slice(0, 12).map((r) => <tr key={r.bus.id} onClick={() => openUnit(r.bus.id)}><td><b>{r.bus.interno}</b></td><td>{r.bus.unit}</td><td>{fmt(r.km)}</td><td>{fmt(r.lts)}</td><td className="low">{fmt(r.kmpl, 2)}</td><td className="low"><TrendingDown size={12} /> {fmt(((r.kmpl - avgKmpl) / avgKmpl) * 100, 1)}%</td></tr>)}
        {!desvios.length && <tr><td colSpan={6} className="empty-cell">Sin desvíos este mes.</td></tr>}</tbody></table></div></Panel>
    <p className="t-note"><Fuel size={13} /> Datos demostrativos · se reemplazan por el aforo diario de tanques y la app de ingresos de gasoil al conectarlos.</p>
  </div>;
}
