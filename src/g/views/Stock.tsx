import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Boxes, CalendarClock, ChevronRight, PackageCheck, PackageMinus, PackagePlus, Search, ShoppingCart, Wallet, X } from 'lucide-react';
import { UNIT_COLOR, UnitFilter } from '../data';
import { AXIS, GRID, Panel, TOOLTIP_STYLE, fmt, money, moneyM } from '../ui';
import { StockEstado, StockRow, materialDetail, stockRows } from '../stock';
import { useOpenUnit } from '../openUnit';
import { useTopEscape } from '../esc';
import { C, Donut, Tile } from './shared';

const TONE: Record<StockEstado, string> = { 'Crítico': 'bad', Reponer: 'warn', OK: 'good', Sobrestock: 'unit' };
const cob = (d: number) => (!isFinite(d) ? 'sin consumo' : d >= 365 ? '+1 año' : `${fmt(d, 0)} días`);

export function StockTab({ unit, notify }: { unit: UnitFilter; notify: (m: string) => void }) {
  const rows = useMemo(() => stockRows(unit), [unit]);
  const [est, setEst] = useState<'Todos' | StockEstado>('Todos');
  const [sys, setSys] = useState('Todos');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'valor' | 'cobertura' | 'consumo'>('valor');
  const [sel, setSel] = useState<StockRow | null>(null);
  const [n, setN] = useState(15);
  const systems = ['Todos', ...Array.from(new Set(rows.map((r) => r.system)))];
  const count = (e: StockEstado) => rows.filter((r) => r.estado === e).length;
  const valor = rows.reduce((s, r) => s + r.valor, 0);
  const aComprar = rows.filter((r) => r.estado === 'Crítico' || r.estado === 'Reponer').reduce((s, r) => s + r.sugerido * r.price, 0);
  const withCons = rows.filter((r) => isFinite(r.cobertura));
  const cobProm = withCons.reduce((s, r) => s + Math.min(r.cobertura, 365), 0) / Math.max(1, withCons.length);
  const list = rows.filter((r) => (est === 'Todos' || r.estado === est) && (sys === 'Todos' || r.system === sys) && (!q || `${r.code} ${r.name} ${r.comp}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (sort === 'valor' ? b.valor - a.valor : sort === 'consumo' ? b.consumoMes - a.consumoMes : a.cobertura - b.cobertura));
  const bySys = Array.from(new Set(rows.map((r) => r.system))).map((s, i) => ({ name: s, value: rows.filter((r) => r.system === s).reduce((t, r) => t + r.valor, 0), color: [C.orange, C.teal, C.red, C.blue, C.purple, C.cyan][i % 6] }));

  return <>
    <section className="t-kpis six">
      <Tile icon={Boxes} label="Ítems en pañol" value={rows.length} sub="códigos" color={C.blue} onClick={() => { setEst('Todos'); setSys('Todos'); }} />
      <Tile icon={Wallet} label="Valor del stock" value={moneyM(valor)} color={C.green} onClick={() => setSort('valor')} />
      <Tile icon={AlertTriangle} label="Críticos" value={count('Crítico')} sub="bajo 50% del mínimo" color={C.red} onClick={() => setEst('Crítico')} />
      <Tile icon={PackageMinus} label="A reponer" value={count('Reponer')} sub="bajo el mínimo" color={C.amber} onClick={() => setEst('Reponer')} />
      <Tile icon={PackagePlus} label="Sobrestock" value={count('Sobrestock')} sub="+3 meses de consumo" color={C.purple} onClick={() => setEst('Sobrestock')} />
      <Tile icon={CalendarClock} label="Cobertura promedio" value={`${fmt(cobProm, 0)} días`} color={C.teal} onClick={() => setSort('cobertura')} />
    </section>
    <section className="stk-top">
        <Panel kicker="Valor del stock" title="Por sistema del coche"><Donut center={moneyM(valor)} sub="STOCK" data={bySys} /></Panel>
        <Panel kicker="Compras sugeridas" title="Para volver al stock objetivo"><div className="stk-buy"><ShoppingCart size={22} /><div><strong>{moneyM(aComprar)}</strong><small>{count('Crítico') + count('Reponer')} materiales bajo el mínimo</small></div></div>
          <button className="export-button" onClick={() => { setEst('Crítico'); notify('Filtrado: materiales críticos para reposición'); }}>Ver críticos <ChevronRight size={14} /></button></Panel>
    </section>
      <Panel kicker="Pañol · stock actual" title={`Materiales · ${list.length}`} right={<div className="stk-tools"><label className="stk-search"><Search size={14} /><input placeholder="Código, material o componente" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="valor">Mayor valor</option><option value="cobertura">Menor cobertura</option><option value="consumo">Mayor consumo</option></select></div>}>
        <div className="sn-chips">{(['Todos', 'Crítico', 'Reponer', 'OK', 'Sobrestock'] as const).map((x) => <button key={x} className={est === x ? 'active' : ''} onClick={() => setEst(x)}>{x}{x !== 'Todos' && <em>{count(x)}</em>}</button>)}</div>
        <div className="sn-chips">{systems.map((x) => <button key={x} className={sys === x ? 'active' : ''} onClick={() => setSys(x)}>{x}</button>)}</div>
        <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>Código</th><th>Material</th><th>Componente</th><th>Stock</th><th>Mínimo</th><th>Consumo / mes</th><th>Cobertura</th><th>Estado</th><th>Valor</th><th>Sugerido</th></tr></thead>
          <tbody>{list.slice(0, n).map((r) => <tr key={r.code} onClick={() => setSel(r)}><td className="mono">{r.code}</td><td><b>{r.name}</b></td><td>{r.comp}</td><td><b>{fmt(r.stock)}</b> {r.unit}</td><td>{fmt(r.min)}</td><td>{fmt(r.consumoMes, 1)}</td><td className={r.cobertura < 15 ? 'low' : ''}>{cob(r.cobertura)}</td><td><span className={`pill mini ${TONE[r.estado]}`}>{r.estado}</span></td><td>{money(r.valor, 0)}</td><td>{r.sugerido ? `${fmt(r.sugerido)} ${r.unit}` : '—'}</td></tr>)}
            {!list.length && <tr><td colSpan={10} className="empty-cell">Sin materiales para este filtro.</td></tr>}</tbody></table></div>
        {list.length > n && <button className="text-button sn-more" onClick={() => setN(n + 20)}>Ver más ({list.length - n} restantes)</button>}
      </Panel>

    <AnimatePresence>{sel && <MaterialDrawer row={sel} unit={unit} onClose={() => setSel(null)} />}</AnimatePresence>
  </>;
}

function MaterialDrawer({ row, unit, onClose }: { row: StockRow; unit: UnitFilter; onClose: () => void }) {
  const openUnit = useOpenUnit();
  const det = useMemo(() => materialDetail(row.code, unit), [row.code, unit]);
  const ref = useRef<HTMLDivElement>(null); useTopEscape(ref, onClose);
  return createPortal(<motion.div ref={ref} data-modal="" className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
    <motion.aside className="detail-drawer metric-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 28 }} onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header"><div><span className="section-kicker">Pañol · {row.code} · {row.system}</span><h2>{row.name}</h2><small>{row.comp} · {money(row.price, 0)} por {row.unit}</small></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      <div className="bd-kpis four"><div><PackageCheck size={16} /><span>Stock</span><strong>{fmt(row.stock)} {row.unit}</strong><small>mínimo {fmt(row.min)}</small></div><div><CalendarClock size={16} /><span>Cobertura</span><strong className={row.cobertura < 15 ? 'low' : ''}>{cob(row.cobertura)}</strong><small>{fmt(row.consumoMes, 1)} {row.unit} por mes</small></div>
        <div><Wallet size={16} /><span>Valor</span><strong>{money(row.valor, 0)}</strong><small>estado {row.estado.toLowerCase()}</small></div><div><ShoppingCart size={16} /><span>Sugerido</span><strong>{row.sugerido ? `${fmt(row.sugerido)} ${row.unit}` : '—'}</strong><small>{row.sugerido ? money(row.sugerido * row.price, 0) : 'stock suficiente'}</small></div></div>
      <h3 className="md-sub">Consumo mensual (12 meses)</h3>
      <div className="md-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={det.months} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} allowDecimals={false} /><Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} formatter={(v: number, nm: string) => (nm === 'importe' ? [money(v, 0), 'Importe'] : [`${fmt(v)} ${row.unit}`, 'Cantidad'])} /><Bar dataKey="qty" fill={C.orange} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
      <h3 className="md-sub">Stock por base</h3>
      <ul className="md-units-list">{row.porBase.map((b) => <li key={b.u}><div className="md-static"><span><i style={{ background: UNIT_COLOR[b.u] }} />{b.u}</span><div className="md-bar"><div style={{ width: `${Math.min(100, (b.stock / Math.max(1, ...row.porBase.map((x) => x.stock))) * 100)}%`, background: UNIT_COLOR[b.u] }} /></div><b>{fmt(b.stock)} {row.unit}</b></div></li>)}</ul>
      <h3 className="md-sub">Últimas OT que lo usaron <em>tocá para abrir la ficha</em></h3>
      {det.recent.length ? det.recent.map(({ o, qty }) => <button className="bd-row" key={o.id} onClick={() => openUnit(o.unit, { order: o.id })}><span className="kc-int">{o.unit}</span><div><strong>{o.title}</strong><small>{o.id} · {o.base} · {o.closed!.toLocaleDateString('es-AR')} · {fmt(qty)} {row.unit}</small></div><ChevronRight size={15} /></button>) : <p className="muted">Sin consumos registrados en los últimos 12 meses.</p>}
    </motion.aside>
  </motion.div>, document.body);
}
