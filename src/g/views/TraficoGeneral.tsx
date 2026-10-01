import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, ArrowRight, BusFront, Clock3, Gauge, Navigation, Percent, Route, TrendingDown, Users, X, Zap } from 'lucide-react';
import { UNIT_COLOR, UNIT_NAMES, UnitFilter, UnitName } from '../data';
import { AXIS, GRID, Panel, TOOLTIP_STYLE, fmt, pct } from '../ui';
import { useDrill } from '../drill';
import { useOpenUnit } from '../openUnit';
import { useTopEscape } from '../esc';
import type { MetricKey } from '../metrics';
import { trafficDay, type Day, type DayLine } from '../trafico';
import { Tile } from './shared';

type K = 'prod' | 'enlace' | 'total' | 'ef' | 'vel' | 'activos' | 'serv' | 'dev' | 'pax' | 'puntual' | 'demora' | 'eventos';
const DEF: Record<K, { label: string; icon: typeof Gauge; color: string; v: (d: Day) => string; sub: (d: Day, sede: string) => string; num: (d: Day) => number; hourKey?: 'kmH' | 'pax' | 'puntual' | 'vel'; metric?: MetricKey; desc: string }> = {
  prod: { label: 'KM productivos GPS', icon: Route, color: '#f97316', v: (d) => fmt(d.prod, 1), sub: () => 'km productivos de la flota', num: (d) => d.prod, hourKey: 'kmH', metric: 'kmExec', desc: 'Kilómetros recorridos con pasajeros según GPS, desde el inicio del servicio hasta la última foto horaria.' },
  enlace: { label: 'KM de enlace GPS', icon: Navigation, color: '#22c55e', v: (d) => fmt(d.enlace, 1), sub: () => 'coche andando sin pasajeros', num: (d) => d.enlace, desc: 'Kilómetros sin pasajeros: salidas y regresos a base, traslados entre cabeceras.' },
  total: { label: 'KM totales flota', icon: Activity, color: '#f97316', v: (d) => fmt(d.total, 1), sub: () => 'productivos + enlace', num: (d) => d.total, hourKey: 'kmH', metric: 'kmExec', desc: 'Suma de km productivos y de enlace.' },
  ef: { label: 'Eficiencia global', icon: Percent, color: '#22c55e', v: (d) => pct(d.ef), sub: () => 'km productivos sobre km totales', num: (d) => d.ef, metric: 'cumpl', desc: 'Qué parte de los kilómetros recorridos llevó pasajeros.' },
  vel: { label: 'Velocidad promedio flota', icon: Gauge, color: '#eab308', v: (d) => fmt(d.vel, 2), sub: () => 'km/h promedio GPS', num: (d) => d.vel, hourKey: 'vel', desc: 'Velocidad comercial promedio ponderada por km.' },
  activos: { label: 'Coches activos', icon: BusFront, color: '#ec4899', v: (d) => `${d.activos} / ${d.flota}`, sub: (_, s) => `de la flota ${s === 'Todos' ? 'de las 4 bases' : `de ${s}`}`, num: (d) => d.activos, metric: 'oper', desc: 'Coches que hoy salieron a prestar servicio sobre la flota total.' },
  serv: { label: 'Servicios cubiertos', icon: Zap, color: '#22c55e', v: (d) => `${d.serv} / ${d.servMeta}`, sub: (d, s) => `${pct(d.servMeta ? (d.serv / d.servMeta) * 100 : 0)} de la meta diaria${s === 'Todos' ? '' : ` de ${s}`}`, num: (d) => (d.servMeta ? (d.serv / d.servMeta) * 100 : 0), metric: 'cob', desc: 'Servicios del diagrama con coche y chofer asignado.' },
  dev: { label: 'Desviación vs ideal', icon: TrendingDown, color: '#ef4444', v: (d) => `${d.dev >= 0 ? '+' : '−'}${fmt(Math.abs(d.dev))}`, sub: (d) => `km acumulados a la hora ${String(d.hour).padStart(2, '0')}:00`, num: (d) => d.dev, metric: 'cumpl', desc: 'Diferencia entre lo que lleva la flota y lo que debería llevar según una jornada completa real.' },
  pax: { label: 'Pasajeros del día', icon: Users, color: '#3b82f6', v: (d) => fmt(d.pax), sub: () => 'boletos validados hasta ahora', num: (d) => d.pax, hourKey: 'pax', metric: 'pax', desc: 'Pasajeros transportados según validaciones SUBE del día.' },
  puntual: { label: 'Puntualidad', icon: Clock3, color: '#14b8a6', v: (d) => pct(d.puntual), sub: () => 'salidas a horario (±3 min)', num: (d) => d.puntual, hourKey: 'puntual', metric: 'reg', desc: 'Porcentaje de salidas de cabecera dentro de ±3 minutos del horario.' },
  demora: { label: 'Demora promedio', icon: Clock3, color: '#f59e0b', v: (d) => `${fmt(d.demora, 1)} min`, sub: () => 'por coche en calle', num: (d) => d.demora, desc: 'Atraso promedio de los coches en servicio respecto del horario.' },
  eventos: { label: 'Eventos del día', icon: AlertTriangle, color: '#ef4444', v: (d) => fmt(d.events.length), sub: (d) => `${d.events.filter((e) => e.nivel === 'bad').length} críticos`, num: (d) => d.events.length, desc: 'Desvíos, atrasos, auxilios, cancelaciones y alertas GPS registradas hoy.' },
};
const ORDER: K[] = ['prod', 'enlace', 'total', 'ef', 'vel', 'activos', 'serv', 'dev', 'pax', 'puntual', 'demora', 'eventos'];

export function TraficoGeneral({ unit, iso, hour }: { unit: UnitFilter; iso: string; hour: number }) {
  const [sede, setSede] = useState<UnitFilter>(unit);
  useEffect(() => setSede(unit), [unit]);
  const d = useMemo(() => trafficDay(sede, iso, hour), [sede, iso, hour]);
  const perSede = useMemo(() => UNIT_NAMES.map((u) => ({ u, d: trafficDay(u, iso, hour) })), [iso, hour]);
  const [selH, setSelH] = useState<number | null>(null);
  const h = selH ?? hour; const pt = d.series[h];
  const [open, setOpen] = useState<{ k: K } | { line: DayLine } | null>(null);
  const [rank, setRank] = useState<'km' | 'demora'>('km');
  const openUnit = useOpenUnit();
  const buses = [...d.buses].filter((b) => b.estado === 'En servicio').sort((a, b) => (rank === 'km' ? b.km - a.km : b.demora - a.demora)).slice(0, 10);
  const fecha = iso.split('-').reverse().join('/');
  const faltan = Math.max(0, 23 - hour);

  return <div className="tg">
    <div className="section-header compact"><div><span className="section-kicker">Tráfico general · {fecha} · datos hasta las {String(hour).padStart(2, '0')}:00</span><h2>Indicadores del día {sede === 'Todos' ? '· todas las sedes' : `· ${sede}`}</h2></div>
      <div className="sn-chips inline">{(['Todos', ...UNIT_NAMES] as UnitFilter[]).map((u) => <button key={u} className={sede === u ? 'active' : ''} onClick={() => setSede(u)}>{u === 'Todos' ? 'Todas' : u}</button>)}</div></div>

    <section className="t-kpis six tg-kpis">{ORDER.map((k) => { const x = DEF[k]; return <Tile key={k} icon={x.icon} label={x.label} value={x.v(d)} sub={x.sub(d, sede)} color={x.color} onClick={() => setOpen({ k })} />; })}</section>

    <Panel kicker={`KM acumulados · real contra ideal horario · ${fecha}`} title="¿Cómo viene el día?" className="tg-acum">
      <div className="tg-strip"><div><b>{String(h).padStart(2, '0')}:00 hs</b><span>{selH === null ? 'datos hasta esta hora' : 'hora seleccionada'}</span></div><div><b>{fmt(pt.real ?? 0)} km</b><span>lleva la flota</span></div><div><b>{fmt(pt.ideal)} km</b><span>debería llevar</span></div>
        <div className={(pt.real ?? 0) - pt.ideal < 0 ? 'bad' : 'good'}><b>{(pt.real ?? 0) - pt.ideal >= 0 ? '+' : '−'}{fmt(Math.abs((pt.real ?? 0) - pt.ideal))} km</b><span>desviación</span></div></div>
      <div className="g-chart-box clickable-chart tall-chart" onClick={() => undefined}><ResponsiveContainer width="100%" height="100%"><LineChart data={d.series} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} onClick={(e) => { const i = e?.activeTooltipIndex; if (typeof i === 'number' && i <= hour) setSelH(i === hour ? null : i); }}>
        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="h" axisLine={false} tickLine={false} tick={AXIS} interval={1} /><YAxis axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => (v >= 1000 ? `${fmt(v / 1000, 0)}k` : String(v))} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${fmt(v)} km`, n]} />
        <ReferenceLine x={d.series[h].h} stroke="var(--ax)" strokeDasharray="3 3" />
        <Line dataKey="ideal" name="Ideal" stroke="#8b96ad" strokeDasharray="5 5" strokeWidth={1.6} dot={false} isAnimationActive={false} />
        <Line dataKey="real" name="Real" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: '#f97316' }} activeDot={{ r: 6 }} connectNulls={false} isAnimationActive={false} />
      </LineChart></ResponsiveContainer></div>
      <p className="md-desc"><span>La punteada es el ideal calculado a partir de una jornada completa real: sirve para ver el atraso del día contra un día normal, no para medir cumplimiento contractual. La llena es lo que lleva hecho la flota, tomado de la foto horaria. {faltan > 0 && <>Faltan <b>{faltan} fotos</b> del día. </>}Tocá un punto para ver esa hora.</span></p>
    </Panel>

    <section className="mt-grid two tg-row">
      <Panel kicker="Por hora · tocá una barra" title="Km productivos por hora"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.series.filter((s) => s.kmH !== null)} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} onClick={(e) => { const i = e?.activeTooltipIndex; if (typeof i === 'number') setSelH(i + 1 > hour ? null : i + 1); }}>
        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="h" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} formatter={(v: number) => [`${fmt(v)} km`, 'Km en la hora']} />
        <Bar dataKey="kmH" radius={[4, 4, 0, 0]} isAnimationActive={false}>{d.series.filter((s) => s.kmH !== null).map((s) => <Cell key={s.i} fill="#f97316" fillOpacity={selH === s.i + 1 ? 1 : 0.6} cursor="pointer" />)}</Bar></BarChart></ResponsiveContainer></div></Panel>
      <Panel kicker="Por hora" title="Puntualidad de salidas (%)"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><LineChart data={d.series.filter((s) => s.puntual !== null)} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="h" axisLine={false} tickLine={false} tick={AXIS} /><YAxis domain={[60, 100]} axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [pct(v), 'Puntualidad']} /><ReferenceLine y={90} stroke="#ef4444" strokeDasharray="4 4" />
        <Line dataKey="puntual" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 3, fill: '#14b8a6' }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></Panel>
    </section>

    {sede === 'Todos' && <Panel kicker="Hoy · tocá una sede para filtrar" title="Comparativo por sede"><div className="g-table-wrap"><table className="g-table clickable"><thead><tr><th>Sede</th><th>Km productivos</th><th>Debería</th><th>Desviación</th><th>Eficiencia</th><th>Vel. prom.</th><th>Coches</th><th>Servicios</th><th>Puntualidad</th><th>Eventos</th></tr></thead>
      <tbody>{perSede.map(({ u, d: x }) => <tr key={u} onClick={() => setSede(u)}><td><span className="unit-tag"><i style={{ background: UNIT_COLOR[u] }} />{u}</span></td><td><b>{fmt(x.prod)}</b></td><td>{fmt(x.ideal)}</td><td className={x.dev < 0 ? 'low' : 'ok'}>{x.dev >= 0 ? '+' : '−'}{fmt(Math.abs(x.dev))}</td><td>{pct(x.ef)}</td><td>{fmt(x.vel, 1)}</td><td>{x.activos}/{x.flota}</td><td>{x.serv}/{x.servMeta}</td><td className={x.puntual >= 90 ? 'ok' : 'low'}>{pct(x.puntual)}</td><td>{x.events.length}</td></tr>)}</tbody></table></div></Panel>}

    <Panel kicker="Hoy · tocá una línea para ver sus coches" title={`Líneas · ${d.lines.length}`} className="tg-lines"><div className="g-table-wrap"><table className="g-table clickable"><thead><tr>{sede === 'Todos' && <th>Sede</th>}<th>Línea</th><th>Km</th><th>Ideal</th><th>Avance</th><th>Servicios</th><th>Puntualidad</th><th>Pasajeros</th><th>Vel.</th></tr></thead>
      <tbody>{d.lines.map((l) => <tr key={l.unit + l.line} onClick={() => setOpen({ line: l })}>{sede === 'Todos' && <td>{l.unit}</td>}<td><span className="unit-tag"><i style={{ background: l.color }} /><b>Línea {l.line}</b></span></td><td>{fmt(l.km)}</td><td>{fmt(l.ideal)}</td><td><div className="tg-prog"><div style={{ width: `${Math.min(100, l.cumpl)}%`, background: l.cumpl >= 95 ? '#22c55e' : l.cumpl >= 85 ? '#f59e0b' : '#ef4444' }} /></div><small className={l.cumpl >= 95 ? 'ok' : 'low'}>{pct(l.cumpl)}</small></td><td>{l.serv}/{l.servMeta}</td><td className={l.puntual >= 90 ? 'ok' : 'low'}>{pct(l.puntual)}</td><td>{fmt(l.pax)}</td><td>{fmt(l.vel, 1)}</td></tr>)}</tbody></table></div></Panel>

    <section className="mt-grid two tg-row">
      <Panel kicker="Coches en calle · tocá uno para ver su ficha" title={rank === 'km' ? 'Más kilómetros hoy' : 'Mayor demora ahora'} right={<div className="sn-chips inline"><button className={rank === 'km' ? 'active' : ''} onClick={() => setRank('km')}>Km</button><button className={rank === 'demora' ? 'active' : ''} onClick={() => setRank('demora')}>Demora</button></div>}>
        <ul className="tg-buses">{buses.map((b) => <li key={b.bus.id}><button onClick={() => openUnit(b.bus.id)}><span className="kc-int">{b.bus.interno}</span><div><strong>{b.bus.unit} · línea {b.linea}</strong><small>{fmt(b.km)} km hoy · {fmt(b.vel, 1)} km/h</small></div><em className={b.demora > 5 ? 'low' : 'ok'}>{b.demora ? `+${b.demora} min` : 'a horario'}</em></button></li>)}</ul></Panel>
      <Panel kicker="Hoy" title={`Eventos de tráfico · ${d.events.length}`}><ul className="tg-events">{d.events.length ? d.events.slice(0, 9).map((e, i) => <li key={i} className={e.nivel}><button onClick={() => e.busId && openUnit(e.busId)} disabled={!e.busId}><time>{e.hora}</time><div><strong>{e.tipo}</strong><small>{e.unit} · línea {e.linea} · {e.detalle}</small></div></button></li>) : <li className="muted">Sin eventos todavía.</li>}</ul></Panel>
    </section>

    {open && <TrafDrawer key={'k' in open ? open.k : open.line.line} open={open} sede={sede} d={d} perSede={perSede} onSede={(u) => { setSede(u); }} onClose={() => setOpen(null)} />}
  </div>;
}

function TrafDrawer({ open, sede, d, perSede, onSede, onClose }: { open: { k: K } | { line: DayLine }; sede: UnitFilter; d: Day; perSede: { u: UnitName; d: Day }[]; onSede: (u: UnitFilter) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null); useTopEscape(ref, onClose);
  const drill = useDrill(); const openUnit = useOpenUnit();
  if ('line' in open) {
    const l = open.line; const bs = d.buses.filter((b) => b.bus.unit === l.unit && b.linea === l.line && b.estado === 'En servicio');
    const evs = d.events.filter((e) => e.unit === l.unit && e.linea === l.line);
    return <motion.div ref={ref} data-modal="" className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
      <motion.aside className="detail-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 28 }} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header"><div><span className="section-kicker">Tráfico · {l.unit} · hoy</span><h2>Línea {l.line}</h2><small>{bs.length} coches en calle · {fmt(l.pax)} pasajeros</small></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
        <div className="bd-kpis">
          <button onClick={() => drill.openMetric('kmExec', { unit: l.unit })}><Route size={16} /><span>Km productivos</span><strong>{fmt(l.km)}</strong><small>ideal {fmt(l.ideal)}</small></button>
          <button onClick={() => drill.openMetric('cumpl', { unit: l.unit })}><Percent size={16} /><span>Avance vs ideal</span><strong className={l.cumpl >= 95 ? 'ok' : 'low'}>{pct(l.cumpl)}</strong><small>12 meses de la sede</small></button>
          <button onClick={() => drill.openMetric('cob', { unit: l.unit })}><Zap size={16} /><span>Servicios</span><strong>{l.serv}/{l.servMeta}</strong><small>cubiertos</small></button>
          <button onClick={() => drill.openMetric('reg', { unit: l.unit })}><Clock3 size={16} /><span>Puntualidad</span><strong className={l.puntual >= 90 ? 'ok' : 'low'}>{pct(l.puntual)}</strong><small>salidas a horario</small></button>
        </div>
        <div className="drawer-section"><div className="panel-heading"><h3>Coches en la línea</h3></div>
          {bs.map((b) => <button className="bd-row" key={b.bus.id} onClick={() => openUnit(b.bus.id)}><span className="kc-int">{b.bus.interno}</span><div><strong>{fmt(b.km)} km hoy · {fmt(b.vel, 1)} km/h</strong><small>{b.demora ? `${b.demora} min de demora` : 'A horario'} · {b.bus.modelo}</small></div><ArrowRight size={15} /></button>)}
          {!bs.length && <p className="muted">Sin coches asignados en este momento.</p>}</div>
        <div className="drawer-section"><div className="panel-heading"><h3>Eventos de la línea · {evs.length}</h3></div>
          {evs.map((e, i) => <button className="bd-row" key={i} onClick={() => e.busId && openUnit(e.busId)}><span className="kc-int">{e.hora}</span><div><strong>{e.tipo}</strong><small>{e.detalle}</small></div><ArrowRight size={15} /></button>)}
          {!evs.length && <p className="muted">Sin eventos hoy.</p>}</div>
        <button className="drawer-cta" onClick={() => { onClose(); drill.openBase(l.unit); }}>Ver ficha de {l.unit} <ArrowRight size={16} /></button>
      </motion.aside></motion.div>;
  }
  const k = open.k; const x = DEF[k];
  const hourData = x.hourKey ? d.series.filter((s) => s[x.hourKey!] !== null).map((s) => ({ h: s.h, v: s[x.hourKey!] as number })) : [];
  const maxS = Math.max(...perSede.map((p) => Math.abs(x.num(p.d))), 1e-9);
  return <motion.div ref={ref} data-modal="" className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
    <motion.aside className="detail-drawer metric-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 28 }} onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header"><div><span className="section-kicker">Tráfico · hoy · hasta las {String(d.hour).padStart(2, '0')}:00</span><h2>{x.label}</h2><small>{sede === 'Todos' ? 'Todas las sedes' : sede}</small></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      <div className="md-hero"><div><span>Valor de hoy</span><strong>{x.v(d)}</strong><small>{x.sub(d, sede)}</small></div></div>
      <h3 className="md-sub">Por sede <em>tocá una para filtrar</em></h3>
      <ul className="md-units-list">{perSede.map((p) => <li key={p.u}><button className={sede === p.u ? 'on' : ''} onClick={() => onSede(sede === p.u ? 'Todos' : p.u)}><span><i style={{ background: UNIT_COLOR[p.u] }} />{p.u}</span><div className="md-bar"><div style={{ width: `${(Math.abs(x.num(p.d)) / maxS) * 100}%`, background: UNIT_COLOR[p.u] }} /></div><b>{x.v(p.d)}</b></button></li>)}</ul>
      {hourData.length > 0 && <><h3 className="md-sub">Hora por hora</h3><div className="md-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={hourData} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="h" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} domain={['auto', 'auto']} /><Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} formatter={(v: number) => [fmt(v, 1), x.label]} /><Bar dataKey="v" fill={x.color} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></>}
      {k === 'activos' && <><h3 className="md-sub">Coches en calle · tocá uno</h3><ul className="tg-buses">{d.buses.filter((b) => b.estado === 'En servicio').slice(0, 40).map((b) => <li key={b.bus.id}><button onClick={() => openUnit(b.bus.id)}><span className="kc-int">{b.bus.interno}</span><div><strong>{b.bus.unit} · línea {b.linea}</strong><small>{fmt(b.km)} km · {fmt(b.vel, 1)} km/h</small></div></button></li>)}</ul>
        <h3 className="md-sub">Sin salir hoy</h3><ul className="tg-buses">{d.buses.filter((b) => b.estado !== 'En servicio').slice(0, 30).map((b) => <li key={b.bus.id}><button onClick={() => openUnit(b.bus.id)}><span className="kc-int">{b.bus.interno}</span><div><strong>{b.estado}</strong><small>{b.bus.unit} · {b.bus.estado}</small></div></button></li>)}</ul></>}
      {(k === 'eventos' || k === 'demora') && <><h3 className="md-sub">{k === 'eventos' ? 'Todos los eventos' : 'Coches con demora'}</h3><ul className="tg-events">{k === 'eventos' ? d.events.map((e, i) => <li key={i} className={e.nivel}><button onClick={() => e.busId && openUnit(e.busId)}><time>{e.hora}</time><div><strong>{e.tipo}</strong><small>{e.unit} · línea {e.linea} · {e.detalle}</small></div></button></li>)
        : d.buses.filter((b) => b.demora > 0).sort((a, b) => b.demora - a.demora).slice(0, 25).map((b) => <li key={b.bus.id} className={b.demora > 5 ? 'bad' : 'warn'}><button onClick={() => openUnit(b.bus.id)}><time>+{b.demora}′</time><div><strong>Interno {b.bus.interno}</strong><small>{b.bus.unit} · línea {b.linea}</small></div></button></li>)}</ul></>}
      {k === 'serv' && <><h3 className="md-sub">Servicios por línea</h3><ul className="md-units-list">{d.lines.map((l) => <li key={l.unit + l.line}><button><span><i style={{ background: l.color }} />{sede === 'Todos' ? `${l.unit.split(' ')[0]} · ` : ''}{l.line}</span><div className="md-bar"><div style={{ width: `${l.servMeta ? (l.serv / l.servMeta) * 100 : 0}%`, background: l.color }} /></div><b>{l.serv}/{l.servMeta}</b></button></li>)}</ul></>}
      <p className="md-desc">{x.desc}</p>
      {x.metric && <button className="drawer-cta" onClick={() => drill.openMetric(x.metric!, { unit: sede })}>Ver evolución de 12 meses <ArrowRight size={16} /></button>}
    </motion.aside></motion.div>;
}
