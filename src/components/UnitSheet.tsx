import { isTopModal } from '../g/esc';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BusFront, CalendarClock, ChevronRight, CircleDollarSign, Clock3, Gauge, Hammer, Layers, PackageSearch, Route, User, Wrench, X } from 'lucide-react';
import { BusDiagram } from './BusDiagram';
import { componentById, systems } from '../data/catalog';
import { daysBetween, isOpen, now, orderCost, PREVENTIVE_KM, SERVICE_KM } from '../data/fleet';
import { componentStats, lineComponent, lineCost, summarizeMaterials } from '../data/stats';
import type { BusView, Unit, WorkOrder } from '../data/types';
import { ago, date, dateTime, fmt, money, moneyShort } from '../lib/format';

const ranges = { '90 días': 90, '12 meses': 365, Historial: 10_000 } as const;
type Range = keyof typeof ranges;

export const statusClass = (s: string) => s.toLowerCase().replace(/\s+/g, '-');

export function UnitSheet({ unit, initialOrder, initialComponent, onClose }: { unit: Unit; initialOrder?: string; initialComponent?: string; onClose: () => void }) {
  const [view, setView] = useState<BusView>('corte');
  const [range, setRange] = useState<Range>('12 meses');
  const [component, setComponent] = useState<string | null>(initialComponent ?? null);
  const [orderId, setOrderId] = useState<string | null>(initialOrder ?? null);

  const orders = useMemo(() => unit.orders.filter((o) => isOpen(o) || daysBetween(o.opened, now) <= ranges[range]), [unit, range]);
  const order = orderId ? unit.orders.find((o) => o.id === orderId) ?? null : null;
  const stats = useMemo(() => componentStats(orders), [orders]);
  const compOrders = component ? orders.filter((o) => o.components.includes(component)) : orders;
  const materials = useMemo(() => summarizeMaterials(orders, component), [orders, component]);
  const totalCost = orders.reduce((s, o) => s + orderCost(o), 0);
  const totalHours = orders.reduce((s, o) => s + o.hours, 0);
  const open = unit.orders.filter(isOpen);
  const sinceService = unit.km - unit.lastServiceKm; const sincePrev = unit.km - unit.lastPreventiveKm;

  useEffect(() => { // si la OT elegida no tiene nada visible en la vista actual, cambiar de vista
    if (order && !order.components.some((c) => componentById[c].spots[view])) setView(view === 'corte' ? 'chasis' : 'corte');
  }, [order]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && isTopModal(sheetRef.current) && (orderId ? setOrderId(null) : onClose()); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [orderId, onClose]);

  const bySystem = systems.map((sys) => ({ sys, cost: orders.reduce((s, o) => s + o.materials.filter((m) => componentById[lineComponent(o, m)].system === sys).reduce((a, m) => a + lineCost(m), 0), 0) })).sort((a, b) => b.cost - a.cost);
  const maxSys = Math.max(1, ...bySystem.map((s) => s.cost));

  const selectComponent = (id: string | null) => { setOrderId(null); setComponent(id); };

  return <motion.div ref={sheetRef} data-modal="" className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.section className="unit-sheet" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 240 }} onClick={(e) => e.stopPropagation()}>
      <header className="sheet-head">
        <div className="sheet-title">
          <div className="interno-badge"><small>Interno</small><strong>{unit.interno}</strong></div>
          <div>
            <span className="section-kicker">Ficha técnica · {unit.base} · Línea {unit.line}</span>
            <h2>{unit.body} <span>· {unit.chassis}</span></h2>
            <div className="sheet-tags"><span className={`status-pill ${statusClass(unit.status)}`}>{unit.status}</span><span>{unit.plate}</span><span>Modelo {unit.year}</span><span>{fmt(unit.km)} km</span></div>
          </div>
        </div>
        <div className="sheet-actions">
          <div className="segmented small">{(Object.keys(ranges) as Range[]).map((r) => <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>)}</div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
        </div>
      </header>

      <div className="sheet-kpis">
        <div><Hammer size={16} /><span>Órdenes de trabajo</span><strong>{orders.length}</strong><small>{open.length ? `${open.length} abierta${open.length > 1 ? 's' : ''}` : 'ninguna abierta'}</small></div>
        <div><CircleDollarSign size={16} /><span>Materiales</span><strong>{moneyShort(totalCost)}</strong><small>{fmt(orders.reduce((s, o) => s + o.materials.length, 0))} ítems de pañol</small></div>
        <div><Clock3 size={16} /><span>Horas hombre</span><strong>{fmt(totalHours, 1)} h</strong><small>{fmt(totalHours / Math.max(1, orders.length), 1)} h por OT</small></div>
        <div><Gauge size={16} /><span>Costo por km</span><strong>{money(totalCost / Math.max(1, Math.min(unit.km, ranges[range] * 200)))}</strong><small>estimado sobre km del período</small></div>
      </div>

      <div className="sheet-body">
        <div className="sheet-main">
          <div className="panel bus-panel">
            <div className="panel-heading"><div><span className="section-kicker">{order ? `${order.id} · ${order.title}` : component ? 'Componente seleccionado' : 'Mapa de intervenciones del coche'}</span><h3>{order ? 'Piezas y áreas intervenidas' : component ? componentById[component].name : 'Tocá una zona del bus para ver qué se hizo'}</h3></div>{(order || component) && <button className="text-button" onClick={() => { setOrderId(null); setComponent(null); }}><ArrowLeft size={14} /> Ver todo</button>}</div>
            <BusDiagram view={view} onView={setView} stats={stats} highlight={order?.components} selected={component} onSelect={selectComponent} />
          </div>
          <div className="sheet-cards">
            <div className="panel mini-card">
              <span className="section-kicker">Plan de mantenimiento</span>
              <PlanBar label="Service (aceite y filtros)" done={sinceService} every={SERVICE_KM} />
              <PlanBar label="Preventivo general" done={sincePrev} every={PREVENTIVE_KM} />
            </div>
            <div className="panel mini-card">
              <span className="section-kicker">Costo de materiales por sistema</span>
              {bySystem.filter((s) => s.cost > 0).slice(0, 5).map((s) => <div className="sys-row" key={s.sys}><span>{s.sys}</span><div className="sys-bar"><i style={{ width: `${(s.cost / maxSys) * 100}%` }} /></div><b>{moneyShort(s.cost)}</b></div>)}
            </div>
            <div className="panel mini-card tech">
              <span className="section-kicker">Datos del coche</span>
              <dl><dt>Dominio</dt><dd>{unit.plate}</dd><dt>Chasis</dt><dd>{unit.chassis}</dd><dt>Carrocería</dt><dd>{unit.body}</dd><dt>Último service</dt><dd>{fmt(unit.lastServiceKm)} km</dd><dt>Base</dt><dd>{unit.base}</dd></dl>
            </div>
          </div>
        </div>

        <aside className="sheet-side">
          <AnimatePresence mode="wait">
            {order ? <OrderDetail key={order.id} order={order} onBack={() => setOrderId(null)} onComponent={(c) => { setOrderId(null); setComponent(c); }} />
              : <motion.div key={component ?? 'all'} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="side-inner">
                {component && <div className="comp-head">
                  <span className="section-kicker">{componentById[component].system}</span>
                  <h3>{componentById[component].name}</h3>
                  <div className="comp-stats"><span><b>{stats[component]?.count ?? 0}</b> intervenciones</span><span><b>{moneyShort(stats[component]?.cost ?? 0)}</b> en materiales</span>{stats[component]?.last && <span>Última {ago(stats[component].last!, now)}</span>}</div>
                </div>}
                <div className="side-section">
                  <div className="side-title"><Layers size={14} /> Historial de OT <b>{compOrders.length}</b></div>
                  <div className="ot-timeline">
                    {compOrders.length ? compOrders.map((o) => <button key={o.id} className={`ot-item ${isOpen(o) ? 'is-open' : ''}`} onClick={() => setOrderId(o.id)}>
                      <span className={`ot-dot t-${statusClass(o.type)}`} />
                      <div><strong>{o.title}</strong><small>{o.id} · {date(o.opened)} · {o.type}</small><span className="ot-comps">{o.components.map((c) => <i key={c}>{componentById[c].name}</i>)}</span></div>
                      <div className="ot-right">{isOpen(o) ? <span className={`status-pill ${statusClass(o.status)}`}>{o.status}</span> : <b>{moneyShort(orderCost(o))}</b>}<ChevronRight size={15} /></div>
                    </button>) : <div className="empty-state">Sin órdenes en el período para este componente.</div>}
                  </div>
                </div>
                <div className="side-section">
                  <div className="side-title"><PackageSearch size={14} /> {component ? 'Materiales usados en este componente' : 'Materiales más costosos'}</div>
                  <MaterialsTable rows={materials.slice(0, component ? 12 : 8).map((m) => ({ code: m.code, name: m.name, qty: `${fmt(m.qty)} ${m.unit}`, cost: m.cost, extra: `${m.orders} OT` }))} />
                </div>
              </motion.div>}
          </AnimatePresence>
        </aside>
      </div>
    </motion.section>
  </motion.div>;
}

function PlanBar({ label, done, every }: { label: string; done: number; every: number }) {
  const p = done / every; const left = every - done;
  return <div className="plan-bar"><div><span>{label}</span><b className={p >= 1 ? 'late' : p > .85 ? 'soon' : ''}>{left < 0 ? `Vencido hace ${fmt(-left)} km` : `Faltan ${fmt(left)} km`}</b></div><div className="plan-track"><i className={p >= 1 ? 'late' : p > .85 ? 'soon' : ''} style={{ width: `${Math.min(100, p * 100)}%` }} /></div></div>;
}

function MaterialsTable({ rows, total }: { rows: { code: string; name: string; qty: string; cost: number; extra?: string; origin?: string }[]; total?: number }) {
  if (!rows.length) return <div className="empty-state">No se usaron materiales de pañol.</div>;
  return <div className="mat-table">
    <div className="mat-row mat-head"><span>Código</span><span>Material</span><span>Cant.</span><span>Importe</span></div>
    {rows.map((r) => <div className="mat-row" key={r.code}><span className="mono">{r.code}</span><span>{r.name}{(r.extra || r.origin) && <small>{r.origin ?? r.extra}</small>}</span><span>{r.qty}</span><span>{r.cost ? money(r.cost) : '—'}</span></div>)}
    {total !== undefined && <div className="mat-row mat-total"><span /><span>Total materiales</span><span /><span>{money(total)}</span></div>}
  </div>;
}

function OrderDetail({ order, onBack, onComponent }: { order: WorkOrder; onBack: () => void; onComponent: (id: string) => void }) {
  const dur = (order.closed ?? now).getTime() - order.opened.getTime();
  return <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="side-inner">
    <button className="text-button back" onClick={onBack}><ArrowLeft size={14} /> Volver al historial</button>
    <div className="comp-head">
      <span className="section-kicker">{order.id} · {order.type}</span>
      <h3>{order.title}</h3>
      <div className="sheet-tags"><span className={`status-pill ${statusClass(order.status)}`}>{order.status}</span><span className={`prio p-${order.priority.toLowerCase()}`}>Prioridad {order.priority.toLowerCase()}</span></div>
    </div>
    <p className="diag">{order.diagnosis}</p>
    <div className="ot-facts">
      <div><CalendarClock size={14} /><span>Ingreso</span><b>{dateTime(order.opened)}</b></div>
      <div><CalendarClock size={14} /><span>{order.closed ? 'Egreso' : 'En taller'}</span><b>{order.closed ? dateTime(order.closed) : `${fmt(dur / 86_400_000, 1)} días`}</b></div>
      <div><User size={14} /><span>Mecánico</span><b>{order.mechanic}</b></div>
      <div><Clock3 size={14} /><span>Horas hombre</span><b>{fmt(order.hours, 1)} h</b></div>
      <div><Route size={14} /><span>Km al ingreso</span><b>{fmt(order.km)}</b></div>
      <div><BusFront size={14} /><span>Origen</span><b>{order.origin}</b></div>
    </div>
    <div className="side-section">
      <div className="side-title"><Wrench size={14} /> Componentes intervenidos</div>
      <div className="comp-chips">{order.components.map((c) => <button key={c} onClick={() => onComponent(c)}>{componentById[c].name}<ChevronRight size={13} /></button>)}</div>
    </div>
    <div className="side-section">
      <div className="side-title"><PackageSearch size={14} /> Materiales consumidos</div>
      <MaterialsTable rows={order.materials.map((m) => ({ code: m.code, name: m.name, qty: `${fmt(m.qty)} ${m.unit}`, cost: lineCost(m), origin: `${m.origin} · ${money(m.price)} / ${m.unit}` }))} total={orderCost(order)} />
    </div>
  </motion.div>;
}
