import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowRight, BusFront, ChevronRight, Fuel, Gauge, Radio, Route, ShieldAlert, Timer, Users, Wallet, Wrench, X } from 'lucide-react';
import { MONTH_LABELS, OBJ, UNIT_CODE, UNIT_COLOR, UnitName, aggregate, lineRows } from '../data';
import { AXIS, TOOLTIP_STYLE, fmt, money, pct } from '../ui';
import { busesOf, tallerData } from '../taller';
import { sinData } from '../siniestros';
import { useDrill } from '../drill';
import { useOpenUnit } from '../openUnit';
import { useTopEscape } from '../esc';
import type { MetricKey } from '../metrics';

const CITY: Record<UnitName, string> = { 'Córdoba': 'Córdoba Capital', Comodoro: 'Comodoro Rivadavia', 'San Luis': 'San Luis Capital', 'Villa Mercedes': 'Villa Mercedes' };
const LIVE: Partial<Record<UnitName, string>> = { 'Córdoba': 'Vista Corredores', Comodoro: 'Vista Corredores' };

export function BaseDetail({ base, onClose }: { base: UnitName; onClose: () => void }) {
  const drill = useDrill(); const openUnit = useOpenUnit();
  const ref = useRef<HTMLDivElement>(null); useTopEscape(ref, onClose);
  const a = useMemo(() => aggregate(base, [11]), [base]);
  const p = useMemo(() => aggregate(base, [10]), [base]);
  const t = useMemo(() => tallerData(base, 11), [base]);
  const s = useMemo(() => sinData(base, 11), [base]);
  const lines = useMemo(() => lineRows(base, [11]), [base]);
  const buses = useMemo(() => busesOf(base), [base]);
  const trend = useMemo(() => MONTH_LABELS.map((m, i) => ({ m, v: +aggregate(base, [i]).cumpl.toFixed(1) })), [base]);
  const color = UNIT_COLOR[base];
  const go = (tgt: Parameters<typeof drill.go>[0], tab?: string) => { onClose(); drill.go(tgt, { unit: base, tab }); };
  const metric = (k: MetricKey) => drill.openMetric(k, { unit: base });
  const st = (e: string) => buses.filter((b) => b.estado === e).length;
  const kpis: { k: MetricKey; icon: typeof Gauge; label: string; v: string; ok: boolean | null; d: string }[] = [
    { k: 'cumpl', icon: Route, label: 'KM cumplidos', v: pct(a.cumpl), ok: a.cumpl >= OBJ.km, d: `${a.cumpl >= p.cumpl ? '+' : '−'}${fmt(Math.abs(a.cumpl - p.cumpl), 1)} pp` },
    { k: 'disp', icon: BusFront, label: 'Disponibilidad', v: pct(a.disp), ok: a.disp >= OBJ.disp, d: `${a.oper} de ${a.total} coches` },
    { k: 'aus', icon: Users, label: 'Ausentismo', v: pct(a.aus), ok: a.aus <= OBJ.aus, d: `objetivo ≤ ${OBJ.aus}%` },
    { k: 'sin', icon: ShieldAlert, label: 'Siniestros', v: fmt(a.sin), ok: null, d: `${s.incs.length} incidentes` },
    { k: 'cost', icon: Wallet, label: 'Costo por km', v: money(a.cost), ok: a.cost <= OBJ.cost, d: `ingreso ${money(a.inc)}` },
    { k: 'ipk', icon: Activity, label: 'IPK', v: fmt(a.ipk, 2), ok: null, d: `${fmt(a.pax)} pasajeros` },
    { k: 'otOpen', icon: Wrench, label: 'OT abiertas', v: fmt(a.otOpen), ok: null, d: `${a.otClosed} cerradas en el mes` },
    { k: 'kmpl', icon: Fuel, label: 'Rendimiento', v: `${fmt(a.kmExec / a.lts, 2)} km/l`, ok: null, d: `${fmt(a.lts)} L` },
  ];

  return <motion.div ref={ref} data-modal="" className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
    <motion.aside className="detail-drawer base-detail" style={{ ['--tone' as string]: color }} initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 28 }} onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header"><div><span className="section-kicker">Unidad de negocio · {UNIT_CODE[base]}</span><h2>{base}</h2><small>{CITY[base]} · Septiembre 2026 · {a.total} coches · {lines.length} líneas</small></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>

      <button className="bd-hero" onClick={() => metric('cumpl')}>
        <div><span>Cumplimiento de km</span><strong>{pct(a.cumpl)}</strong><small>{fmt(a.kmExec)} km ejecutados de {fmt(a.kmProg)} programados</small></div>
        <div className="bd-spark"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 6, right: 4, left: -34, bottom: 0 }}><XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ ...AXIS, fontSize: 9 }} interval={2} /><YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ ...AXIS, fontSize: 9 }} /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${fmt(v, 1)}%`, 'Cumplimiento']} /><Line dataKey="v" stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
      </button>

      <div className="bd-kpis">{kpis.map((x) => <button key={x.k} onClick={() => metric(x.k)}><x.icon size={16} /><span>{x.label}</span><strong className={x.ok === null ? '' : x.ok ? 'ok' : 'low'}>{x.v}</strong><small>{x.d}</small></button>)}</div>

      <div className="drawer-section"><div className="panel-heading"><h3>Estado de la flota</h3><button className="text-button" onClick={() => go('Flota')}>Ver coches <ChevronRight size={14} /></button></div>
        <div className="bd-fleet">{([['Operativa', '#22c55e'], ['En reparación', '#f59e0b'], ['Esperando repuestos', '#f97316'], ['Fuera de servicio', '#ef4444']] as const).map(([e, c]) => <button key={e} onClick={() => go('Flota')}><i style={{ background: c }} /><span>{e}</span><b>{st(e)}</b></button>)}</div>
        <div className="bd-stack">{([['Operativa', '#22c55e'], ['En reparación', '#f59e0b'], ['Esperando repuestos', '#f97316'], ['Fuera de servicio', '#ef4444']] as const).map(([e, c]) => <div key={e} style={{ width: `${(st(e) / buses.length) * 100}%`, background: c }} title={`${e}: ${st(e)}`} />)}</div></div>

      <div className="drawer-section"><div className="panel-heading"><h3>Líneas</h3><button className="text-button" onClick={() => go('Resumen')}>Ver en el panel <ChevronRight size={14} /></button></div>
        <ul className="bd-lines">{lines.map((l) => <li key={l.line}><button onClick={() => metric('cumpl')}><b>Línea {l.line}</b><div className="md-bar"><div style={{ width: `${Math.max(0, (l.cumpl - 90) * 10)}%`, background: l.cumpl >= OBJ.km ? '#22c55e' : '#ef4444' }} /></div><span className={l.cumpl >= OBJ.km ? 'ok' : 'low'}>{pct(l.cumpl)}</span><small>{fmt(l.kmExec)} km · IPK {fmt(l.ipk, 2)} · {l.sin} sin.</small></button></li>)}</ul></div>

      <div className="drawer-section"><div className="panel-heading"><h3>Coches en taller ahora · {t.abiertas.length}</h3><button className="text-button" onClick={() => go('Taller', 'Correctivo')}>Ver OT <ChevronRight size={14} /></button></div>
        {t.abiertas.slice(0, 5).map((o) => <button className="bd-row" key={o.id} onClick={() => openUnit(o.bus.id, { order: o.id })}><span className="kc-int">{o.bus.interno}</span><div><strong>{o.problem}</strong><small>{o.id} · {o.comp} · {o.estado}</small></div><ChevronRight size={15} /></button>)}
        {!t.abiertas.length && <p className="muted">Sin coches en taller.</p>}</div>

      <div className="drawer-section"><div className="panel-heading"><h3>Siniestros de septiembre · {s.events.length}</h3><button className="text-button" onClick={() => go('Seguridad')}>Ver siniestros <ChevronRight size={14} /></button></div>
        {s.events.slice(0, 4).map((e) => <button className="bd-row" key={e.id} onClick={() => openUnit(e.bus.id, { order: e.orderId, component: e.anchor })}><span className="kc-int">{e.bus.interno}</span><div><strong>{e.damage} · {e.fecha}</strong><small>{e.driver.name} · responsabilidad {e.resp.toLowerCase()}</small></div><ChevronRight size={15} /></button>)}
        {!s.events.length && <p className="muted">Sin siniestros en el mes.</p>}</div>

      <div className="bd-links">
        <button onClick={() => go('Taller')}><Wrench size={15} /> Taller</button><button onClick={() => go('RRHH')}><Users size={15} /> RR.HH.</button>
        <button onClick={() => go('Combustible')}><Fuel size={15} /> Combustible</button><button onClick={() => go('Tráfico')}>{LIVE[base] ? <Radio size={15} /> : <Timer size={15} />} Tráfico{LIVE[base] ? ' en vivo' : ''}</button>
      </div>
      <button className="drawer-cta" onClick={() => go('Resumen')}>Abrir el panel de {base} <ArrowRight size={16} /></button>
    </motion.aside>
  </motion.div>;
}
