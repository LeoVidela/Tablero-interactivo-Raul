import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, X } from 'lucide-react';
import { MONTH_FULL, MONTH_LABELS, UNIT_COLOR, UNIT_NAMES, UnitFilter } from '../data';
import { AXIS, GRID, TOOLTIP_STYLE, UnitSelector, fmt } from '../ui';
import { useTopEscape } from '../esc';
import { METRICS, MetricKey, Target, metricByUnit, metricSeries } from '../metrics';

const MODULE_LABEL: Record<Target, string> = { Resumen: 'Resumen', Tráfico: 'Tráfico', Flota: 'Flota', Taller: 'Taller', RRHH: 'RR.HH.', Combustible: 'Combustible', Seguridad: 'Siniestros y Seguridad', Pañol: 'Pañol' };

export function MetricDrawer({ k, unit, month = 11, onClose, onGo }: { k: MetricKey; unit: UnitFilter; month?: number; onClose: () => void; onGo: (t: Target, tab: string | undefined, u: UnitFilter) => void }) {
  const def = METRICS[k];
  const [u, setU] = useState<UnitFilter>(unit);
  const [m, setM] = useState(month);
  const ref = useRef<HTMLDivElement>(null); useTopEscape(ref, onClose);
  const series = useMemo(() => metricSeries(k, u), [k, u]);
  const byUnit = useMemo(() => metricByUnit(k, m), [k, m]);
  const cur = series[m].v; const prev = m > 0 ? series[m - 1].v : null;
  const obj = def.obj?.(u);
  const ok = obj ? (obj.max ? cur <= obj.v : cur >= obj.v) : null;
  const d = prev !== null ? cur - prev : null; const dp = prev ? (d! / prev) * 100 : null;
  const good = d === null ? null : d === 0 ? null : (d > 0) === def.goodUp;
  const avg = series.reduce((s, x) => s + x.v, 0) / series.length;
  const best = [...series].sort((a, b) => (def.goodUp ? b.v - a.v : a.v - b.v))[0];
  const maxUnit = Math.max(...byUnit.map((x) => Math.abs(x.v)), 1e-9);
  const isPct = def.fmt(1).includes('%');
  const span = Math.max(...series.map((x) => x.v)) - Math.min(...series.map((x) => x.v));
  const dec = span < 5 ? (span < 0.5 ? 2 : 1) : 0;
  const tick = (v: number) => (Math.abs(v) >= 1e6 ? `${fmt(v / 1e6, 1)}M` : Math.abs(v) >= 1e4 ? `${fmt(v / 1e3, 0)}k` : fmt(v, dec));
  const diffTxt = (x: number) => (isPct ? `${fmt(Math.abs(x), 1)} pp` : def.fmt(Math.abs(x)));

  return <motion.div ref={ref} data-modal="" className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
    <motion.aside className="detail-drawer metric-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 28 }} onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header"><div><span className="section-kicker">{MODULE_LABEL[def.module]} · indicador</span><h2>{def.label}</h2><small>{u === 'Todos' ? 'Todas las unidades de negocio' : u} · {MONTH_FULL[m]}</small></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      <div className="md-units"><UnitSelector value={u} onChange={setU} /></div>
      <div className={`md-hero ${ok === null ? '' : ok ? 'good' : 'bad'}`}>
        <div><span>Valor del mes</span><strong>{def.fmt(cur)}</strong>
          {d !== null && <small className={good === null ? '' : good ? 'up' : 'down'}>{d >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{diffTxt(d)}{!isPct && dp !== null && isFinite(dp) ? ` (${fmt(Math.abs(dp), 1)}%)` : ''} vs. {MONTH_LABELS[m - 1]}</small>}</div>
        {obj && <div className="md-obj"><span>Objetivo</span><b>{obj.txt}</b><em>{ok ? 'En objetivo' : 'Fuera de objetivo'}</em></div>}
      </div>
      <div className="md-stats"><div><span>Promedio 12 meses</span><b>{def.fmt(avg)}</b></div><div><span>Mejor mes</span><b>{best.m} · {def.fmt(best.v)}</b></div></div>

      <h3 className="md-sub">Evolución 12 meses <em>tocá un mes</em></h3>
      <div className="md-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 8, right: 4, left: -14, bottom: 0 }} onClick={(e) => { const i = MONTH_LABELS.indexOf(String(e?.activeLabel)); if (i >= 0) setM(i); }}>
        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} tickFormatter={tick} domain={['auto', 'auto']} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} formatter={(v: number) => [def.fmt(v), def.label]} />
        {obj && <ReferenceLine y={obj.v} stroke="#ef4444" strokeDasharray="4 4" />}
        <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive={false}>{series.map((s) => <Cell key={s.i} fill={s.i === m ? '#ff6b1a' : '#3b82f6'} fillOpacity={s.i === m ? 1 : 0.55} cursor="pointer" />)}</Bar>
      </BarChart></ResponsiveContainer></div>

      <h3 className="md-sub">Por unidad de negocio · {MONTH_LABELS[m]} <em>tocá una para verla</em></h3>
      <ul className="md-units-list">{byUnit.map((x) => <li key={x.u}><button className={u === x.u ? 'on' : ''} onClick={() => setU(u === x.u ? 'Todos' : x.u)}><span><i style={{ background: UNIT_COLOR[x.u] }} />{x.u}</span><div className="md-bar"><div style={{ width: `${(Math.abs(x.v) / maxUnit) * 100}%`, background: UNIT_COLOR[x.u] }} /></div><b>{def.fmt(x.v)}</b></button></li>)}</ul>

      <h3 className="md-sub">Detalle mensual</h3>
      <div className="g-table-wrap"><table className="g-table clickable md-table"><thead><tr><th>Mes</th><th>Valor</th><th>Variación</th>{u === 'Todos' && UNIT_NAMES.map((x) => <th key={x}>{x.split(' ')[0]}</th>)}</tr></thead>
        <tbody>{[...series].reverse().map((s) => { const pv = s.i > 0 ? series[s.i - 1].v : null; const dd = pv !== null ? s.v - pv : null; const g = dd === null || dd === 0 ? null : (dd > 0) === def.goodUp;
          return <tr key={s.i} className={s.i === m ? 'row-active' : ''} onClick={() => setM(s.i)}><td>{MONTH_FULL[s.i]}</td><td><b>{def.fmt(s.v)}</b></td><td className={g === null ? '' : g ? 'ok' : 'low'}>{dd === null ? '—' : `${dd >= 0 ? '+' : '−'}${diffTxt(dd)}`}</td>{u === 'Todos' && UNIT_NAMES.map((x) => <td key={x}>{def.fmt(METRICS[k].get(x, s.i))}</td>)}</tr>; })}</tbody></table></div>

      <p className="md-desc"><Info size={13} /> {def.desc}</p>
      <button className="drawer-cta" onClick={() => onGo(def.module, def.tab, u)}>Ir a {MODULE_LABEL[def.module]}{def.tab ? ` · ${def.tab}` : ''} <ArrowRight size={16} /></button>
    </motion.aside>
  </motion.div>;
}
