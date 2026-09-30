import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BusFront, CalendarDays, CheckCircle2, ChevronRight, Download, HandCoins, HeartPulse, MapPin, ShieldAlert, ShieldCheck, Siren, UserRound, Users, Wrench, X } from 'lucide-react';
import { MONTH_FULL, MONTH_LABELS, UNIT_COLOR, UnitFilter } from '../data';
import { AXIS, GRID, Panel, TOOLTIP_STYLE, fmt, pct } from '../ui';
import { Bus } from '../taller';
import { useOpenUnit } from '../openUnit';
import { DriverRow, Repair, RepEstado, Siniestro, driverEvents, driverHistory, fmtMoney, repairState, sinData } from '../siniestros';
import { Bars, C, Donut, TD, Tile } from './shared';

const TABS = ['Resumen ejecutivo', 'Reincidencia', 'Reparación de unidades', 'Seguimiento económico', 'Histórico de conductores'] as const;
type Tab = (typeof TABS)[number];
const REP_TONE: Record<RepEstado, string> = { REPARADA: 'good', 'EN REPARACION': 'warn', PENDIENTE: 'bad' };
const DRV_TONE = { ALERTA: 'bad', SEGUIMIENTO: 'warn', NORMAL: 'good' } as const;
const M = (v: number) => `$ ${fmt(v / 1e6, 1)} M`;

type Detail = { kind: 'event'; s: Siniestro } | { kind: 'driver'; d: DriverRow['d'] } | null;

export function SiniestrosView({ unit, notify }: { unit: UnitFilter; notify: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>('Resumen ejecutivo');
  const [m, setM] = useState(11);
  const [repF, setRepF] = useState<'Todas' | RepEstado>('Todas');
  const [claimF, setClaimF] = useState<'Todos' | 'Abiertos' | 'Cobrados'>('Todos');
  const [showAll, setShowAll] = useState(false);
  const openUnit = useOpenUnit();
  const [detail, setDetail] = useState<Detail>(null);
  const d = useMemo(() => sinData(unit, m), [unit, m]);
  const prev = useMemo(() => (m > 0 ? sinData(unit, m - 1) : null), [unit, m]);
  const hist = useMemo(() => driverHistory(unit), [unit]);
  const monthly = useMemo(() => MONTH_LABELS.map((lb, i) => { const x = sinData(unit, i); return { m: lb, siniestros: x.events.length, incidentes: x.incs.length }; }), [unit]);
  const pMonth = MONTH_FULL[m];
  const openBus = (b: Bus, component?: string, order?: string) => openUnit(b.id, { component, order });
  const openRep = (r: Repair) => { if (!r.s.orderId) notify(`Interno ${r.s.bus.interno}: el daño (${r.s.damage.toLowerCase()}) todavía no ingresó a taller`); openBus(r.s.bus, r.s.anchor, r.s.orderId); };
  const nInc = d.incs.length; const nSin = d.events.length;

  const Tiles = () => <section className="t-kpis six">
    <Tile icon={ShieldAlert} label="Siniestros" value={nSin} color={C.red}><TD cur={nSin} prev={prev ? prev.events.length : null} goodUp={false} /></Tile>
    <Tile icon={UserRound} label="Resp. chofer" value={d.resp.Chofer} color={C.orange}><TD cur={d.resp.Chofer} prev={prev ? prev.resp.Chofer : null} goodUp={false} /></Tile>
    <Tile icon={ShieldCheck} label="Sin responsabilidad" value={d.resp.Tercero} sub="terceros" color={C.blue}><TD cur={d.resp.Tercero} prev={prev ? prev.resp.Tercero : null} goodUp={false} /></Tile>
    <Tile icon={HeartPulse} label="Lesionados" value={d.lesionados} color={C.purple}><TD cur={d.lesionados} prev={prev ? prev.lesionados : null} goodUp={false} /></Tile>
    <Tile icon={Siren} label="Incidentes" value={nInc} color={C.amber}><TD cur={nInc} prev={prev ? prev.incs.length : null} goodUp={false} /></Tile>
    <Tile icon={BusFront} label="Unidades afectadas" value={d.units} color={C.teal}><TD cur={d.units} prev={prev ? prev.units : null} goodUp={false} /></Tile>
  </section>;

  const Responsabilidad = () => <Panel kicker="Siniestros del período" title="Responsabilidad"><Donut center={String(nSin)} sub="TOTAL" data={[{ name: 'Chofer', value: d.resp.Chofer, color: C.red }, { name: 'Tercero', value: d.resp.Tercero, color: C.blue }, { name: 'En análisis', value: d.resp['En análisis'], color: C.amber }]} /></Panel>;
  const Estado = () => <Panel kicker="Unidades afectadas" title="Estado de reparaciones"><Donut center={pct(d.rep.pct, 0)} sub="REPARADAS" data={[{ name: 'Reparadas', value: d.rep.reparadas, color: C.green }, { name: 'En reparación', value: d.rep.enRep, color: C.amber }, { name: 'Pendientes', value: d.rep.pendientes, color: C.red }]} />
    <p className="sn-foot">{fmt(d.rep.pct, 0)}% de las unidades afectadas ya fueron reparadas</p></Panel>;
  const Alertas = () => <Panel kicker="Prioridad gerencial" title="Alertas gerenciales"><ul className="sn-alerts">
    <li><button className={d.alerts.reincidentes ? 'bad' : 'good'} onClick={() => setTab('Reincidencia')}><b>{d.alerts.reincidentes}</b><span>Choferes reincidentes</span><ChevronRight size={15} /></button></li>
    <li><button className={d.alerts.pendientes ? 'warn' : 'good'} onClick={() => setTab('Reparación de unidades')}><b>{d.alerts.pendientes}</b><span>Unidades pendientes de reparación</span><ChevronRight size={15} /></button></li>
    <li><button className={d.alerts.lesionados ? 'bad' : 'good'} onClick={() => { const s = d.events.find((x) => x.lesionados); if (s) setDetail({ kind: 'event', s }); else notify('Sin casos con lesionados en el período'); }}><b>{d.alerts.lesionados}</b><span>Caso con lesionados</span><ChevronRight size={15} /></button></li>
  </ul></Panel>;

  const Evol = () => <Panel kicker="12 meses" title="Siniestros e incidentes por mes"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} onClick={(e) => { const i = MONTH_LABELS.indexOf(String(e?.activeLabel)); if (i >= 0) setM(i); }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} allowDecimals={false} /><Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
    <Bar dataKey="siniestros" name="Siniestros" fill={C.red} radius={[4, 4, 0, 0]} isAnimationActive={false} /><Bar dataKey="incidentes" name="Incidentes" fill={C.amber} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div><p className="sn-foot">Tocá un mes para ver su detalle.</p></Panel>;

  const Conductores = ({ n = 5 }: { n?: number } = {}) => <Panel kicker="Reincidencia y comparación" title="Conductores · reincidencia y comparación" right={<span className="sn-hint">El período anterior permite identificar repetición y evolución</span>}>
    <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Chofer</th><th>Sin. mes</th><th>Inc. mes</th><th>Total</th><th>Per. anterior</th><th>Acum. 6 m</th><th>Resp.</th><th>Sanción</th><th>Estado</th></tr></thead>
      <tbody>{d.drivers.slice(0, n).map((r) => <tr key={r.d.id} onClick={() => setDetail({ kind: 'driver', d: r.d })}><td><b>{r.d.name}</b>{unit === 'Todos' && <small className="sn-unit"><i style={{ background: UNIT_COLOR[r.d.unit] }} />{r.d.unit}</small>}</td><td>{r.sin}</td><td>{r.inc}</td><td><b>{r.total}</b></td><td>{r.prev}</td><td>{r.acum}</td><td>{r.resp}</td><td>{r.sancion}</td><td><span className={`pill mini ${DRV_TONE[r.estado]}`}>{r.estado}</span></td></tr>)}
        {!d.drivers.length && <tr><td colSpan={9} className="empty-cell">Sin hechos en el período.</td></tr>}</tbody></table></div></Panel>;

  const Rankings = () => <section className="sn-grid-2">
    <Panel kicker="Total de hechos por persona" title="Conductores · siniestros + incidentes"><Bars color={C.red} fmtV={(v) => String(v)} rows={d.drivers.slice(0, 8).map((r) => ({ key: r.d.id, label: <><b>{r.d.name}</b><small>{r.sin} sin. · {r.inc} inc.</small></>, value: r.total }))} onClick={(k) => { const r = d.drivers.find((x) => x.d.id === k); if (r) setDetail({ kind: 'driver', d: r.d }); }} />
      <div className="sn-legend"><i style={{ background: C.red }} />Siniestros + incidentes · tocá una barra para ver al conductor</div></Panel>
    <Panel kicker="Ranking de internos con mayor repetición" title="Unidades · cantidad de siniestros (12 meses)"><Bars color={C.orange} fmtV={(v) => `${v} sin.`} rows={d.unitsRank.slice(0, 8).map((r) => ({ key: r.bus.id, label: <><b>Interno {r.bus.interno}</b><small>{r.bus.dominio}</small></>, value: r.count }))} onClick={(k) => { const r = d.unitsRank.find((x) => x.bus.id === k); if (r) openBus(r.bus); }} />
      <div className="sn-legend">Los internos con más siniestros quedan arriba · tocá uno para abrir su ficha</div></Panel>
  </section>;

  const repRows = d.repairs.filter((r) => repF === 'Todas' || r.estado === repF);
  const pendActual = repRows.filter((r) => r.estado === 'PENDIENTE' && r.origen === 'actual');
  const pendAnt = repRows.filter((r) => r.estado === 'PENDIENTE' && r.origen === 'anterior').sort((a, b) => b.dias - a.dias);
  const enRep = repRows.filter((r) => r.estado === 'EN REPARACION').sort((a, b) => b.dias - a.dias);
  const reparadas = repRows.filter((r) => r.estado === 'REPARADA' && r.reparadaEnMes);
  const bucketTone = (b: string) => (b === '+30' ? 'bad' : b === '8-30' ? 'warn' : 'good');
  const RepTable = ({ rows, title, kicker, cols }: { rows: Repair[]; title: string; kicker: string; cols: 'pend' | 'ant' | 'rep' | 'ok' }) => <Panel kicker={kicker} title={`${title} · ${rows.length}`}>
    <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Interno</th>{cols === 'pend' ? <><th>Sin. mes</th><th>Daño actual</th><th>Per. anterior</th><th>Acum.</th></> : <><th>Fecha hecho</th><th>Daño</th></>}<th>Estado</th>{cols === 'ant' && <th>Días pend.</th>}{cols !== 'pend' && <th>{cols === 'ok' ? 'Reparado por' : 'Asignación'}</th>}{cols === 'ant' && <th>Antig.</th>}</tr></thead>
      <tbody>{rows.map((r) => { const same = d.repairs.filter((x) => x.s.bus.id === r.s.bus.id); return <tr key={r.s.id} onClick={() => openRep(r)}><td><b>{r.s.bus.interno}</b></td>
        {cols === 'pend' ? <><td>{same.filter((x) => x.s.m === m).length}</td><td>{r.s.damage}</td><td>{same.filter((x) => x.s.m === m - 1).length}</td><td>{same.length}</td></> : <><td>{r.s.fecha.slice(0, 5)}<small className="sn-unit">{MONTH_FULL[r.s.m].split(' ')[0]}</small></td><td>{r.s.damage}</td></>}
        <td><span className={`pill mini ${REP_TONE[r.estado]}`}>{r.estado}</span></td>{cols === 'ant' && <td>{r.dias}</td>}{cols !== 'pend' && <td>{r.asig}</td>}{cols === 'ant' && <td><span className={`pill mini ${bucketTone(r.bucket)}`}>{r.bucket} días</span></td>}</tr>; })}
        {!rows.length && <tr><td colSpan={9} className="empty-cell">Sin unidades en este estado.</td></tr>}</tbody></table></div></Panel>;
  const Reparaciones = () => <>
    <div className="sn-chips">{(['Todas', 'PENDIENTE', 'EN REPARACION', 'REPARADA'] as const).map((x) => <button key={x} className={repF === x ? 'active' : ''} onClick={() => setRepF(x)}>{x === 'Todas' ? 'Todas' : x[0] + x.slice(1).toLowerCase()}{x !== 'Todas' && <em>{d.repairs.filter((r) => r.estado === x && (x !== 'REPARADA' || r.reparadaEnMes)).length}</em>}</button>)}</div>
    <p className="sn-hint block">Los pendientes se acumulan mes a mes hasta su reparación efectiva. Las reparadas del mes permanecen visibles para medir la resolución. Antigüedad: 0-7 · 8-30 · +30 días.</p>
    <section className="sn-grid-2">{RepTable({ rows: pendActual, title: 'Pendientes · mes actual', kicker: 'Seguimiento', cols: 'pend' })}{RepTable({ rows: pendAnt, title: 'Pendientes · meses anteriores', kicker: 'Acumulados', cols: 'ant' })}</section>
    <section className="sn-grid-2">{RepTable({ rows: enRep, title: 'En reparación', kicker: 'Taller propio / chapista', cols: 'rep' })}{RepTable({ rows: reparadas, title: 'Reparadas en el mes (incluye hechos anteriores)', kicker: 'Resolución', cols: 'ok' })}</section></>;

  const eco = d.eco;
  const EcoTiles = () => <section className="t-kpis six">
    <Tile icon={HandCoins} label="Reclamos abiertos" value={eco.abiertos} color={C.red} />
    <Tile icon={Wrench} label="A cargo empresa" value={M(eco.empresa)} color={C.orange} />
    <Tile icon={Users} label="Gestión interna" value={M(eco.interna)} color={C.amber} />
    <Tile icon={ShieldCheck} label="Reclamado a terceros" value={M(eco.terceros)} color={C.blue} />
    <Tile icon={CheckCircle2} label="Reconocido" value={M(eco.reconocido)} color={C.teal} />
    <Tile icon={HandCoins} label="Cobrado" value={M(eco.cobrado)} color={C.green} />
  </section>;
  const claims = d.events.filter((s) => claimF === 'Todos' || (claimF === 'Cobrados' ? s.claim === 'Cobrado' : s.claim !== 'Cobrado')).sort((a, b) => a.date.getTime() - b.date.getTime());
  const Eco = () => <>
    {EcoTiles()}
    <section className="t-grid-3 wide">
      <Panel kicker="Responsabilidad empresa" title="Seguro y gestión interna"><ul className="sn-list"><li><span>Seguro</span><b>{eco.seguroN} casos / {M(eco.seguroM)}</b></li><li><span>Gestión interna</span><b>{eco.internaN} casos / {M(eco.internaM)}</b></li><li className="bad"><span>Costo empresa pendiente</span><b>{M(eco.costoPend)}</b></li></ul></Panel>
      <Panel kicker="Responsabilidad tercero" title="Recupero de terceros"><ul className="sn-list"><li><span>Reclamados</span><b>{eco.recTercN} casos / {M(eco.terceros)}</b></li><li><span>Reconocidos</span><b>{M(eco.reconocido)}</b></li><li className="good"><span>Cobrados</span><b>{M(eco.cobrado)}</b></li></ul></Panel>
      <Panel kicker="Acción requerida" title="Estados prioritarios"><ul className="sn-list prio"><li className={eco.sinOferta ? 'bad' : ''}><b>{eco.sinOferta}</b><span>reclamos sin oferta</span></li><li className={eco.aAcordar ? 'warn' : ''}><b>{eco.aAcordar}</b><span>gestión interna a acordar</span></li><li className={eco.pagoPend ? 'warn' : ''}><b>{eco.pagoPend}</b><span>pago de aseguradora pendiente</span></li></ul></Panel>
    </section>
    <Panel kicker={pMonth} title="Detalle de siniestros y reclamos" right={<div className="sn-chips inline">{(['Todos', 'Abiertos', 'Cobrados'] as const).map((x) => <button key={x} className={claimF === x ? 'active' : ''} onClick={() => setClaimF(x)}>{x}</button>)}</div>}>
      <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Fecha</th><th>Int.</th><th>Conductor</th><th>Resp.</th><th>Seguro / Gestión</th><th>N° sin.</th><th>Monto recl.</th><th>Reconocido</th><th>Cobrado</th><th>Estado</th></tr></thead>
        <tbody>{claims.map((s) => <tr key={s.id} onClick={() => setDetail({ kind: 'event', s })}><td>{s.fecha.slice(0, 5)}</td><td><b>{s.bus.interno}</b></td><td>{s.driver.name}</td><td><span className={`pill mini ${s.resp === 'Tercero' ? 'unit' : 'warn'}`}>{s.resp === 'Tercero' ? 'TERCERO' : s.resp === 'Chofer' ? 'EMPRESA' : 'EN ANÁLISIS'}</span></td><td>{s.cobertura}</td><td>{s.nSin}</td><td>{fmtMoney(s.reclamado)}</td><td>{fmtMoney(s.reconocido)}</td><td>{fmtMoney(s.cobrado)}</td><td><span className={`pill mini ${s.claim === 'Cobrado' ? 'good' : 'warn'}`}>{s.claim}</span></td></tr>)}
          {!claims.length && <tr><td colSpan={10} className="empty-cell">Sin reclamos para este filtro.</td></tr>}</tbody></table></div>
      <p className="sn-hint block">Campos recomendados adicionales: compañía de seguros, dominio del tercero, franquicia, costo final a cargo de la empresa y fecha del último movimiento.</p></Panel></>;

  const cellTone = (s: number, i: number) => (s >= 2 ? 'c3' : s === 1 ? 'c2' : i > 0 ? 'c1' : '');
  const totalS = hist.reduce((t, r) => t + r.totS, 0); const totalI = hist.reduce((t, r) => t + r.totI, 0);
  const Hist = () => <>
    <section className="t-kpis"><Tile icon={UserRound} label="Choferes con hechos" value={hist.length} color={C.blue} /><Tile icon={ShieldAlert} label="Siniestros 12 meses" value={totalS} color={C.red} /><Tile icon={Siren} label="Incidentes 12 meses" value={totalI} color={C.amber} /><Tile icon={AlertTriangle} label="Reincidentes" value={hist.filter((r) => r.totS + r.totI >= 4).length} color={C.orange} /></section>
    <Panel kicker="Últimos 12 meses" title="Histórico de conductores" right={<span className="sn-hint">S = siniestros · I = incidentes · ordenado por total de siniestros</span>}>
      <div className="g-table-wrap tall"><table className="g-table clickable sn-matrix"><thead><tr><th>Chofer</th>{MONTH_LABELS.map((lb, i) => <th key={lb} className={i === m ? 'cur' : ''} onClick={() => setM(i)}>{lb}</th>)}<th>Tot. S</th><th>Tot. I</th><th>Total</th></tr></thead>
        <tbody>{(showAll ? hist : hist.slice(0, 10)).map((r) => <tr key={r.d.id} onClick={() => setDetail({ kind: 'driver', d: r.d })}><td><b>{r.d.name}</b>{unit === 'Todos' && <small className="sn-unit"><i style={{ background: UNIT_COLOR[r.d.unit] }} />{r.d.unit}</small>}</td>
          {r.per.map((p, i) => <td key={i} className={`sn-cell ${cellTone(p.s, p.s + p.i)} ${i === m ? 'cur' : ''}`}>{p.s}/{p.i}</td>)}<td><b>{r.totS}</b></td><td>{r.totI}</td><td><b>{r.totS + r.totI}</b></td></tr>)}</tbody></table></div>
      {hist.length > 10 && <button className="text-button sn-more" onClick={() => setShowAll(!showAll)}>{showAll ? 'Ver menos' : `Ver los ${hist.length} conductores`}</button>}
      <p className="sn-hint block">El mes seleccionado ({MONTH_LABELS[m]}) queda resaltado. Tocá un mes para cambiar el período o un chofer para ver su detalle.</p></Panel></>;

  const unitsTxt = unit === 'Todos' ? 'Todas las unidades' : unit;
  return <div className="taller siniestros">
    <section className="t-header">
      <div className="t-title"><span className="t-title-icon" style={{ background: 'linear-gradient(135deg,#ef4444,#f97316)' }}><ShieldAlert size={24} /></span><div><span className="section-kicker">Seguridad</span><h2>Siniestros e Incidentes</h2><p><MapPin size={12} /> {unitsTxt} · conductores, unidades y reparaciones</p></div></div>
      <div className="t-header-tools"><label className="g-select"><CalendarDays size={16} /><span>Mes seleccionado<select value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTH_FULL.map((n, i) => <option key={n} value={i}>{n}</option>)}</select></span></label><button className="export-button" onClick={() => notify('Reporte integral de siniestros preparado para exportar')}><Download size={15} /> Exportar reporte</button></div>
    </section>
    <nav className="t-tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>

    {tab === 'Resumen ejecutivo' && <>{Tiles()}<section className="t-grid-3 wide">{Responsabilidad()}{Estado()}{Alertas()}</section>{Conductores()}{Evol()}</>}
    {tab === 'Reincidencia' && <>{Tiles()}{Conductores({ n: 10 })}{Rankings()}</>}
    {tab === 'Reparación de unidades' && <>{Tiles()}<section className="t-grid-3 wide">{Estado()}{Responsabilidad()}{Alertas()}</section>{Reparaciones()}</>}
    {tab === 'Seguimiento económico' && Eco()}
    {tab === 'Histórico de conductores' && Hist()}

    <p className="t-note"><ShieldAlert size={13} /> Datos demostrativos · modelo de reporte de Gerencia. Tocá un conductor, un interno o un reclamo para ver su detalle y abrir la ficha del coche.</p>
    <AnimatePresence>{detail && <DetailModal detail={detail} m={m} onClose={() => setDetail(null)} onBus={(b, s) => { setDetail(null); openBus(b, s?.anchor, s?.orderId); }} onDriver={(dr) => setDetail({ kind: 'driver', d: dr })} />}</AnimatePresence>
  </div>;
}

function useEsc(f: () => void) { React.useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && f(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [f]); }
function DetailModal({ detail, m, onClose, onBus, onDriver }: { detail: NonNullable<Detail>; m: number; onClose: () => void; onBus: (b: Bus, s?: Siniestro) => void; onDriver: (d: DriverRow['d']) => void }) {
  useEsc(onClose);
  const ev = detail.kind === 'driver' ? driverEvents(detail.d) : null;
  const per = useMemo(() => (ev ? MONTH_LABELS.map((lb, i) => ({ m: lb, siniestros: ev.sin.filter((s) => s.m === i).length, incidentes: ev.inc.filter((x) => x.m === i).length })) : []), [ev]);
  const content = detail.kind === 'event' ? (() => {
    const s = detail.s; const r = repairState(s, m);
    return <>
      <header className="sn-modal-head"><span className="bus-int">{s.bus.interno}</span><div><span className="section-kicker">{s.id} · {s.unit}</span><h2>Siniestro del {s.fecha}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>
      <div className="sn-facts">
        <div><span>Conductor</span><button className="link" onClick={() => onDriver(s.driver)}>{s.driver.name}</button></div><div><span>Responsabilidad</span><b>{s.resp}</b></div><div><span>Lesionados</span><b>{s.lesionados}</b></div>
        <div><span>Daño</span><b>{s.damage}</b></div><div><span>Reparación</span><span className={`pill mini ${REP_TONE[r.estado]}`}>{r.estado}</span></div><div><span>Asignación</span><b>{r.asig}</b></div>
        <div><span>Cobertura</span><b>{s.cobertura}</b></div><div><span>N° siniestro</span><b>{s.nSin}</b></div><div><span>Estado del reclamo</span><b>{s.claim}</b></div>
        <div><span>Monto reclamado</span><b>{fmtMoney(s.reclamado)}</b></div><div><span>Reconocido</span><b>{fmtMoney(s.reconocido)}</b></div><div><span>Cobrado</span><b>{fmtMoney(s.cobrado)}</b></div>
      </div>
      <div className="sn-actions"><button className="export-button" onClick={() => onBus(s.bus, s)}><BusFront size={15} /> Ver ficha del coche {s.bus.interno}</button></div></>;
  })() : (() => {
    const dr = detail.d; const e = ev!; const bs = [...new Map(e.sin.map((s) => [s.bus.id, s.bus])).values()];
    return <>
      <header className="sn-modal-head"><span className="bus-int"><UserRound size={20} /></span><div><span className="section-kicker">Legajo {dr.legajo} · {dr.unit}</span><h2>{dr.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>
      <div className="sn-facts"><div><span>Siniestros 12 m</span><b>{e.sin.length}</b></div><div><span>Incidentes 12 m</span><b>{e.inc.length}</b></div><div><span>Resp. chofer</span><b>{e.sin.filter((s) => s.resp === 'Chofer').length}</b></div></div>
      <div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={per} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} allowDecimals={false} /><Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} /><Bar dataKey="siniestros" name="Siniestros" fill={C.red} radius={[4, 4, 0, 0]} /><Bar dataKey="incidentes" name="Incidentes" fill={C.amber} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <h4 className="sn-sub">Unidades involucradas</h4><div className="sn-chips inline">{bs.length ? bs.map((b) => <button key={b.id} onClick={() => onBus(b)}>Interno {b.interno}</button>) : <span className="sn-hint">Sin siniestros registrados.</span>}</div>
      <h4 className="sn-sub">Últimos siniestros</h4><div className="g-table-wrap"><table className="g-table clickable"><tbody>{[...e.sin].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5).map((s) => <tr key={s.id} onClick={() => onBus(s.bus, s)}><td>{s.fecha}</td><td><b>{s.bus.interno}</b></td><td>{s.damage}</td><td>{s.resp}</td></tr>)}</tbody></table></div></>;
  })();
  return createPortal(<motion.div className="modal-backdrop bus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="sn-modal" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">{content}</motion.div>
  </motion.div>, document.body);
}
