import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BusFront, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Download, Droplets, Fuel, Gauge, Hammer, MapPin, Repeat, Route, ShieldCheck, ShoppingCart, Timer, Users, Wallet, Wrench } from 'lucide-react';
import { MONTH_FULL, MONTH_LABELS, UNIT_COLOR, UnitFilter, UnitName, aggregate, hashStr, mulberry32, distribute } from '../data';
import { AXIS, GRID, Panel, TOOLTIP_STYLE, fmt, money, moneyM, pct } from '../ui';
import { ANCHOR_LABEL, Bus, MECHANICS, OT, OTEstado, SECTOR_COLOR, TallerData, makeOT, tallerData, topParts, unitConsumption } from '../taller';
import { BusModal } from './BusModal';

const TABS = ['Resumen general', 'Preventivo', 'Correctivo', 'Reincidencias', 'Productividad', 'Análisis de fallas', 'Repuestos y gastos', 'Combustible', 'Kilómetros', 'Personal taller'] as const;
type Tab = (typeof TABS)[number];
const C = { green: '#22c55e', blue: '#3b82f6', red: '#ef4444', amber: '#f59e0b', gray: '#94a3b8', orange: '#f97316', teal: '#14b8a6', purple: '#a855f7', cyan: '#22d3ee' };
const OT_TONE: Record<OTEstado, string> = { 'En proceso': 'warn', 'Espera repuesto': 'bad', Pendiente: 'warn', Cerrada: 'good' };

function TD({ cur, prev, goodUp = true, mode = 'count' }: { cur: number; prev: number | null; goodUp?: boolean; mode?: 'count' | 'pct' }) {
  if (prev === null) return <span className="delta neutral">s/d</span>;
  const d = cur - prev; const p = prev ? (d / prev) * 100 : 0;
  const zero = Math.abs(p) < 0.05; const good = (d > 0) === goodUp;
  return <span className={`delta ${zero ? 'neutral' : good ? 'up-good' : 'up-bad'}`}>{d >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{mode === 'count' ? `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d))} (${fmt(Math.abs(p), 1)}%)` : `${p >= 0 ? '+' : '−'}${fmt(Math.abs(p), 1)}%`}<em>vs. mes ant.</em></span>;
}
function Tile({ icon: Icon, label, value, sub, color, children }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; color: string; children?: React.ReactNode }) {
  return <div className="t-tile" style={{ ['--tone' as string]: color }}><div className="t-tile-top"><span className="t-tile-icon"><Icon size={19} /></span><span className="t-tile-label">{label}</span></div><div className="t-tile-value"><strong>{value}</strong>{sub && <small>{sub}</small>}</div>{children}</div>;
}
function Donut({ data, center, sub }: { data: { name: string; value: number; color: string }[]; center: string; sub?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return <div className="t-donut"><div className="t-donut-chart"><PieChart width={150} height={150}><Pie data={data} dataKey="value" innerRadius="66%" outerRadius="94%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${fmt(v)} (${fmt((v / total) * 100, 1)}%)`, n]} /></PieChart><div className="t-donut-center"><strong>{center}</strong>{sub && <span>{sub}</span>}</div></div>
    <ul className="t-legend">{data.map((d) => <li key={d.name}><i style={{ background: d.color }} />{d.name}<b>{fmt(d.value)}</b><em>{fmt((d.value / total) * 100, 1)}%</em></li>)}</ul></div>;
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((Math.PI * a) / 180), cy - r * Math.sin((Math.PI * a) / 180)];
  const [x0, y0] = p(a0); const [x1, y1] = p(a1);
  return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
}
function GaugeHealth({ v, exc, att, crit }: { v: number; exc: number; att: number; crit: number }) {
  const ang = 180 - v * 1.8; const nx = 110 + 66 * Math.cos((Math.PI * ang) / 180); const ny = 108 - 66 * Math.sin((Math.PI * ang) / 180);
  return <div className="t-gauge"><div className="t-gauge-dial"><svg viewBox="0 0 220 132" role="img" aria-label={`Índice de salud de la flota ${v}`}>
    <path d={arc(110, 108, 84, 180, 180 - 69 * 1.8)} stroke={C.red} strokeWidth="16" fill="none" /><path d={arc(110, 108, 84, 180 - 70 * 1.8, 180 - 89 * 1.8)} stroke={C.amber} strokeWidth="16" fill="none" /><path d={arc(110, 108, 84, 180 - 90 * 1.8, 0)} stroke={C.green} strokeWidth="16" fill="none" />
    <line x1="110" y1="108" x2={nx} y2={ny} stroke="#fff" strokeWidth="4" strokeLinecap="round" /><circle cx="110" cy="108" r="9" fill="#0b1020" stroke="#fff" strokeWidth="3" />
    <text x="110" y="62" textAnchor="middle" fontSize="10" fill="#7f8aa3">ÍNDICE PROMEDIO</text></svg>
    <div className="t-gauge-value">{v}</div></div>
    <ul className="t-legend compact"><li><i style={{ background: C.green }} />Excelente (90-100)<b>{exc} un.</b></li><li><i style={{ background: C.amber }} />Atención (70-89)<b>{att} un.</b></li><li><i style={{ background: C.red }} />Crítico (0-69)<b>{crit} un.</b></li></ul></div>;
}
function Bars({ rows, color, fmtV, onClick }: { rows: { key: string; label: React.ReactNode; value: number; color?: string; extra?: React.ReactNode }[]; color: string; fmtV: (v: number) => string; onClick?: (key: string) => void }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return <ul className="t-hbars">{rows.map((r) => <li key={r.key} className={onClick ? 'clickable' : ''} onClick={() => onClick?.(r.key)}><span className="t-hbar-label">{r.label}</span><div className="t-hbar-track"><div style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color }} /></div><b>{fmtV(r.value)}</b>{r.extra}</li>)}</ul>;
}
const Tip = <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} />;

export function TallerView({ unit, notify }: { unit: UnitFilter; notify: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>('Resumen general');
  const [m, setM] = useState(11);
  const [sel, setSel] = useState<{ bus: Bus; ot?: OT } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const d = useMemo(() => tallerData(unit, m), [unit, m]);
  const series = useMemo(() => MONTH_LABELS.map((lb, i) => { const a = aggregate(unit, [i]); const g = a.cost * a.kmExec; return { m: lb, closed: a.otClosed, open: a.otOpen, prev: +((a.prevDone / (a.prevDone + a.prevPend)) * 100).toFixed(1), rep: g * 0.788, mant: g, comb: a.lts * 31, km: a.kmExec, lts: a.lts, repT: +a.repTime.toFixed(1), cost: +a.cost.toFixed(2), kmpl: +(a.kmExec / a.lts).toFixed(2), repKm: +(a.cost * 0.788).toFixed(2), mantKm: +(a.cost * 0.212).toFixed(2) }; }), [unit]);
  const a = d.agg; const p = d.prev;
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const openBus = (bus: Bus, ot?: OT) => setSel({ bus, ot });
  const prevOT = (row: { bus: Bus; programado: string }, i: number) => makeOT(row.bus, 'prev', 500 + i, 'Pendiente', 2, { text: `Preventivo · ${row.programado}`, sector: 'Motor', anchor: 'motor' });
  const prevDonePct = (a.prevDone / (a.prevDone + a.prevPend)) * 100;
  const pMonth = MONTH_FULL[m];

  // ---------- bloques ----------
  const Kpis = ({ keys }: { keys: string[] }) => {
    const all: Record<string, React.ReactNode> = {
      total: <Tile key="total" icon={BusFront} label="Flota total" value={a.total} sub="unidades" color={C.blue} />,
      oper: <Tile key="oper" icon={CheckCircle2} label="Operativas" value={a.oper} sub={pct((a.oper / a.total) * 100)} color={C.green}><TD cur={a.oper} prev={p ? p.oper : null} /></Tile>,
      out: <Tile key="out" icon={Wrench} label="Fuera de servicio" value={a.out} sub={pct((a.out / a.total) * 100)} color={C.red}><TD cur={a.out} prev={p ? p.out : null} goodUp={false} /></Tile>,
      open: <Tile key="open" icon={ClipboardList} label="OT abiertas" value={a.otOpen} color={C.orange}><TD cur={a.otOpen} prev={p ? p.otOpen : null} goodUp={false} /></Tile>,
      closed: <Tile key="closed" icon={CheckCircle2} label="OT cerradas (mes)" value={a.otClosed} color={C.purple}><TD cur={a.otClosed} prev={p ? p.otClosed : null} /></Tile>,
      pdone: <Tile key="pdone" icon={ShieldCheck} label="Preventivos ejecutados" value={a.prevDone} sub={pct(prevDonePct)} color={C.teal}><TD cur={a.prevDone} prev={p ? p.prevDone : null} /></Tile>,
      ppend: <Tile key="ppend" icon={Timer} label="Preventivos pendientes" value={a.prevPend} sub={pct(100 - prevDonePct)} color={C.amber}><TD cur={a.prevPend} prev={p ? p.prevPend : null} goodUp={false} /></Tile>,
      reinc: <Tile key="reinc" icon={Repeat} label="Reincidencias" value={a.reinc} color={C.red}><TD cur={a.reinc} prev={p ? p.reinc : null} goodUp={false} /></Tile>,
      itc: <Tile key="itc" icon={CalendarDays} label="ITC por vencer" value={a.itc30} color={C.blue}><TD cur={a.itc30} prev={p ? p.itc30 : null} goodUp={false} /></Tile>,
      time: <Tile key="time" icon={Timer} label="Tiempo prom. reparación" value={`${fmt(a.repTime, 1)} h`} color={C.cyan}><TD cur={a.repTime} prev={p ? p.repTime : null} goodUp={false} mode="pct" /></Tile>,
      pers: <Tile key="pers" icon={Users} label="Personal de taller" value={a.personal} color={C.blue}><TD cur={a.personal} prev={p ? p.personal : null} /></Tile>,
      hs: <Tile key="hs" icon={Timer} label="Horas taller totales" value={fmt(a.horas)} sub="hs" color={C.orange}><TD cur={a.horas} prev={p ? p.horas : null} mode="pct" /></Tile>,
      hpp: <Tile key="hpp" icon={Gauge} label="Horas prom. por persona" value={fmt(a.horas / a.personal, 1)} sub="hs" color={C.teal} />,
      itcv: <Tile key="itcv" icon={AlertTriangle} label="ITC vencidos" value={a.itcVenc} color={C.red}><TD cur={a.itcVenc} prev={p ? p.itcVenc : null} goodUp={false} /></Tile>,
      pcum: <Tile key="pcum" icon={ShieldCheck} label="Cumplimiento preventivos" value={pct(prevDonePct)} color={C.green} />,
    };
    return <section className="t-kpis">{keys.map((k) => all[k])}</section>;
  };
  const EstadoDonut = () => <Panel kicker="Flota" title="Estado general de la flota"><Donut center={String(a.total)} sub="TOTAL" data={[{ name: 'Operativas', value: a.oper, color: C.green }, { name: 'En reparación', value: a.enRep, color: C.red }, { name: 'Esperando repuestos', value: a.espRep, color: C.amber }, { name: 'Fuera de servicio', value: a.fuera, color: C.gray }]} /></Panel>;
  const EvolOT = () => <Panel kicker="12 meses" title="Evolución de OT"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={series} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis yAxisId="l" axisLine={false} tickLine={false} tick={AXIS} /><YAxis yAxisId="r" orientation="right" axisLine={false} tickLine={false} tick={AXIS} />{Tip}<Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#8c96ac' }} /><Bar yAxisId="l" dataKey="closed" name="OT cerradas" fill={C.blue} radius={[4, 4, 0, 0]} /><Line yAxisId="r" dataKey="open" name="OT abiertas" stroke={C.orange} strokeWidth={2.5} dot={{ r: 3, fill: '#0b1020', stroke: C.orange, strokeWidth: 2 }} /></ComposedChart></ResponsiveContainer></div></Panel>;
  const CumplPrev = () => <Panel kicker="12 meses" title="Cumplimiento de preventivos"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis domain={[60, 100]} axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${v}%`} />{Tip}<Line dataKey="prev" name="Cumplimiento" stroke={C.green} strokeWidth={2.5} dot={{ r: 3, fill: '#0b1020', stroke: C.green, strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div></Panel>;
  const ITC = () => <Panel kicker="Vencimientos" title="ITC / vencimientos"><Donut center={String(a.itcVenc + a.itc30 + a.itc60)} sub="TOTAL" data={[{ name: 'Vencidos', value: a.itcVenc, color: C.red }, { name: 'Por vencer (30 días)', value: a.itc30, color: C.orange }, { name: 'Por vencer (31-60 días)', value: a.itc60, color: C.amber }, { name: 'OK', value: Math.max(0, a.total - a.itcVenc - a.itc30 - a.itc60), color: C.green }]} /></Panel>;
  const Pendientes = ({ all }: { all?: boolean } = {}) => { const show = all || open.pend ? d.pendientes : d.pendientes.slice(0, 5); return <Panel kicker="Preventivo" title="Preventivos pendientes / vencidos" className="t-green"><div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Int.</th><th>Dominio</th><th>Km actual</th><th>Preventivo</th><th>Debía hacerse</th><th>Estado</th><th>Plazo</th></tr></thead><tbody>{show.map((r, i) => <tr key={r.bus.id} onClick={() => openBus(r.bus, prevOT(r, i))}><td><b>{r.bus.interno}</b></td><td>{r.bus.dominio}</td><td>{fmt(r.bus.km)}</td><td>{r.programado}</td><td>{r.debia}</td><td><span className={`pill mini ${r.estado === 'VENCIDO' ? 'bad' : r.estado === 'POR VENCER' ? 'warn' : 'good'}`}>{r.estado}</span></td><td className={r.estado === 'VENCIDO' ? 'low' : ''}>{r.estado === 'VENCIDO' ? `+${r.dias} d` : `en ${r.dias} d`}</td></tr>)}</tbody></table></div>{!all && <button className="t-more" onClick={() => toggle('pend')}>{open.pend ? 'Ver menos' : `Ver todas las pendientes (${d.pendientes.length})`} <ChevronRight size={14} /></button>}</Panel>; };
  const Abiertas = ({ all }: { all?: boolean } = {}) => { const show = all || open.ot ? d.abiertas : d.abiertas.slice(0, 5); return <Panel kicker="Correctivo" title="OT correctivas abiertas" className="t-orange"><div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>OT N°</th><th>Int.</th><th>Sector</th><th>Problema reportado</th><th>Mecánico</th><th>Horas</th><th>Estado</th></tr></thead><tbody>{show.map((o) => <tr key={o.id} onClick={() => openBus(o.bus, o)}><td><b>{o.id}</b></td><td>{o.bus.interno}</td><td><span className="sector-tag"><i style={{ background: SECTOR_COLOR[o.sector] }} />{o.sector}</span></td><td>{o.problem}</td><td>{o.mecanico}</td><td>{fmt(o.horas, 1)}</td><td><span className={`pill mini ${OT_TONE[o.estado]}`}>{o.estado}</span></td></tr>)}</tbody></table></div>{!all && <button className="t-more" onClick={() => toggle('ot')}>{open.ot ? 'Ver menos' : `Ver todas las OT abiertas (${d.abiertas.length})`} <ChevronRight size={14} /></button>}</Panel>; };
  const Top = ({ all }: { all?: boolean } = {}) => { const rows = all || open.top ? d.top : d.top.slice(0, 5); return <Panel kicker="12 meses" title="Top unidades con más OT" className="t-red"><Bars color={C.red} fmtV={(v) => String(v)} rows={rows.map((b) => ({ key: b.id, label: <><b>{b.interno}</b><small>{b.dominio}</small></>, value: b.ot12 }))} onClick={(k) => openBus(d.top.find((b) => b.id === k)!)} />{!all && <button className="t-more" onClick={() => toggle('top')}>{open.top ? 'Ver menos' : 'Ver ranking completo'} <ChevronRight size={14} /></button>}</Panel>; };
  const Reinc = ({ all }: { all?: boolean } = {}) => { const rows = all || open.reinc ? d.reinc : d.reinc.slice(0, 5); return <Panel kicker="Calidad" title="Reincidencias más frecuentes"><div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Int.</th><th>Sector</th><th>Problema</th><th>Veces</th><th>Última</th></tr></thead><tbody>{rows.map((r, i) => <tr key={r.bus.id + i} onClick={() => openBus(r.bus, makeOT(r.bus, 'reinc', 700 + i, 'Cerrada', 6 + i, { text: r.problem, sector: r.sector, anchor: r.anchor }))}><td><b>{r.bus.interno}</b></td><td><span className="sector-tag"><i style={{ background: SECTOR_COLOR[r.sector] }} />{r.sector}</span></td><td>{r.problem}</td><td className="low">{r.veces}</td><td>{r.ultima}</td></tr>)}</tbody></table></div>{!all && <button className="t-more" onClick={() => toggle('reinc')}>{open.reinc ? 'Ver menos' : `Ver todas las reincidencias (${d.reinc.length})`} <ChevronRight size={14} /></button>}</Panel>; };
  const Fallas = () => <Panel kicker="12 meses" title="Fallas por sector"><Donut center={fmt(d.sectors.reduce((s, r) => s + r.count, 0))} sub="OT" data={d.sectors.map((r) => ({ name: r.sector, value: r.count, color: SECTOR_COLOR[r.sector] }))} /></Panel>;
  const TiempoRep = () => <Panel kicker="12 meses" title="Tiempo promedio de reparación (horas)"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis domain={[3, 6]} axisLine={false} tickLine={false} tick={AXIS} />{Tip}<Line dataKey="repT" name="Horas" stroke={C.blue} strokeWidth={2.5} dot={{ r: 3, fill: '#0b1020', stroke: C.blue, strokeWidth: 2 }} /></LineChart></ResponsiveContainer></div></Panel>;
  const CostoSector = () => <Panel kicker="12 meses" title="Costo estimado por sector"><Bars color={C.blue} fmtV={moneyM} rows={d.sectors.map((r) => ({ key: r.sector, label: r.sector, value: r.cost, color: SECTOR_COLOR[r.sector] }))} /></Panel>;
  const Salud = () => <Panel kicker="Flota" title="Salud de la flota (índice)"><GaugeHealth v={d.salud.avg} exc={d.salud.exc} att={d.salud.att} crit={d.salud.crit} /></Panel>;

  const areas = useMemo(() => { const r = mulberry32(hashStr(`areas-${unit}-${m}`)); const w = [44.5, 25.3, 17.6, 8.1, 4.5].map((x) => x * (0.96 + r() * 0.08)); const hs = distribute(a.horas, w); return ['Mecánica', 'Electricidad', 'Carrocería', 'Neumáticos', 'Otros'].map((n, i) => ({ n, h: hs[i] })); }, [unit, m, a.horas]);
  const Personal = () => <Panel kicker="Recursos" title={`Personal de taller · ${pMonth}`}><div className="t-personal"><div><Users size={18} /><span>Personal total</span><b>{a.personal}</b></div><div><Timer size={18} /><span>Horas totales</span><b>{fmt(a.horas)}</b></div><div><Gauge size={18} /><span>Horas prom. por persona</span><b>{fmt(a.horas / a.personal, 1)}</b></div></div><h4 className="t-sub">Distribución de horas por área</h4><Bars color={C.blue} fmtV={(v) => `${fmt((v / a.horas) * 100, 1)}%`} rows={areas.map((x) => ({ key: x.n, label: x.n, value: x.h, extra: <em className="t-hbar-extra">{fmt(x.h)} h</em> }))} /></Panel>;

  // ---------- consumos ----------
  const gasto = d.total; const pg = p ? tallerData(unit, m - 1).total : null;
  const cons = useMemo(() => unitConsumption(d), [d]);
  const parts = useMemo(() => topParts(gasto.repuestos), [gasto.repuestos]);
  const spark = (key: 'cost' | 'kmpl' | 'repKm' | 'mantKm' | 'prev', color: string) => <div className="t-spark"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><Line dataKey={key} stroke={color} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>;
  const GastoTiles = () => <section className="t-kpis money">
    <Tile icon={ShoppingCart} label="Gasto total repuestos" value={money(gasto.repuestos, 0)} color={C.green}><TD cur={gasto.repuestos} prev={pg ? pg.repuestos : null} goodUp={false} mode="pct" /></Tile>
    <Tile icon={Wrench} label="Gasto total mantenimiento" value={money(gasto.gasto, 0)} color={C.blue}><TD cur={gasto.gasto} prev={pg ? pg.gasto : null} goodUp={false} mode="pct" /></Tile>
    <Tile icon={Route} label="Km recorridos" value={`${fmt(a.kmExec)} km`} color={C.purple}><TD cur={a.kmExec} prev={p ? p.kmExec : null} mode="pct" /></Tile>
    <Tile icon={Fuel} label="Combustible consumido" value={`${fmt(a.lts)} Lts`} color={C.orange}><TD cur={a.lts} prev={p ? p.lts : null} goodUp={false} mode="pct" /></Tile>
    <Tile icon={Users} label="N° personal taller" value={a.personal} color={C.blue}><TD cur={a.personal} prev={p ? p.personal : null} /></Tile>
    <Tile icon={Timer} label="Horas taller totales" value={`${fmt(a.horas)} hs`} color={C.orange}><TD cur={a.horas} prev={p ? p.horas : null} mode="pct" /></Tile>
    <Tile icon={Wallet} label="Costo por km" value={money(a.cost)} color={C.green}><TD cur={a.cost} prev={p ? p.cost : null} goodUp={false} mode="pct" /></Tile>
  </section>;
  const GastoEvol = ({ which }: { which: 'gastos' | 'km' | 'lts' }) => <Panel kicker="12 meses" title={which === 'gastos' ? 'Evolución de gastos' : which === 'km' ? 'Kilómetros recorridos' : 'Combustible consumido'}><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%">{which === 'gastos'
    ? <LineChart data={series} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `$ ${fmt(v / 1e6, 0)} M`} /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [moneyM(v), n]} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#8c96ac' }} /><Line dataKey="rep" name="Repuestos" stroke={C.green} strokeWidth={2.5} dot={false} /><Line dataKey="mant" name="Mantenimiento" stroke={C.blue} strokeWidth={2.5} dot={false} /><Line dataKey="comb" name="Combustible" stroke={C.orange} strokeWidth={2.5} dot={false} /></LineChart>
    : <BarChart data={series} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => (v >= 1e6 ? `${fmt(v / 1e6, 1)} M` : `${fmt(v / 1e3, 0)} K`)} /><Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v: number) => [fmt(v), which === 'km' ? 'Km' : 'Litros']} /><Bar dataKey={which} fill={which === 'km' ? C.blue : C.orange} radius={[4, 4, 0, 0]} /></BarChart>}</ResponsiveContainer></div></Panel>;
  const Repuestos = () => <Panel kicker={pMonth} title="Consumo de repuestos · Top 10 por importe"><div className="g-table-wrap tall"><table className="g-table"><thead><tr><th>Código</th><th>Descripción del repuesto</th><th>Cant.</th><th>Precio unit.</th><th>Importe total</th><th>% del total</th></tr></thead><tbody>{parts.map((r) => <tr key={r.code}><td>{r.code}</td><td>{r.desc}</td><td>{fmt(r.qty)}</td><td>{money(r.price, 0)}</td><td>{money(r.importe, 0)}</td><td>{fmt(r.share, 2)}%</td></tr>)}</tbody><tfoot><tr><td /><td>TOTALES</td><td>{fmt(parts.reduce((s, r) => s + r.qty, 0))}</td><td /><td>{money(parts.reduce((s, r) => s + r.importe, 0), 0)}</td><td>{fmt(parts.reduce((s, r) => s + r.share, 0), 1)}%</td></tr></tfoot></table></div></Panel>;
  const ResumenGastos = () => <Panel kicker={pMonth} title="Resumen de gastos del mes"><Donut center={moneyM(gasto.gasto)} sub="TOTAL" data={[{ name: 'Repuestos', value: gasto.repuestos, color: C.green }, { name: 'Mano de obra taller', value: gasto.mo, color: C.blue }, { name: 'Combustible taller', value: gasto.comb, color: C.orange }, { name: 'Otros gastos (herramientas, etc.)', value: gasto.otros, color: C.gray }]} /><ul className="t-money">{[['Repuestos', gasto.repuestos], ['Mano de obra taller', gasto.mo], ['Combustible taller', gasto.comb], ['Otros gastos', gasto.otros]].map(([n, v]) => <li key={n as string}><span>{n}</span><b>{money(v as number, 0)}</b></li>)}<li className="total"><span>TOTAL GASTOS</span><b>{money(gasto.gasto, 0)}</b></li></ul></Panel>;
  const Consumos = ({ n = 5 }: { n?: number } = {}) => <Panel kicker={pMonth} title="Consumos por unidad"><div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Int.</th><th>Dominio</th><th>Modelo</th><th>Km</th><th>Litros</th><th>Km/l</th><th>Repuestos</th><th>Mantenim.</th><th>Total</th><th>$ / km</th><th>OT P/C</th><th>Estado</th></tr></thead><tbody>{cons.slice(0, n).map((r) => <tr key={r.bus.id} onClick={() => openBus(r.bus)}><td><b>{r.bus.interno}</b></td><td>{r.bus.dominio}</td><td>{r.bus.modelo}</td><td>{fmt(r.km)}</td><td>{fmt(r.lts)}</td><td>{fmt(r.kmpl, 2)}</td><td>{money(r.rep, 0)}</td><td>{money(r.mant, 0)}</td><td>{money(r.total, 0)}</td><td>{money(r.cpk, 2)}</td><td>{r.prev} / {r.corr}</td><td><span className={`pill mini ${r.bus.estado === 'Operativa' ? 'good' : 'warn'}`}>{r.bus.estado === 'Operativa' ? 'Operativa' : 'En reparación'}</span></td></tr>)}</tbody></table></div></Panel>;
  const Claves = () => <Panel kicker="Tendencia 12 meses" title="Indicadores clave"><ul className="t-claves">{([['Costo por km', money(a.cost), 'cost', C.green], ['Km por litro', fmt(a.kmExec / a.lts, 2), 'kmpl', C.blue], ['Gasto repuestos / km', money(a.cost * 0.788), 'repKm', C.purple], ['Gasto mantenimiento / km', money(a.cost * 0.212), 'mantKm', C.orange], ['% preventivos cumplidos', pct(prevDonePct), 'prev', C.teal]] as [string, string, 'cost' | 'kmpl' | 'repKm' | 'mantKm' | 'prev', string][]).map(([l, v, k, c]) => <li key={l}><span>{l}</span><b>{v}</b>{spark(k, c)}</li>)}</ul></Panel>;
  const Mecanicos = () => { const r = mulberry32(hashStr(`mec-${unit}-${m}`)); const w = MECHANICS.map(() => 0.8 + r() * 0.5); const ots = distribute(a.otClosed, w); const hs = distribute(a.horas, w); return <Panel kicker={pMonth} title="Productividad por mecánico"><div className="g-table-wrap tall"><table className="g-table"><thead><tr><th>Mecánico</th><th>OT cerradas</th><th>Horas</th><th>Horas / OT</th></tr></thead><tbody>{MECHANICS.map((n, i) => <tr key={n}><td><b>{n}</b></td><td>{ots[i]}</td><td>{fmt(hs[i])}</td><td>{fmt(hs[i] / Math.max(1, ots[i]), 1)}</td></tr>)}</tbody></table></div></Panel>; };
  const Combustible = () => <Panel kicker={pMonth} title="Rendimiento de combustible por unidad"><Bars color={C.orange} fmtV={(v) => `${fmt(v, 2)} km/l`} rows={[...cons].sort((x, y) => y.kmpl - x.kmpl).slice(0, 10).map((r) => ({ key: r.bus.id, label: <><b>{r.bus.interno}</b><small>{fmt(r.lts)} L</small></>, value: r.kmpl }))} onClick={(k) => openBus(cons.find((r) => r.bus.id === k)!.bus)} /></Panel>;
  const Kms = () => <Panel kicker={pMonth} title="Kilómetros por unidad (top 10)"><Bars color={C.purple} fmtV={(v) => `${fmt(v)} km`} rows={[...cons].sort((x, y) => y.km - x.km).slice(0, 10).map((r) => ({ key: r.bus.id, label: <><b>{r.bus.interno}</b><small>{r.bus.dominio}</small></>, value: r.km }))} onClick={(k) => openBus(cons.find((r) => r.bus.id === k)!.bus)} /></Panel>;

  const unitsTxt = unit === 'Todos' ? 'Todas las unidades' : unit;
  return <div className="taller">
    <section className="t-header">
      <div className="t-title"><span className="t-title-icon"><Wrench size={24} /></span><div><span className="section-kicker">Control integral del taller</span><h2>Taller & Mantenimiento</h2><p><MapPin size={12} /> {unitsTxt}{unit === 'Todos' && <span className="t-dots">{(['Córdoba', 'Comodoro', 'San Luis', 'Villa Mercedes'] as UnitName[]).map((u) => <i key={u} style={{ background: UNIT_COLOR[u] }} />)}</span>}</p></div></div>
      <div className="t-header-tools"><label className="g-select"><CalendarDays size={16} /><span>Mes seleccionado<select value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTH_FULL.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></span></label><button className="export-button" onClick={() => notify('Reporte de Taller preparado: la descarga comenzará en breve')}><Download size={15} /> Exportar</button></div>
    </section>
    <nav className="t-tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>

    {tab === 'Resumen general' && <>
      {Kpis({ keys: ['total', 'oper', 'out', 'open', 'closed', 'pdone', 'ppend', 'reinc', 'itc'] })}
      <section className="t-grid-4">{EstadoDonut()}{EvolOT()}{CumplPrev()}{ITC()}</section>
      <section className="t-grid-3">{Pendientes()}{Abiertas()}{Top()}</section>
      <section className="t-grid-5">{Reinc()}{Fallas()}{TiempoRep()}{CostoSector()}{Salud()}</section>
    </>}
    {tab === 'Preventivo' && <>{Kpis({ keys: ['pdone', 'ppend', 'pcum', 'itcv', 'itc'] })}<section className="t-grid-3 wide">{CumplPrev()}{ITC()}{EstadoDonut()}</section>{Pendientes({ all: true })}</>}
    {tab === 'Correctivo' && <>{Kpis({ keys: ['open', 'closed', 'time', 'reinc'] })}<section className="t-grid-3 wide">{EvolOT()}{TiempoRep()}{Top()}</section>{Abiertas({ all: true })}</>}
    {tab === 'Reincidencias' && <>{Kpis({ keys: ['reinc', 'open', 'time'] })}<section className="t-grid-3 wide">{Fallas()}{Top({ all: true })}{Salud()}</section>{Reinc({ all: true })}</>}
    {tab === 'Productividad' && <>{Kpis({ keys: ['closed', 'time', 'pers', 'hs', 'hpp'] })}<section className="t-grid-3 wide">{EvolOT()}{TiempoRep()}{Personal()}</section>{Mecanicos()}</>}
    {tab === 'Análisis de fallas' && <>{Kpis({ keys: ['reinc', 'open', 'time'] })}<section className="t-grid-3 wide">{Fallas()}{CostoSector()}{Salud()}</section>{Reinc({ all: true })}</>}
    {tab === 'Repuestos y gastos' && <>{GastoTiles()}<section className="t-grid-3 wide">{GastoEvol({ which: "gastos" })}{GastoEvol({ which: "km" })}{GastoEvol({ which: "lts" })}</section><section className="t-grid-3 mix">{Repuestos()}{ResumenGastos()}{Personal()}</section><section className="t-grid-2">{Consumos()}{Claves()}</section></>}
    {tab === 'Combustible' && <>{GastoTiles()}<section className="t-grid-3 wide">{GastoEvol({ which: "lts" })}{Combustible()}{Claves()}</section>{Consumos({ n: 10 })}</>}
    {tab === 'Kilómetros' && <>{GastoTiles()}<section className="t-grid-3 wide">{GastoEvol({ which: "km" })}{Kms()}{Claves()}</section>{Consumos({ n: 10 })}</>}
    {tab === 'Personal taller' && <>{Kpis({ keys: ['pers', 'hs', 'hpp', 'closed', 'time'] })}<section className="t-grid-3 wide">{Personal()}{EvolOT()}{TiempoRep()}</section>{Mecanicos()}</>}

    <p className="t-note"><Droplets size={13} /> Datos demostrativos · se actualizan diariamente con los datos del sistema de taller (Emenuve). Tocá cualquier OT, unidad o preventivo para abrir la ficha del coche.</p>
    <AnimatePresence>{sel && <BusModal key={sel.bus.id + (sel.ot?.id ?? '')} bus={sel.bus} ot={sel.ot} onClose={() => setSel(null)} notify={notify} />}</AnimatePresence>
  </div>;
}
