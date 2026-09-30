import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { UNIT_COLOR, UNIT_FILTERS, DeltaKind, Sem, UnitFilter, UnitName } from './data';

export const fmt = (v: number, d = 0) => v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (v: number, d = 1) => `${fmt(v, d)}%`;
export const money = (v: number, d = 2) => `$ ${fmt(v, d)}`;
export const moneyM = (v: number) => `$ ${fmt(v / 1_000_000, 1)} M`;
export const signed = (v: number, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), d)}`;

export const AXIS = { fill: 'var(--ax)', fontSize: 11 } as const;
export const GRID = 'var(--grid)';
export const TOOLTIP_STYLE = { background: 'var(--tip-bg)', border: '1px solid var(--tip-bd)', borderRadius: 12, color: 'var(--tip-fg)', fontSize: 12 } as const;

export function UnitSelector({ value, onChange }: { value: UnitFilter; onChange: (u: UnitFilter) => void }) {
  return <div className="unit-selector" role="tablist" aria-label="Unidad de negocio">
    {UNIT_FILTERS.map((u) => <button key={u} role="tab" aria-selected={value === u} className={value === u ? 'active' : ''} onClick={() => onChange(u)}>
      {u !== 'Todos' && <i style={{ background: UNIT_COLOR[u as UnitName] }} />}{u}
    </button>)}
  </div>;
}

export function DeltaChip({ value, kind, goodUp = true, digits = 1, suffix, label = 'vs. período anterior' }: { value: number | null; kind: DeltaKind; goodUp?: boolean; digits?: number; suffix?: string; label?: string }) {
  if (value === null || !isFinite(value)) return <span className="delta neutral"><Minus size={11} /> s/d</span>;
  const zero = Math.abs(value) < Math.pow(10, -digits) / 2;
  const good = zero ? null : (value > 0) === goodUp;
  const unit = suffix ?? (kind === 'pp' ? ' pp' : kind === 'pct' ? '%' : '');
  return <span className={`delta ${zero ? 'neutral' : good ? 'up-good' : 'up-bad'}`}>
    {value >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{signed(value, kind === 'abs' ? 0 : digits)}{unit}
    {label && <em>{label}</em>}
  </span>;
}

export function SemDot({ sem }: { sem: Sem }) { return <i className={`sem sem-${sem}`} aria-label={sem === 'good' ? 'En objetivo' : sem === 'warn' ? 'Atención' : 'Fuera de objetivo'} />; }

export function Panel({ title, kicker, right, children, className = '' }: { title?: React.ReactNode; kicker?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <div className={`panel g-panel ${className}`}>
    {(title || right) && <div className="g-panel-head"><div>{kicker && <span className="section-kicker">{kicker}</span>}{title && <h3>{title}</h3>}</div>{right}</div>}
    {children}
  </div>;
}
