import React from 'react';
import { Bar, Cell, Pie, PieChart, Tooltip } from 'recharts';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { fmt } from '../ui';
import { TOOLTIP_STYLE } from '../ui';

export const C = { green: '#22c55e', blue: '#3b82f6', red: '#ef4444', amber: '#f59e0b', gray: '#94a3b8', orange: '#f97316', teal: '#14b8a6', purple: '#a855f7', cyan: '#22d3ee' };
export function TD({ cur, prev, goodUp = true, mode = 'count' }: { cur: number; prev: number | null; goodUp?: boolean; mode?: 'count' | 'pct' }) {
  if (prev === null) return <span className="delta neutral">s/d</span>;
  const d = cur - prev; const p = prev ? (d / prev) * 100 : 0;
  const zero = Math.abs(p) < 0.05; const good = (d > 0) === goodUp;
  return <span className={`delta ${zero ? 'neutral' : good ? 'up-good' : 'up-bad'}`}>{d >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{mode === 'count' ? `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmt(Math.abs(d))} (${fmt(Math.abs(p), 1)}%)` : `${p >= 0 ? '+' : '−'}${fmt(Math.abs(p), 1)}%`}<em>vs. mes ant.</em></span>;
}
export function Tile({ icon: Icon, label, value, sub, color, children }: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; color: string; children?: React.ReactNode }) {
  return <div className="t-tile" style={{ ['--tone' as string]: color }}><div className="t-tile-top"><span className="t-tile-icon"><Icon size={19} /></span><span className="t-tile-label">{label}</span></div><div className="t-tile-value"><strong>{value}</strong>{sub && <small>{sub}</small>}</div>{children}</div>;
}
export function Donut({ data, center, sub }: { data: { name: string; value: number; color: string }[]; center: string; sub?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return <div className="t-donut"><div className="t-donut-chart"><PieChart width={150} height={150}><Pie data={data} dataKey="value" innerRadius="66%" outerRadius="94%" paddingAngle={2} stroke="none" animationDuration={550} startAngle={90} endAngle={-270}>{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${fmt(v)} (${fmt((v / total) * 100, 1)}%)`, n]} /></PieChart><div className="t-donut-center"><strong>{center}</strong>{sub && <span>{sub}</span>}</div></div>
    <ul className="t-legend">{data.map((d) => <li key={d.name}><i style={{ background: d.color }} />{d.name}<b>{fmt(d.value)}</b><em>{fmt((d.value / total) * 100, 1)}%</em></li>)}</ul></div>;
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos((Math.PI * a) / 180), cy - r * Math.sin((Math.PI * a) / 180)];
  const [x0, y0] = p(a0); const [x1, y1] = p(a1);
  return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
}
export function GaugeHealth({ v, exc, att, crit }: { v: number; exc: number; att: number; crit: number }) {
  const ang = 180 - v * 1.8; const nx = 110 + 66 * Math.cos((Math.PI * ang) / 180); const ny = 108 - 66 * Math.sin((Math.PI * ang) / 180);
  return <div className="t-gauge"><div className="t-gauge-dial"><svg viewBox="0 0 220 132" role="img" aria-label={`Índice de salud de la flota ${v}`}>
    <path d={arc(110, 108, 84, 180, 180 - 69 * 1.8)} stroke={C.red} strokeWidth="16" fill="none" /><path d={arc(110, 108, 84, 180 - 70 * 1.8, 180 - 89 * 1.8)} stroke={C.amber} strokeWidth="16" fill="none" /><path d={arc(110, 108, 84, 180 - 90 * 1.8, 0)} stroke={C.green} strokeWidth="16" fill="none" />
    <line x1="110" y1="108" x2={nx} y2={ny} stroke="#fff" strokeWidth="4" strokeLinecap="round" /><circle cx="110" cy="108" r="9" fill="#0b1020" stroke="#fff" strokeWidth="3" />
    <text x="110" y="62" textAnchor="middle" fontSize="10" fill="#7f8aa3">ÍNDICE PROMEDIO</text></svg>
    <div className="t-gauge-value">{v}</div></div>
    <ul className="t-legend compact"><li><i style={{ background: C.green }} />Excelente (90-100)<b>{exc} un.</b></li><li><i style={{ background: C.amber }} />Atención (70-89)<b>{att} un.</b></li><li><i style={{ background: C.red }} />Crítico (0-69)<b>{crit} un.</b></li></ul></div>;
}
export function Bars({ rows, color, fmtV, onClick }: { rows: { key: string; label: React.ReactNode; value: number; color?: string; extra?: React.ReactNode }[]; color: string; fmtV: (v: number) => string; onClick?: (key: string) => void }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return <ul className="t-hbars">{rows.map((r) => <li key={r.key} className={onClick ? 'clickable' : ''} onClick={() => onClick?.(r.key)}><span className="t-hbar-label">{r.label}</span><div className="t-hbar-track"><div style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color }} /></div><b>{fmtV(r.value)}</b>{r.extra}</li>)}</ul>;
}
export const Tip = <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} />;
