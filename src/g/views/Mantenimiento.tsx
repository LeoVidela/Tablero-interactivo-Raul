import React, { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarCheck2, CalendarClock, CheckCircle2, ClipboardCheck, Hammer, Timer, Users, Wrench } from 'lucide-react';
import { MONTH_FULL, UNIT_COLOR, UnitFilter } from '../data';
import { AXIS, GRID, Panel, TOOLTIP_STYLE, fmt, pct } from '../ui';
import { useOpenUnit } from '../openUnit';
import { useDrill } from '../drill';
import { PendEstado, PendRow, ProdRow, correctivos, pendientes, plan, planEvolution, production } from '../mant';
import { C, Donut, TD, Tile } from './shared';

const P_TONE: Record<PendEstado, string> = { PENDIENTE: 'bad', 'EN TALLER': 'warn', PROGRAMADO: 'good' };
const rate = (a: number, b: number) => (b ? (a / b) * 100 : 100);


/** Pestaña "Mantenimiento de flota" (modelo de reporte mensual de Gerencia) y bloques reutilizables. */
export function useMant(unit: UnitFilter, m: number) {
  const p = useMemo(() => plan(unit, m), [unit, m]);
  const pp = useMemo(() => (m > 0 ? plan(unit, m - 1) : null), [unit, m]);
  const evo = useMemo(() => planEvolution(unit, m), [unit, m]);
  const pend = useMemo(() => pendientes(unit), [unit]);
  const prod = useMemo(() => production(unit, m), [unit, m]);
  const corr = useMemo(() => correctivos(unit, m), [unit, m]);
  return { p, pp, evo, pend, prod, corr };
}

export function MantTab({ unit, m, setM, notify }: { unit: UnitFilter; m: number; setM: (m: number) => void; notify: (s: string) => void }) {
  const openUnit = useOpenUnit();
  const drill = useDrill();
  const { p, pp, evo, pend, prod, corr } = useMant(unit, m);
  const [pf, setPf] = useState<'Todos' | 'Preventivo' | 'Service' | '+30'>('Todos');
  const [more, setMore] = useState<Record<string, boolean>>({});
  const tgl = (k: string) => setMore((o) => ({ ...o, [k]: !o[k] }));
  const venc30 = pend.filter((r) => r.dias > 30).length;
  const planTot = { done: p.prevDone + p.servDone, prog: p.prevProg + p.servProg };
  const rows = pend.filter((r) => pf === 'Todos' || (pf === '+30' ? r.dias > 30 : r.tipo === pf));
  const pMonth = MONTH_FULL[m];

  const Bar = ({ label, done, prog, color }: { label: string; done: number; prog: number; color: string }) => { const v = rate(done, prog); return <li><span>{label}</span><div className="mt-track"><div style={{ width: `${v}%`, background: color }} /><i style={{ left: '90%' }} title="Objetivo 90%" /></div><b>{fmt(done)}/{fmt(prog)} · {fmt(v, 0)}%</b></li>; };

  return <>
    <section className="t-kpis">
      <Tile icon={CalendarClock} label="Preventivos program." onClick={() => drill.openMetric('prevDone', { unit, month: m })} value={p.prevProg} color={C.blue}><TD cur={p.prevProg} prev={pp ? pp.prevProg : null} /></Tile>
      <Tile icon={CheckCircle2} label="Preventivos cumplidos" onClick={() => drill.openMetric('prevDone', { unit, month: m })} value={p.prevDone} sub={pct(rate(p.prevDone, p.prevProg), 0)} color={C.green}><TD cur={p.prevDone} prev={pp ? pp.prevDone : null} /></Tile>
      <Tile icon={Timer} label="Preventivos pend." onClick={() => setPf('Preventivo')} value={p.prevPend} color={C.red}><TD cur={p.prevPend} prev={pp ? pp.prevPend : null} goodUp={false} /></Tile>
      <Tile icon={CalendarClock} label="Services program." onClick={() => drill.openMetric('prevDone', { unit, month: m })} value={p.servProg} color={C.purple}><TD cur={p.servProg} prev={pp ? pp.servProg : null} /></Tile>
      <Tile icon={CheckCircle2} label="Services cumplidos" onClick={() => drill.openMetric('prevDone', { unit, month: m })} value={p.servDone} sub={pct(rate(p.servDone, p.servProg), 0)} color={C.teal}><TD cur={p.servDone} prev={pp ? pp.servDone : null} /></Tile>
      <Tile icon={Timer} label="Services pend." onClick={() => setPf('Service')} value={p.servPend} color={C.orange}><TD cur={p.servPend} prev={pp ? pp.servPend : null} goodUp={false} /></Tile>
    </section>

    <section className="mt-grid">
      <Panel kicker="Programado vs. efectivamente realizado" title="Cumplimiento del plan"><ul className="mt-bars">
        <Bar label="Preventivos" done={p.prevDone} prog={p.prevProg} color={C.green} /><Bar label="Services" done={p.servDone} prog={p.servProg} color={C.blue} /><Bar label="Plan total" done={planTot.done} prog={planTot.prog} color={C.purple} />
      </ul><p className="sn-hint block">La marca indica el objetivo de cumplimiento (90%).</p></Panel>
      <Panel kicker="Prioridad" title="Pendientes y alertas"><ul className="sn-alerts">
        <li><button className={p.prevPend ? 'bad' : 'good'} onClick={() => setPf('Preventivo')}><b>{p.prevPend}</b><span>Preventivos pendientes</span></button></li>
        <li><button className={p.servPend ? 'warn' : 'good'} onClick={() => setPf('Service')}><b>{p.servPend}</b><span>Services pendientes</span></button></li>
        <li><button className={venc30 ? 'bad' : 'good'} onClick={() => setPf('+30')}><b>{venc30}</b><span>Vencidos +30 días</span></button></li>
      </ul><p className="sn-hint block">Prioridad: intervenir primero unidades vencidas y reincidentes.</p></Panel>
      <Panel kicker="Últimos 6 meses" title="Evolución del cumplimiento"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><LineChart data={evo} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} onClick={(e) => { const x = evo.find((r) => r.m === e?.activeLabel); if (x) setM(x.i); }}>
        <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis domain={[50, 100]} ticks={[50, 60, 70, 80, 90, 100]} axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${v}%`} /><Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${fmt(v, 1)}%`} /><Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="4 4" /><Line dataKey="preventivos" name="Preventivos" stroke={C.green} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} /><Line dataKey="services" name="Services" stroke={C.blue} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></Panel>
    </section>

    <Panel kicker="Acumulados" title={`Preventivos y services pendientes · ${rows.length}`} right={<div className="sn-chips inline">{(['Todos', 'Preventivo', 'Service', '+30'] as const).map((x) => <button key={x} className={pf === x ? 'active' : ''} onClick={() => setPf(x)}>{x === '+30' ? 'Vencidos +30 días' : x}</button>)}</div>}>
      <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Interno</th><th>Tipo</th><th>Programado</th><th>Km actual</th><th>Vencimiento</th><th>Días venc.</th><th>Estado</th><th>Asignado a</th></tr></thead>
        <tbody>{(more.pend ? rows : rows.slice(0, 8)).map((r, i) => <tr key={r.bus.id + r.tipo} className={r.dias > 30 ? 'row-bad' : ''} onClick={() => openUnit(r.bus.id, { order: r.order })}><td><b>{r.bus.interno}</b>{unit === 'Todos' && <small className="sn-unit"><i style={{ background: UNIT_COLOR[r.bus.unit] }} /></small>}</td><td>{r.tipo}</td><td>{r.programado}</td><td>{fmt(r.km)}</td><td>{r.venc}</td><td><b>{r.dias}</b></td><td><span className={`pill mini ${P_TONE[r.estado]}`}>{r.estado}</span></td><td>{r.asignado}</td></tr>)}
          {!rows.length && <tr><td colSpan={8} className="empty-cell">Sin pendientes para este filtro.</td></tr>}</tbody></table></div>
      {rows.length > 8 && <button className="text-button sn-more" onClick={() => tgl('pend')}>{more.pend ? 'Ver menos' : `Ver los ${rows.length}`}</button>}
      <p className="sn-hint block">Los pendientes permanecen visibles mes a mes hasta su cumplimiento · estado a la fecha de corte (30/09/2026), según el plan por km de cada coche (20.000 km preventivo · 30.000 km service).</p></Panel>

    <Panel kicker={pMonth} title="Tareas correctivas realizadas" right={<span className="sn-hint">Detalle por unidad, sector y personal que efectuó la reparación</span>}>
      <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Fecha</th><th>Interno</th><th>Correctivo realizado</th><th>Sector</th><th>Realizado por</th><th>Estado</th><th>Hs. taller</th></tr></thead>
        <tbody>{(more.corr ? corr : corr.slice(0, 8)).map((c) => <tr key={c.ot.id} onClick={() => openUnit(c.ot.bus.id, { order: c.ot.id })}><td>{c.fecha.slice(0, 5)}</td><td><b>{c.ot.bus.interno}</b></td><td>{c.ot.problem}</td><td>{c.sector}</td><td>{c.tech}</td><td><span className="pill mini good">CERRADO</span></td><td>{fmt(c.ot.horas, 1)}</td></tr>)}</tbody></table></div>
      <button className="text-button sn-more" onClick={() => tgl('corr')}>{more.corr ? 'Ver menos' : 'Ver más correctivos'}</button></Panel>

    <ProdBlock prod={prod} unit={unit} pMonth={pMonth} notify={notify} />
  </>;
}

export function ProdBlock({ prod, unit, pMonth, notify }: { prod: ProdRow[]; unit: UnitFilter; pMonth: string; notify: (s: string) => void }) {
  const drill = useDrill();
  const [all, setAll] = useState(false);
  const [sector, setSector] = useState<string>('Todos');
  const tot = prod.reduce((t, r) => ({ prev: t.prev + r.prev, serv: t.serv + r.serv, corr: t.corr + r.corr }), { prev: 0, serv: 0, corr: 0 });
  const sum = tot.prev + tot.serv + tot.corr || 1;
  const rows = prod.filter((r) => sector === 'Todos' || r.s.sector === sector);
  const max = Math.max(...prod.map((r) => r.total), 1);
  return <>
    <section className="t-kpis">
      <Tile icon={Users} label="Personal de taller" onClick={() => drill.openMetric('personal', { unit })} value={prod.length} sub="mecánicos" color={C.blue} />
      <Tile icon={ClipboardCheck} label="Preventivos realiz." onClick={() => drill.openMetric('prevDone', { unit })} value={tot.prev} color={C.green} />
      <Tile icon={CalendarCheck2} label="Services realiz." onClick={() => drill.openMetric('prevDone', { unit })} value={tot.serv} color={C.purple} />
      <Tile icon={Hammer} label="Correctivos realiz." onClick={() => drill.openMetric('otClosed', { unit })} value={fmt(tot.corr)} color={C.orange} />
    </section>
    <section className="mt-grid two">
      <Panel kicker="Ordenado por total de intervenciones" title={`Producción individual del taller · ${pMonth}`} right={<div className="sn-chips inline">{['Todos', 'Mecánica', 'Electricidad', 'Carrocería'].map((x) => <button key={x} className={sector === x ? 'active' : ''} onClick={() => setSector(x)}>{x}</button>)}</div>}>
        <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Personal</th><th>Sector</th><th>Preventivos</th><th>Services</th><th>Correctivos</th><th>Total</th><th>Participación</th></tr></thead>
          <tbody>{(all ? rows : rows.slice(0, 10)).map((r) => <tr key={r.s.id} onClick={() => notify(`${r.s.name} (${r.s.unit}) · ${r.total} intervenciones · ${fmt(r.horas)} hs en taller`)}><td><b>{r.s.name}</b>{unit === 'Todos' && <small className="sn-unit"><i style={{ background: UNIT_COLOR[r.s.unit] }} />{r.s.unit}</small>}</td><td>{r.s.sector}</td><td>{r.prev}</td><td>{r.serv}</td><td>{r.corr}</td><td><b>{r.total}</b></td>
            <td><div className="mt-share"><div><span style={{ width: `${(r.total / max) * 100}%` }} /></div><em>{fmt(r.share, 1)}%</em></div></td></tr>)}</tbody></table></div>
        {rows.length > 10 && <button className="text-button sn-more" onClick={() => setAll(!all)}>{all ? 'Ver menos' : `Ver los ${rows.length} colaboradores`}</button>}</Panel>
      <Panel kicker={pMonth} title="Distribución de trabajos del mes"><Donut center={fmt(sum)} sub="TRABAJOS" data={[{ name: 'Preventivos', value: tot.prev, color: C.green }, { name: 'Services', value: tot.serv, color: C.purple }, { name: 'Correctivos', value: tot.corr, color: C.orange }]} />
        <p className="sn-hint block"><AlertTriangle size={11} /> Los correctivos representan el {fmt((tot.corr / sum) * 100, 0)}% del trabajo: cuanto más alto, más reactivo es el taller.</p><p className="sn-hint block"><Wrench size={11} /> Tocá un colaborador para ver sus horas.</p></Panel>
    </section>
  </>;
}
