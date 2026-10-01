import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, AppWindow, ArrowRight, Bolt, Boxes, CircleDot, Cog, Disc3, Download, Droplet, Gauge, Hammer, LayoutGrid, List, Package, PaintBucket, Recycle, Search, ShieldCheck, ShoppingCart, Sparkles, Warehouse, Wrench, X, Zap } from 'lucide-react';
import { UNIT_COLOR, UNIT_NAMES, UnitFilter, UnitName, unitsOf } from '../data';
import { AXIS, GRID, Panel, TOOLTIP_STYLE, fmt, moneyM, pct } from '../ui';
import { useDrill } from '../drill';
import { useOpenUnit } from '../openUnit';
import { useTopEscape } from '../esc';
import { exportView } from '../export';
import { busesOf } from '../taller';
import { ARTS, Art, CATS, CAT_COLOR, Cat, POS, POS_LABEL, POS_SHORT, POS_XY, Pos, Tire, bajoMin, busTires, cobertura, kmDia, minOf, proyeccion, stockOf, tireColor, tiresOf, valorOf, TIRES, PSI_OBJ, HOY } from '../panol';
import chasis from '../../assets/chasis-cubiertas.webp';
import { Bars, C, Tile } from './shared';
import { ArtIllustration, picKind } from './artPics';
import { PHOTOS } from '../artPhotos';

const TABS = ['Stock valorizado', 'Artículos', 'Neumáticos', 'Proyecciones'] as const;
type Tab = (typeof TABS)[number];
const CAT_ICON: Record<Cat, React.ElementType> = { 'Repuesto': Cog, 'Repuesto eléctrico': Zap, 'Herramienta': Wrench, 'Inventario': Package, 'Higiene y seguridad': ShieldCheck, 'Chapa y pintura': PaintBucket, 'Lubricantes': Droplet, 'Ferretería y bulonería': Bolt, 'Neumáticos nuevos': Disc3, 'Neumáticos precurados': Recycle, 'Cristales': AppWindow, 'Gomería': Hammer, 'Consumibles': Sparkles };

// Búsqueda global → abrir una cubierta o las cubiertas de un coche
let pending: { serie?: string; bus?: string } | null = null;
export function focusTire(f: { serie?: string; bus?: string }) { pending = f; window.dispatchEvent(new CustomEvent('solbus-tire')); }

/** Foto del artículo: la del sistema de pañol si está cargada; si no, una imagen ilustrativa de la categoría. */
export function ArtPhoto({ a, big }: { a: Art; big?: boolean }) {
  const ph = a.foto ? null : PHOTOS[picKind(a.nombre)];
  const [err, setErr] = useState(false);
  if (a.foto) return <img className={`art-photo ${big ? 'big' : ''}`} src={a.foto} alt={a.nombre} />;
  if (ph && !err) return <div className={`art-photo real ${big ? 'big' : ''}`} title={a.nombre}><img src={ph.u} alt={a.nombre} loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} />{big && <small>Foto de referencia: {ph.autor} · {ph.lic} · Wikimedia Commons</small>}</div>;
  return <div className={`art-photo pic ${big ? 'big' : ''}`} title={a.nombre}><ArtIllustration nombre={a.nombre} big={big} />{big && <small>Imagen ilustrativa · se reemplaza por la foto del sistema de pañol</small>}</div>;
}

export function PanolView({ unit, notify, requestedTab }: { unit: UnitFilter; notify: (m: string) => void; requestedTab?: { tab: string; n: number } | null }) {
  const [tab, setTab] = useState<Tab>(() => (requestedTab && (TABS as readonly string[]).includes(requestedTab.tab) ? requestedTab.tab as Tab : 'Stock valorizado'));
  useEffect(() => { if (requestedTab && (TABS as readonly string[]).includes(requestedTab.tab)) setTab(requestedTab.tab as Tab); }, [requestedTab]);
  const [cat, setCat] = useState<Cat | null>(null);
  const [onlyLow, setOnlyLow] = useState(false);
  const [art, setArt] = useState<Art | null>(null);
  const [focus, setFocus] = useState<{ serie?: string; bus?: string; n: number } | null>(null);
  useEffect(() => {
    const take = () => { if (pending) { setFocus({ ...pending, n: Date.now() }); pending = null; setTab('Neumáticos'); } };
    take(); window.addEventListener('solbus-tire', take); return () => window.removeEventListener('solbus-tire', take);
  }, []);
  const goArts = (c: Cat | null, low = false) => { setCat(c); setOnlyLow(low); setTab('Artículos'); };

  return <div className="taller panol">
    <section className="t-header">
      <div className="t-title"><span className="t-title-icon" style={{ background: 'linear-gradient(135deg,#64748b,#334155)' }}><Warehouse size={24} /></span><div><span className="section-kicker">Pañol · stock por base</span><h2>Pañol y neumáticos</h2><p>{unit === 'Todos' ? 'Pañoles de Córdoba, Comodoro, San Luis y Villa Mercedes' : `Pañol de ${unit}`} · {ARTS.length} artículos en 13 categorías · {fmt(tiresOf(unit).length)} cubiertas registradas</p></div></div>
      <div className="t-header-tools"><button className="export-button" onClick={() => { const n = exportView('Pañol'); notify(`Exportado a Excel (${n} tablas)`); }}><Download size={15} /> Exportar</button></div>
    </section>
    <nav className="t-tabs" role="tablist">{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
    {tab === 'Stock valorizado' && <Valorizado unit={unit} onCat={(c) => goArts(c)} onLow={() => goArts(null, true)} onArt={setArt} onTires={() => setTab('Neumáticos')} />}
    {tab === 'Artículos' && <Articulos unit={unit} cat={cat} setCat={setCat} onlyLow={onlyLow} setOnlyLow={setOnlyLow} onArt={setArt} />}
    {tab === 'Neumáticos' && <Neumaticos key={focus?.n ?? 0} unit={unit} focus={focus} onProy={() => setTab('Proyecciones')} />}
    {tab === 'Proyecciones' && <Proyecciones unit={unit} onTire={(t) => { setFocus({ serie: t.serie, n: Date.now() }); setTab('Neumáticos'); }} />}
    {art && <ArtDrawer a={art} unit={unit} onClose={() => setArt(null)} onTires={() => { setArt(null); setTab('Neumáticos'); }} />}
    <p className="t-note"><Warehouse size={13} /> Datos demostrativos con la clasificación del sistema de pañol · al conectarlo se usan sus artículos, stock, ubicaciones y fotos.</p>
  </div>;
}

// ---------------- stock valorizado ----------------
function Valorizado({ unit, onCat, onLow, onArt, onTires }: { unit: UnitFilter; onCat: (c: Cat) => void; onLow: () => void; onArt: (a: Art) => void; onTires: () => void }) {
  const drill = useDrill();
  const total = ARTS.reduce((s, a) => s + valorOf(a, unit), 0);
  const conStock = ARTS.filter((a) => stockOf(a, unit) > 0).length;
  const low = ARTS.filter((a) => bajoMin(a, unit));
  const tiresVal = tiresOf(unit).filter((t) => t.estado === 'En stock').reduce((s, t) => s + t.precio, 0);
  const consMes = ARTS.reduce((s, a) => s + (a.consumo[11] * a.precio * (unit === 'Todos' ? 1 : 0.25)), 0);
  const byCat = CATS.map((c) => ({ c, v: ARTS.filter((a) => a.cat === c).reduce((s, a) => s + valorOf(a, unit), 0), n: ARTS.filter((a) => a.cat === c).length, low: ARTS.filter((a) => a.cat === c && bajoMin(a, unit)).length })).sort((a, b) => b.v - a.v);
  const byBase = UNIT_NAMES.map((u) => ({ u, v: ARTS.reduce((s, a) => s + valorOf(a, u), 0) }));
  const top = [...ARTS].sort((a, b) => valorOf(b, unit) - valorOf(a, unit)).slice(0, 10);
  return <>
    <section className="t-kpis six">
      <Tile icon={Warehouse} label="Stock valorizado" value={moneyM(total)} sub={`${unit === 'Todos' ? '4 pañoles' : `pañol ${unit}`}`} color={C.orange} onClick={() => onCat(byCat[0].c)} />
      <Tile icon={Boxes} label="Artículos con stock" value={fmt(conStock)} sub={`de ${ARTS.length} códigos`} color={C.blue} onClick={() => onCat(byCat[0].c)} />
      <Tile icon={AlertTriangle} label="Bajo stock mínimo" value={fmt(low.length)} sub="artículos a reponer" color={C.red} onClick={onLow} />
      <Tile icon={Disc3} label="Cubiertas en pañol" value={moneyM(tiresVal)} sub={`${tiresOf(unit).filter((t) => t.estado === 'En stock').length} cubiertas nuevas y precuradas`} color={C.green} onClick={onTires} />
      <Tile icon={Package} label="Consumo del mes" value={moneyM(consMes)} sub="salidas valorizadas" color={C.purple} />
      <Tile icon={Gauge} label="Cobertura" value={fmt(total / Math.max(1, consMes), 1)} sub="meses de stock al consumo actual" color={C.teal} />
    </section>
    <section className="mt-grid two">
      <Panel kicker="Tocá una categoría para ver sus artículos" title="Stock valorizado por categoría"><ul className="pn-cats">{byCat.map((x) => { const I = CAT_ICON[x.c]; return <li key={x.c}><button onClick={() => onCat(x.c)}><span className="pn-cat-ic" style={{ background: `${CAT_COLOR[x.c]}22`, color: CAT_COLOR[x.c] }}><I size={15} /></span><span className="pn-cat-name">{x.c}<small>{x.n} artículos{x.low ? ` · ${x.low} bajo mínimo` : ''}</small></span><div className="t-hbar-track"><div style={{ width: `${(x.v / byCat[0].v) * 100}%`, background: CAT_COLOR[x.c] }} /></div><b>{moneyM(x.v)}</b><em>{pct((x.v / total) * 100, 1)}</em></button></li>; })}</ul></Panel>
      <Panel kicker="Tocá una base para filtrar" title="Valor por pañol">
        <Bars color={C.orange} fmtV={moneyM} rows={byBase.map((b) => ({ key: b.u, label: <><b>{b.u}</b><small>{ARTS.filter((a) => bajoMin(a, b.u)).length} bajo mínimo</small></>, value: b.v, color: UNIT_COLOR[b.u] }))} onClick={(k) => drill.go('Pañol', { unit: k as UnitName })} />
        <h4 className="pn-h4">Artículos bajo mínimo</h4>
        <div className="g-table-wrap"><table className="g-table clickable"><thead><tr><th></th><th>Artículo</th><th>Stock</th><th>Mín.</th></tr></thead><tbody>{low.slice(0, 7).map((a) => <tr key={a.codigo} onClick={() => onArt(a)}><td><ArtPhoto a={a} /></td><td><b>{a.nombre}</b><small className="pn-sub">{a.cat}</small></td><td className="low">{fmt(stockOf(a, unit))}</td><td>{fmt(minOf(a, unit))}</td></tr>)}</tbody></table></div>
        {low.length > 7 && <button className="text-button" onClick={onLow}>Ver los {low.length} <ArrowRight size={13} /></button>}
      </Panel>
    </section>
    <Panel kicker="Tocá un artículo para ver su ficha" title="Mayor valor en stock"><div className="g-table-wrap"><table className="g-table clickable"><thead><tr><th></th><th>Código</th><th>Artículo</th><th>Categoría</th><th>Stock</th><th>Precio unit.</th><th>Valorizado</th></tr></thead>
      <tbody>{top.map((a) => <tr key={a.codigo} onClick={() => onArt(a)}><td><ArtPhoto a={a} /></td><td>{a.codigo}</td><td><b>{a.nombre}</b></td><td><span className="unit-tag"><i style={{ background: CAT_COLOR[a.cat] }} />{a.cat}</span></td><td>{fmt(stockOf(a, unit))} {a.unidad}</td><td>$ {fmt(a.precio)}</td><td><b>{moneyM(valorOf(a, unit))}</b></td></tr>)}</tbody></table></div></Panel>
  </>;
}

// ---------------- artículos ----------------
function Articulos({ unit, cat, setCat, onlyLow, setOnlyLow, onArt }: { unit: UnitFilter; cat: Cat | null; setCat: (c: Cat | null) => void; onlyLow: boolean; setOnlyLow: (v: boolean) => void; onArt: (a: Art) => void }) {
  const [q, setQ] = useState(''); const [grid, setGrid] = useState(true);
  const list = ARTS.filter((a) => (!cat || a.cat === cat) && (!onlyLow || bajoMin(a, unit)) && `${a.codigo} ${a.nombre} ${a.cat}`.toLowerCase().includes(q.toLowerCase()));
  const val = list.reduce((s, a) => s + valorOf(a, unit), 0);
  return <>
    <div className="pn-filters">
      <div className="hr-chips"><span>Categoría</span><button className={!cat ? 'on' : ''} onClick={() => setCat(null)}>Todas</button>{CATS.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(cat === c ? null : c)}><i style={{ background: CAT_COLOR[c] }} />{c} <em>{ARTS.filter((a) => a.cat === c).length}</em></button>)}</div>
      <div className="pn-tools"><div className="hr-search"><Search size={14} /><input placeholder="Buscar código o artículo…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className={`pn-toggle ${onlyLow ? 'on' : ''}`} onClick={() => setOnlyLow(!onlyLow)}><AlertTriangle size={14} /> Solo bajo mínimo</button>
        <div className="sn-chips inline"><button className={grid ? 'active' : ''} onClick={() => setGrid(true)} aria-label="Vista de fotos"><LayoutGrid size={14} /></button><button className={!grid ? 'active' : ''} onClick={() => setGrid(false)} aria-label="Vista de lista"><List size={14} /></button></div></div>
      <p className="pn-count">{list.length} artículos · {moneyM(val)} valorizado</p>
    </div>
    {grid ? <div className="pn-grid">{list.map((a) => { const s = stockOf(a, unit); const lo = bajoMin(a, unit); return <button key={a.codigo} className={`pn-card ${lo ? 'low' : ''}`} onClick={() => onArt(a)}><ArtPhoto a={a} /><div className="pn-card-body"><small>{a.codigo} · {a.cat}</small><b>{a.nombre}</b><div className="pn-card-foot"><span className={lo ? 'low' : ''}>{fmt(s)} {a.unidad}</span><em>{moneyM(valorOf(a, unit))}</em></div>{lo && <span className="pill mini bad">Bajo mínimo</span>}</div></button>; })}</div>
      : <div className="g-table-wrap"><table className="g-table clickable"><thead><tr><th></th><th>Código</th><th>Artículo</th><th>Categoría</th><th>Stock</th><th>Mínimo</th><th>Cobertura</th><th>Valorizado</th><th>Últ. mov.</th></tr></thead>
        <tbody>{list.map((a) => <tr key={a.codigo} onClick={() => onArt(a)}><td><ArtPhoto a={a} /></td><td>{a.codigo}</td><td><b>{a.nombre}</b></td><td>{a.cat}</td><td className={bajoMin(a, unit) ? 'low' : ''}>{fmt(stockOf(a, unit))} {a.unidad}</td><td>{fmt(minOf(a, unit))}</td><td>{fmt(Math.min(99, cobertura(a, unit)), 1)} m</td><td><b>{moneyM(valorOf(a, unit))}</b></td><td>{a.ultMov}</td></tr>)}</tbody></table></div>}
    {!list.length && <div className="empty-state">No hay artículos con esos filtros.</div>}
  </>;
}

function ArtDrawer({ a, unit, onClose, onTires }: { a: Art; unit: UnitFilter; onClose: () => void; onTires: () => void }) {
  const ref = useRef<HTMLDivElement>(null); useTopEscape(ref, onClose);
  const cons = ['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'].map((m, i) => ({ m, v: a.consumo[i] }));
  return <motion.div ref={ref} data-modal="" className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
    <motion.aside className="detail-drawer metric-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 28 }} onClick={(e) => e.stopPropagation()}>
      <div className="drawer-header"><div><span className="section-kicker">{a.cat} · {a.codigo}</span><h2 className="pn-art-title">{a.nombre}</h2><small>$ {fmt(a.precio)} por {a.unidad} · último movimiento {a.ultMov}</small></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      <ArtPhoto a={a} big />
      <div className="md-stats"><div><span>Stock {unit === 'Todos' ? 'total' : unit}</span><b className={bajoMin(a, unit) ? 'low' : ''}>{fmt(stockOf(a, unit))} {a.unidad}</b></div><div><span>Valorizado</span><b>{moneyM(valorOf(a, unit))}</b></div><div><span>Cobertura</span><b>{fmt(Math.min(99, cobertura(a, unit)), 1)} meses</b></div></div>
      <h3 className="md-sub">Stock por pañol</h3>
      <div className="g-table-wrap"><table className="g-table"><thead><tr><th>Base</th><th>Stock</th><th>Mínimo</th><th>Ubicación</th><th>Estado</th></tr></thead><tbody>{UNIT_NAMES.map((u) => <tr key={u} className={unitsOf(unit).includes(u) ? '' : 'muted-row'}><td><span className="unit-tag"><i style={{ background: UNIT_COLOR[u] }} />{u}</span></td><td><b>{fmt(a.stock[u])}</b></td><td>{fmt(a.min[u])}</td><td>{a.ubic[u]}</td><td>{a.stock[u] < a.min[u] ? <span className="pill mini bad">Reponer</span> : <span className="pill mini good">OK</span>}</td></tr>)}</tbody></table></div>
      <h3 className="md-sub">Consumo de los últimos 12 meses ({a.unidad})</h3>
      <div className="md-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={cons} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} /><Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} formatter={(v: number) => [`${fmt(v)} ${a.unidad}`, 'Salidas']} /><Bar dataKey="v" fill={CAT_COLOR[a.cat]} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
      {a.cat.startsWith('Neumáticos') && <button className="drawer-cta" onClick={onTires}>Ver cubiertas, ubicaciones y desgaste <ArrowRight size={16} /></button>}
    </motion.aside></motion.div>;
}

// ---------------- neumáticos ----------------
export function TireLayout({ busId, sel, onPick, compact }: { busId: string; sel?: Pos | null; onPick?: (p: Pos) => void; compact?: boolean }) {
  const ts = busTires(busId);
  return <div className={`tl-wrap ${compact ? 'compact' : ''}`}>
    <img src={chasis} alt="Esquema de chasis visto desde arriba" className="tl-img" />
    <span className="tl-front">FRENTE ▲</span>
    {POS.map((p) => { const t = ts.find((x) => x.pos === p); if (!t) return null; const xy = POS_XY[p]; const col = tireColor(t);
      return <button key={p} className={`tl-tire ${sel === p ? 'on' : ''}`} style={{ left: `${xy.x}%`, top: `${xy.y}%`, width: `${xy.w}%`, height: `${xy.h}%`, ['--c' as string]: col }} onClick={() => onPick?.(p)} title={`${POS_LABEL[p]} · ${t.serie} · ${fmt(t.mm, 1)} mm`}>
        <span className={`tl-tag ${p.startsWith('T') ? 'low' : ''} ${p.endsWith('I') && p !== 'DI' ? 'in' : ''} ${p === 'DD' || p === 'TDE' || p === 'TDI' ? 'right' : 'left'}`}><b>{fmt(t.mm, 1)} mm</b><small>{t.serie}</small></span>
      </button>; })}
  </div>;
}

function Neumaticos({ unit, focus, onProy }: { unit: UnitFilter; focus: { serie?: string; bus?: string } | null; onProy: () => void }) {
  const openUnit = useOpenUnit();
  const ts = useMemo(() => tiresOf(unit), [unit]);
  const mont = ts.filter((t) => t.estado === 'Montada');
  const buses = useMemo(() => busesOf(unit).map((b) => { const bt = busTires(b.id); return { b, min: Math.min(...bt.map((t) => t.mm - t.limite)), next: Math.min(...bt.map((t) => t.diasCambio ?? 999)) }; }).sort((x, y) => x.next - y.next), [unit]);
  const ft = focus?.serie ? TIRES.find((t) => t.serie === focus.serie) : undefined;
  const [busId, setBusId] = useState<string>(ft?.bus?.id ?? focus?.bus ?? buses[0]?.b.id);
  const [pos, setPos] = useState<Pos | null>(ft?.pos ?? 'DI');
  const [stockT, setStockT] = useState<Tire | null>(ft && ft.estado !== 'Montada' ? ft : null);
  const [q, setQ] = useState(''); const [bq, setBq] = useState('');
  const [win, setWin] = useState(30);
  const bt = busTires(busId); const tire = stockT ?? bt.find((t) => t.pos === pos) ?? bt[0];
  const bus = bt[0]?.bus;
  const hits = q.trim().length >= 2 ? TIRES.filter((t) => `${t.serie} ${t.bus?.interno ?? ''} ${t.marca}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const pick = (t: Tire) => { setQ(''); if (t.estado === 'Montada' && t.bus) { setBusId(t.bus.id); setPos(t.pos!); setStockT(null); } else setStockT(t); document.querySelector('.tl-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const prox = mont.filter((t) => (t.diasCambio ?? 999) <= win).sort((a, b) => (a.diasCambio ?? 0) - (b.diasCambio ?? 0));
  const stock = ts.filter((t) => t.estado === 'En stock' || t.estado === 'En recapado');
  const psiOut = mont.filter((t) => Math.abs(t.psi - PSI_OBJ) > 8).length;
  const proy = proyeccion(unit); const compra6 = proy.reduce((s, m) => s + m.costo, 0);
  return <>
    <section className="t-kpis six">
      <Tile icon={CircleDot} label="Cubiertas montadas" value={fmt(mont.length)} sub={`${busesOf(unit).length} coches × 6 posiciones`} color={C.blue} />
      <Tile icon={Warehouse} label="En pañol" value={fmt(ts.filter((t) => t.estado === 'En stock').length)} sub={`${ts.filter((t) => t.estado === 'En stock' && t.tipo === 'Nueva').length} nuevas · ${ts.filter((t) => t.estado === 'En stock' && t.tipo === 'Precurada').length} precuradas`} color={C.green} onClick={() => document.getElementById('pn-stock')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <Tile icon={Recycle} label="En recapado" value={fmt(ts.filter((t) => t.estado === 'En recapado').length)} sub="cascos en proveedor" color={C.teal} onClick={() => document.getElementById('pn-stock')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      <Tile icon={AlertTriangle} label="A cambiar en 30 días" value={fmt(mont.filter((t) => (t.diasCambio ?? 999) <= 30).length)} sub="llegan al dibujo mínimo" color={C.red} onClick={() => { setWin(30); document.getElementById('pn-prox')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />
      <Tile icon={Gauge} label="Dibujo promedio" value={`${fmt(mont.reduce((s, t) => s + t.mm, 0) / Math.max(1, mont.length), 1)} mm`} sub={`${psiOut} con presión fuera de rango`} color={C.amber} />
      <Tile icon={ShoppingCart} label="Compra proyectada" value={moneyM(compra6)} sub="próximos 6 meses" color={C.purple} onClick={onProy} />
    </section>

    <section className="tl-main">
      <aside className="tl-side">
        <div className="tl-search"><Search size={14} /><input placeholder="Consultar n° de fuego, interno o marca…" value={q} onChange={(e) => setQ(e.target.value)} />
          {hits.length > 0 && <div className="tl-hits">{hits.map((t) => <button key={t.serie} onClick={() => pick(t)}><b>{t.serie}</b><span>{t.ubic}</span><em style={{ color: tireColor(t) }}>{t.estado === 'Montada' ? `${fmt(t.mm, 1)} mm` : t.estado}</em></button>)}</div>}</div>
        <div className="hr-search small"><Search size={13} /><input placeholder="Filtrar coches…" value={bq} onChange={(e) => setBq(e.target.value)} /></div>
        <span className="section-kicker">Coches · ordenados por próximo cambio</span>
        <ul className="tl-buses">{buses.filter((x) => String(x.b.interno).includes(bq)).slice(0, 60).map((x) => <li key={x.b.id}><button className={x.b.id === busId && !stockT ? 'on' : ''} onClick={() => { setBusId(x.b.id); setStockT(null); }}><span className="kc-int">{x.b.interno}</span><span>{x.b.unit}<small>{x.b.modelo.replace('Mercedes-Benz ', 'MB ')}</small></span><em className={x.next <= 30 ? 'low' : x.next <= 90 ? 'warn' : 'ok'}>{x.next <= 0 ? 'cambiar ya' : `${x.next} d`}</em></button></li>)}</ul>
      </aside>
      <div className="tl-center">
        <div className="tl-head"><div><span className="section-kicker">{stockT ? 'Cubierta fuera de coche' : `${bus?.unit} · ${bus?.modelo}`}</span><h3>{stockT ? stockT.serie : `Interno ${bus?.interno}`}</h3></div>{!stockT && bus && <button className="text-button" onClick={() => openUnit(bus.id)}>Ficha del coche <ArrowRight size={13} /></button>}</div>
        {stockT ? <div className="tl-stockbox"><Warehouse size={30} /><b>{stockT.estado}</b><p>{stockT.ubic}</p><button className="text-button" onClick={() => setStockT(null)}>Volver al coche</button></div>
          : <TireLayout busId={busId} sel={pos} onPick={(p) => setPos(p)} />}
        <div className="tl-legend"><span><i style={{ background: '#22c55e' }} />más de 4 mm sobre el mínimo</span><span><i style={{ background: '#f59e0b' }} />1,5 a 4 mm</span><span><i style={{ background: '#ef4444' }} />menos de 1,5 mm</span></div>
      </div>
      {tire && <TireDetail t={tire} />}
    </section>

    <section className="mt-grid two">
      <div id="pn-prox"><Panel kicker="Tocá una para ubicarla en el coche" title={`Próximas a cambiar · ${prox.length}`} right={<div className="sn-chips inline">{[30, 60, 90].map((d) => <button key={d} className={win === d ? 'active' : ''} onClick={() => setWin(d)}>{d} días</button>)}</div>}>
        <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>N° fuego</th><th>Coche</th><th>Posición</th><th>Dibujo</th><th>Cambio</th><th>Tipo</th></tr></thead>
          <tbody>{prox.slice(0, 40).map((t) => <tr key={t.serie} onClick={() => pick(t)}><td><b>{t.serie}</b></td><td>{t.bus?.interno} · {t.unit}</td><td>{POS_SHORT[t.pos!]}</td><td className="low">{fmt(t.mm, 1)} mm</td><td className={(t.diasCambio ?? 0) <= 7 ? 'low' : ''}>{t.diasCambio === 0 ? 'Ya' : `${t.fechaCambio} (${t.diasCambio} d)`}</td><td>{t.tipo}{t.vida ? ` · vida ${t.vida}` : ''}</td></tr>)}
            {!prox.length && <tr><td colSpan={6} className="empty-cell">Ninguna cubierta llega al mínimo en ese plazo.</td></tr>}</tbody></table></div></Panel></div>
      <div id="pn-stock"><Panel kicker="Fuera de coche" title={`Cubiertas en pañol y recapado · ${stock.length}`}>
        <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>N° fuego</th><th>Medida</th><th>Tipo</th><th>Marca</th><th>Estado</th><th>Ubicación</th></tr></thead>
          <tbody>{stock.map((t) => <tr key={t.serie} onClick={() => pick(t)}><td><b>{t.serie}</b></td><td>{t.medida}</td><td>{t.tipo}{t.vida ? ` · vida ${t.vida}` : ''}</td><td>{t.marca}</td><td>{t.estado === 'En stock' ? <span className="pill mini good">En pañol</span> : <span className="pill mini warn">Recapado</span>}</td><td>{t.ubic}</td></tr>)}</tbody></table></div></Panel></div>
    </section>
  </>;
}

function TireDetail({ t }: { t: Tire }) {
  const kd = kmDia(t.unit);
  const data = t.med.map((m) => ({ fecha: m.fecha.slice(0, 5), mm: m.mm, proy: null as number | null }));
  if (t.estado === 'Montada' && t.diasCambio !== null && data.length) {
    data[data.length - 1].proy = data[data.length - 1].mm;
    for (let k = 1; k <= 4; k++) { const dd = Math.round((t.diasCambio / 4) * k); const d = new Date(HOY.getTime() + dd * 86400000); data.push({ fecha: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, mm: null as unknown as number, proy: +(t.mm - (t.tasa * kd * dd) / 10000).toFixed(1) }); }
  }
  const usado = ((t.inicial - t.mm) / (t.inicial - t.limite)) * 100;
  return <aside className="tl-detail">
    <span className="section-kicker">{t.pos ? POS_LABEL[t.pos] : t.estado}</span>
    <h3>{t.serie} <small>{t.marca}</small></h3>
    <div className="tl-depth"><div className="tl-depth-bar"><div style={{ width: `${Math.max(3, 100 - usado)}%`, background: tireColor(t) }} /></div><b style={{ color: tireColor(t) }}>{fmt(t.mm, 1)} mm</b><small>de {t.inicial} mm · mínimo {t.limite} mm</small></div>
    <dl className="tl-dl">
      <div><dt>Medida</dt><dd>{t.medida}</dd></div><div><dt>Tipo</dt><dd>{t.tipo}{t.vida ? ` · vida ${t.vida}` : ''}</dd></div>
      <div><dt>Presión</dt><dd className={Math.abs(t.psi - PSI_OBJ) > 8 ? 'low' : ''}>{t.psi} psi <small>(obj. {PSI_OBJ})</small></dd></div><div><dt>Desgaste</dt><dd>{fmt(t.tasa, 2)} mm / 10.000 km</dd></div>
      <div><dt>Km en esta posición</dt><dd>{fmt(t.kmMont)}</dd></div><div><dt>Km totales</dt><dd>{fmt(t.kmTotal)}</dd></div>
      <div><dt>Montada</dt><dd>{t.montada ?? '–'}</dd></div><div><dt>Cambio estimado</dt><dd className={(t.diasCambio ?? 99) <= 30 ? 'low' : ''}>{t.fechaCambio ? `${t.fechaCambio} · ${t.diasCambio} días` : '–'}</dd></div>
      <div className="wide"><dt>Ubicación</dt><dd>{t.ubic}</dd></div>
    </dl>
    {data.length > 0 && <><h4 className="pn-h4">Mediciones de dibujo y proyección</h4><div className="tl-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ ...AXIS, fontSize: 9 }} interval="preserveStartEnd" /><YAxis domain={[0, t.inicial]} axisLine={false} tickLine={false} tick={{ ...AXIS, fontSize: 9 }} />
      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, n: string) => [`${fmt(v, 1)} mm`, n]} /><ReferenceLine y={t.limite} stroke="#ef4444" strokeDasharray="4 4" />
      <Line dataKey="mm" name="Medido" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2.5, fill: '#3b82f6' }} connectNulls={false} isAnimationActive={false} /><Line dataKey="proy" name="Proyección" stroke="#f97316" strokeDasharray="5 4" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} /></LineChart></ResponsiveContainer></div></>}
    <h4 className="pn-h4">Movimientos</h4>
    <ul className="tl-movs">{t.movs.map((m, i) => <li key={i}><time>{m.fecha}</time>{m.detalle}</li>)}</ul>
  </aside>;
}

// ---------------- proyecciones ----------------
function Proyecciones({ unit, onTire }: { unit: UnitFilter; onTire: (t: Tire) => void }) {
  const proy = proyeccion(unit);
  const mont = tiresOf(unit).filter((t) => t.estado === 'Montada');
  const buckets = [[0, 3], [3, 5], [5, 8], [8, 11], [11, 17]].map(([a, b]) => ({ r: `${a}–${b} mm`, n: mont.filter((t) => t.mm >= a && t.mm < b).length, c: b <= 5 ? '#ef4444' : b <= 8 ? '#f59e0b' : '#22c55e' }));
  const marcas = [...new Set(mont.map((t) => t.marca))].map((m) => { const xs = mont.filter((t) => t.marca === m); const tasa = xs.reduce((s, t) => s + t.tasa, 0) / xs.length; const kmVida = xs.reduce((s, t) => s + ((t.inicial - t.limite) / t.tasa) * 10000, 0) / xs.length; const costoKm = xs.reduce((s, t) => s + t.precio / (((t.inicial - t.limite) / t.tasa) * 10000), 0) / xs.length * 1000; return { m, n: xs.length, tasa, kmVida, costoKm, prec: (xs.filter((t) => t.tipo === 'Precurada').length / xs.length) * 100 }; }).sort((a, b) => a.costoKm - b.costoKm);
  const worst = [...mont].sort((a, b) => (a.diasCambio ?? 0) - (b.diasCambio ?? 0)).slice(0, 8);
  const tot = proy.reduce((s, m) => ({ n: s.n + m.nuevas, p: s.p + m.precuradas, cn: s.cn + m.compN, cp: s.cp + m.compP, c: s.c + m.costo }), { n: 0, p: 0, cn: 0, cp: 0, c: 0 });
  return <>
    <section className="t-kpis six">
      <Tile icon={CircleDot} label="Cambios en 6 meses" value={fmt(tot.n + tot.p)} sub={`${tot.n} delanteras · ${tot.p} traseras`} color={C.orange} />
      <Tile icon={ShoppingCart} label="A comprar nuevas" value={fmt(tot.cn)} sub="después de usar el stock" color={C.green} />
      <Tile icon={Recycle} label="A comprar precuradas" value={fmt(tot.cp)} sub="además de los cascos propios" color={C.teal} />
      <Tile icon={Package} label="Inversión proyectada" value={moneyM(tot.c)} sub="6 meses" color={C.purple} />
      <Tile icon={Gauge} label="Mejor costo por km" value={marcas[0]?.m.split(' ')[0] ?? '–'} sub={marcas[0] ? `$ ${fmt(marcas[0].costoKm, 1)} cada 1.000 km` : ''} color={C.blue} />
      <Tile icon={AlertTriangle} label="Bajo el mínimo hoy" value={fmt(mont.filter((t) => t.diasCambio === 0).length)} sub="cambiar en la próxima entrada" color={C.red} onClick={() => worst[0] && onTire(worst[0])} />
    </section>
    <section className="mt-grid two">
      <Panel kicker="Cubiertas que llegan al dibujo mínimo por mes" title="Proyección de cambios"><div className="g-chart-box short"><ResponsiveContainer width="100%" height="100%"><BarChart data={proy} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}><CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={AXIS} /><YAxis axisLine={false} tickLine={false} tick={AXIS} allowDecimals={false} /><Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--cursor)' }} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: 'var(--ax)' }} />
        <Bar dataKey="nuevas" name="Delanteras (van nuevas)" fill="#22c55e" radius={[4, 4, 0, 0]} isAnimationActive={false} /><Bar dataKey="precuradas" name="Traseras (van precuradas)" fill="#84cc16" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></Panel>
      <Panel kicker="Flota montada" title="Distribución del dibujo"><Bars color={C.green} fmtV={(v) => `${fmt(v)} cub.`} rows={buckets.map((b) => ({ key: b.r, label: <b>{b.r}</b>, value: b.n, color: b.c }))} /></Panel>
    </section>
    <Panel kicker="Usa primero el stock del pañol y los cascos que vuelven del recapado" title="Proyección de compras de neumáticos"><div className="g-table-wrap"><table className="g-table"><thead><tr><th>Mes</th><th>Cambios delanteros</th><th>Cambios traseros</th><th>Stock nuevas después</th><th>Stock precuradas después</th><th>Comprar nuevas</th><th>Comprar precuradas</th><th>Inversión</th></tr></thead>
      <tbody>{proy.map((m) => <tr key={m.i}><td><b>{m.label}</b></td><td>{m.nuevas}</td><td>{m.precuradas}</td><td>{m.stockN}</td><td>{m.stockP}</td><td className={m.compN ? 'low' : ''}>{m.compN}</td><td className={m.compP ? 'low' : ''}>{m.compP}</td><td><b>{moneyM(m.costo)}</b></td></tr>)}</tbody>
      <tfoot><tr><td>TOTAL 6 MESES</td><td>{tot.n}</td><td>{tot.p}</td><td></td><td></td><td>{tot.cn}</td><td>{tot.cp}</td><td>{moneyM(tot.c)}</td></tr></tfoot></table></div></Panel>
    <section className="mt-grid two">
      <Panel kicker="Promedio de la flota montada" title="Rendimiento por marca"><div className="g-table-wrap"><table className="g-table"><thead><tr><th>Marca</th><th>Cubiertas</th><th>Desgaste</th><th>Km por vida</th><th>$ cada 1.000 km</th><th>Precuradas</th></tr></thead><tbody>{marcas.map((x) => <tr key={x.m}><td><b>{x.m}</b></td><td>{x.n}</td><td>{fmt(x.tasa, 2)} mm/10k km</td><td>{fmt(x.kmVida)}</td><td>$ {fmt(x.costoKm, 1)}</td><td>{pct(x.prec, 0)}</td></tr>)}</tbody></table></div></Panel>
      <Panel kicker="Tocá una para verla en el coche" title="Las más gastadas"><ul className="tg-buses">{worst.map((t) => <li key={t.serie}><button onClick={() => onTire(t)}><span className="kc-int">{t.bus?.interno}</span><div><strong>{t.serie} · {POS_SHORT[t.pos!]}</strong><small>{t.unit} · {t.marca}</small></div><em className="low">{fmt(t.mm, 1)} mm</em></button></li>)}</ul></Panel>
    </section>
  </>;
}
