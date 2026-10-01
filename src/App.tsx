import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, BusFront, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, Clock3, Download, Fuel, Gauge, LayoutDashboard, Menu, Search, Settings2, ShieldCheck, Sparkles, Users, Wrench, X, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Flota } from './modules/Flota';
import { Taller } from './modules/Taller';
import { UnitSheet } from './components/UnitSheet';
import { bases, isOpen, now, orders as allOrders, unitById, units } from './data/fleet';
import { componentById } from './data/catalog';
import type { Base, Module, RecordItem } from './data/types';
import { ago } from './lib/format';
import logoDark from './assets/solbus-logo-dark.png';
import logoLight from './assets/solbus-logo-light.png';
import './g/views.css';
import type { UnitFilter } from './g/data';
import { UnitSelector } from './g/ui';
import { OpenUnitCtx } from './g/openUnit';
import { Gerencia } from './g/views/Gerencia';
import { TallerView } from './g/views/Taller';
import { RRHHView } from './g/views/RRHH';
import { TraficoLive } from './g/views/TraficoLive';
import { SiniestrosView } from './g/views/Siniestros';
import { CombustibleView } from './g/views/Combustible';
import { GreetingBar, GreetingTitle } from './g/views/Greeting';
import { MetricDrawer } from './g/views/MetricDrawer';
import { BaseDetail } from './g/views/BaseDetail';
import { Comparativa, GlobalSearch, HelpModal, SettingsModal, WorkspaceMenu } from './g/views/Shell';
import { DrillCtx, type Drill } from './g/drill';
import { exportView } from './g/export';
import { UNIT_NAMES, aggregate, type UnitName } from './g/data';
import type { MetricKey, Target } from './g/metrics';

const traffic = [{ time: '06:00', value: 82 }, { time: '08:00', value: 94 }, { time: '10:00', value: 88 }, { time: '12:00', value: 91 }, { time: '14:00', value: 86 }, { time: '16:00', value: 96 }, { time: '18:00', value: 99 }, { time: '20:00', value: 93 }];
export const moduleLabel = (m: Module) => (m === 'Seguridad' ? 'Siniestros y Seguridad' : m);
const moduleMeta: Record<Module, { icon: React.ElementType; subtitle: string }> = { Resumen: { icon: LayoutDashboard, subtitle: 'Una mirada completa de la operación' }, Tráfico: { icon: Activity, subtitle: 'Servicios, recorridos y puntualidad' }, Flota: { icon: BusFront, subtitle: 'Disponibilidad y estado de unidades' }, Taller: { icon: Wrench, subtitle: 'Mantenimiento preventivo y correctivo' }, RRHH: { icon: Users, subtitle: 'Dotación, turnos y ausentismo' }, Combustible: { icon: Fuel, subtitle: 'Consumos y rendimiento por base' }, Seguridad: { icon: ShieldCheck, subtitle: 'Incidentes y cumplimiento' } };

const records: Record<Module, RecordItem[]> = {
  Tráfico: [
    { id: 'SRV-1042', base: 'Córdoba', title: 'Línea 72 · recorrido cumplido', detail: 'Turno mañana · 18 min de demora acumulada', status: 'Operativo', time: 'Hace 8 min' },
    { id: 'SRV-0987', base: 'Comodoro', title: 'Servicio cancelado · Línea B', detail: 'Falta de unidad de relevo', status: 'Crítico', time: 'Hace 14 min' },
    { id: 'SRV-1120', base: 'Villa Mercedes', title: 'Desvío temporal · Línea 22', detail: 'Obra vial · seguimiento activo', status: 'Atención', time: 'Hace 22 min' },
    { id: 'SRV-1177', base: 'San Luis', title: 'Frecuencia normalizada', detail: 'Línea 12 · operación estable', status: 'Operativo', time: 'Hace 31 min' },
  ],
  Flota: allOrders.filter((o) => isOpen(o) && o.priority === 'Alta').slice(0, 6).map((o) => ({ id: `INT-${o.unit}`, unit: o.unit, ot: o.id, base: o.base, title: `Interno ${o.unit} · ${unitById[o.unit].status.toLowerCase()}`, detail: `${o.title} · ${o.id}`, status: unitById[o.unit].status === 'Fuera de servicio' ? 'Crítico' : 'Atención', time: ago(o.opened, now) })),
  Taller: allOrders.filter(isOpen).slice(0, 8).map((o) => ({ id: o.id, unit: o.unit, ot: o.id, base: o.base, title: `${o.title} · interno ${o.unit}`, detail: `${o.components.map((c) => componentById[c].name).join(' · ')} · ${o.status}`, status: o.status === 'Esperando repuesto' ? 'Crítico' : 'Atención', time: ago(o.opened, now) })),
  RRHH: [
    { id: 'RRHH-21', base: 'Comodoro', title: 'Ausentismo sobre objetivo', detail: '7,1% · 30 personas ausentes', status: 'Atención', time: 'Este mes' },
    { id: 'RRHH-09', base: 'Villa Mercedes', title: 'Licencias por vencer', detail: '12 legajos requieren revisión', status: 'Atención', time: 'En 7 días' },
    { id: 'RRHH-04', base: 'Córdoba', title: 'Dotación completa', detail: 'Turnos cubiertos al 98%', status: 'Operativo', time: 'Hoy' },
  ],
  Combustible: [
    { id: 'COMB-33', base: 'Comodoro', title: 'Consumo sobre presupuesto', detail: '+8,4% vs. objetivo mensual', status: 'Atención', time: 'Este mes' },
    { id: 'COMB-21', base: 'San Luis', title: 'Rendimiento normal', detail: '3,4 km/l promedio', status: 'Operativo', time: 'Hoy' },
  ],
  Seguridad: [
    { id: 'SEG-118', base: 'Villa Mercedes', title: 'Incidente reportado', detail: 'Sin pasajeros lesionados · investigación abierta', status: 'Atención', time: 'Hace 2 h' },
    { id: 'SEG-104', base: 'Córdoba', title: 'Auditoría completada', detail: 'Cumplimiento 98%', status: 'Operativo', time: 'Ayer' },
  ],
  Resumen: [],
};

const average = (key: keyof Base) => bases.reduce((sum, base) => sum + Number(base[key]), 0) / bases.length;
const format = (value: number) => value.toLocaleString('es-AR');
const fleetTotals = { total: units.length, op: units.filter((u) => u.status === 'Operativo').length, shop: units.filter((u) => u.status === 'En taller' || u.status === 'Esperando repuesto').length, out: units.filter((u) => u.status === 'Fuera de servicio').length };

export function App() {
  const [activeModule, setActiveModule] = useState<Module>('Resumen');
  const [period, setPeriod] = useState('30 días');
  const [sheet, setSheet] = useState<{ unit: string; order?: string; component?: string } | null>(null);
  const openUnit = (unit: string, opts?: { order?: string; component?: string }) => setSheet({ unit, ...opts });
  const [unit, setUnit] = useState<UnitFilter>(() => { try { const u = localStorage.getItem('solbus-unit'); return (u && (u === 'Todos' || (UNIT_NAMES as readonly string[]).includes(u)) ? u : 'Todos') as UnitFilter; } catch { return 'Todos'; } });
  const [metric, setMetric] = useState<{ k: MetricKey; unit: UnitFilter; month?: number } | null>(null);
  const [baseOpen, setBaseOpen] = useState<UnitName | null>(null);
  const [tabReq, setTabReq] = useState<{ module: Module; tab: string; n: number } | null>(null);
  const [panel, setPanel] = useState<'ws' | 'settings' | 'help' | 'cmp' | null>(null);
  const baseFilter = unit === 'Todos' ? 'Todas las bases' : unit;
  const setBaseFilter = (b: string) => setUnit((b === 'Todas las bases' ? 'Todos' : b) as UnitFilter);
  const [query, setQuery] = useState('');
  const [selectedBase, setSelectedBase] = useState<Base | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  const toggleTheme = () => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); document.documentElement.dataset.theme = t; try { localStorage.setItem('solbus-theme', t); } catch { /* sin almacenamiento: el tema dura la sesión */ } };

  const filteredBases = useMemo(() => bases.filter((base) => (baseFilter === 'Todas las bases' || base.name === baseFilter) && `${base.name} ${base.city}`.toLowerCase().includes(query.toLowerCase())), [baseFilter, query]);
  const visibleRecords = useMemo(() => (records[activeModule] || []).filter((item) => (baseFilter === 'Todas las bases' || item.base === baseFilter) && `${item.title} ${item.detail} ${item.base}`.toLowerCase().includes(query.toLowerCase())), [activeModule, baseFilter, query]);
  const go = (module: Module, opts?: { tab?: string; unit?: UnitFilter }) => {
    if (opts?.unit) setUnit(opts.unit);
    setActiveModule(module); setSelectedRecord(null); setSelectedBase(null); setBaseOpen(null); setMetric(null); setMobileNav(false); setPanel(null);
    setTabReq(opts?.tab ? { module, tab: opts.tab, n: Date.now() } : null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const drill: Drill = { openMetric: (k, o) => setMetric({ k, unit: o?.unit ?? unit, month: o?.month }), openBase: (b) => { setMetric(null); setBaseOpen(b); }, go: (t: Target, o) => go(t as Module, o) };
  const gBases = useMemo(() => filteredBases.map((b) => { const a = aggregate(b.name as UnitName, [11]); return { ...b, services: +a.cumpl.toFixed(1), fleet: +a.disp.toFixed(1), punctuality: +a.reg.toFixed(1) }; }), [filteredBases]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000); };

  const metrics = [
    { label: 'Servicios cumplidos', value: `${average('services').toFixed(1).replace('.', ',')}%`, detail: 'vs. objetivo 92%', icon: Gauge, tone: 'good', action: () => go('Tráfico') },
    { label: 'Flota disponible', value: `${average('fleet').toFixed(1).replace('.', ',')}%`, detail: `${format(bases.reduce((s, b) => s + b.activeVehicles, 0))} unidades activas`, icon: BusFront, tone: 'warn', action: () => go('Flota') },
    { label: 'Pasajeros transportados', value: format(bases.reduce((s, b) => s + b.passengers, 0)), detail: 'en las 4 bases', icon: Users, tone: 'good', action: () => go('Tráfico') },
    { label: 'Puntualidad', value: `${average('punctuality').toFixed(1).replace('.', ',')}%`, detail: 'demora media 4 min', icon: Clock3, tone: 'good', action: () => go('Tráfico') },
  ];

  const ownHeader = activeModule === 'RRHH' || activeModule === 'Seguridad' || activeModule === 'Combustible';
  const periodic = activeModule === 'Taller' || activeModule === 'Flota';
  return <OpenUnitCtx.Provider value={openUnit}><DrillCtx.Provider value={drill}><div className="app-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><img src={theme === 'light' ? logoLight : logoDark} alt="Solbus" /></div>
      <div className="ws-wrap"><button className="workspace" onClick={() => setPanel(panel === 'ws' ? null : 'ws')}><span className="workspace-dot" /> {unit === 'Todos' ? 'Grupo Solbus' : unit} <ChevronRight size={14} /></button>{panel === 'ws' && <WorkspaceMenu unit={unit} setUnit={setUnit} onClose={() => setPanel(null)} />}</div>
      <p className="nav-title">Operación</p><nav>{(Object.keys(moduleMeta) as Module[]).slice(0, 5).map((item) => { const Icon = moduleMeta[item].icon; return <button className={activeModule === item ? 'nav-item active' : 'nav-item'} onClick={() => go(item)} key={item}><Icon size={18} /><span>{moduleLabel(item)}</span>{item === 'Resumen' && <span className="live-dot" />}</button>; })}</nav>
      <nav className="nav-second">{(['Combustible', 'Seguridad'] as Module[]).map((item) => { const Icon = moduleMeta[item].icon; return <button className={activeModule === item ? 'nav-item active' : 'nav-item'} onClick={() => go(item)} key={item}><Icon size={18} /><span>{moduleLabel(item)}</span></button>; })}<button className="nav-item" onClick={() => setPanel('settings')}><Settings2 size={18} /><span>Configuración</span></button></nav>
      <div className="sidebar-bottom"><button className="help" onClick={() => setPanel('help')}><CircleHelp size={17} /><div><strong>¿Necesitas ayuda?</strong><span>Centro de soporte</span></div></button><button className="user" onClick={() => setPanel('settings')}><div className="avatar">LV</div><div><strong>Leo Videla</strong><span>Sistemas</span></div><ChevronRight size={15} /></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><div className="breadcrumbs"><span>Grupo Solbus</span><ChevronRight size={14} /><strong>{moduleLabel(activeModule)}</strong></div><div className="top-actions"><GlobalSearch query={query} setQuery={setQuery} /><div className="notification-wrap"><button className="icon-button notification" onClick={() => setShowNotifications(!showNotifications)}><Bell size={18} /><i /></button>{showNotifications && <div className="notification-pop"><strong>Notificaciones</strong><span>{allOrders.filter((o) => isOpen(o) && o.priority === 'Alta').length} OT de prioridad alta en taller</span><button onClick={() => { go('Taller'); setShowNotifications(false); }}>Ver alertas <ChevronRight size={14} /></button></div>}</div><button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><div className="top-avatar">LV</div></div></header>
      {!ownHeader && <section className="hero"><div><div className="eyebrow"><span className="status-pulse" /> Operación en vivo <span className="separator">·</span> Actualizado hace 2 min</div><h1>{activeModule === 'Resumen' ? <GreetingTitle /> : moduleLabel(activeModule)}</h1><p>{moduleMeta[activeModule].subtitle}</p>{activeModule === 'Resumen' && <GreetingBar unit={unit} />}</div><div className="hero-actions">{periodic && <div className="period-switcher">{['7 días', '30 días', '90 días', '12 meses'].map((item) => <button className={period === item ? 'selected' : ''} onClick={() => setPeriod(item)} key={item}>{item}</button>)}</div>}<button className="export-button" onClick={() => { const n = exportView(moduleLabel(activeModule)); notify(`Exportado a Excel: indicadores y ${n} tablas de ${moduleLabel(activeModule)}`); }}><Download size={15} /> Exportar</button></div></section>}
      <div className="filterbar"><div className="filter-label"><CalendarDays size={15} /> Unidad de negocio <strong>{unit === 'Todos' ? 'Todas' : unit}</strong>{periodic && <> · Período <strong>{period}</strong></>}</div><UnitSelector value={unit} onChange={setUnit} /></div>
      {activeModule === 'Resumen' ? <>
        <Gerencia unit={unit} setUnit={setUnit} go={(m) => go(m)} notify={notify} onRecord={(r) => setSelectedRecord(r)} />
        <section className="section-header"><div><span className="section-kicker">Visión por ubicación</span><h2>Las bases operativas</h2></div><button className="text-button" onClick={() => setPanel('cmp')}>Ver comparativa <ArrowUpRight size={15} /></button></section><section className="base-grid">{gBases.map((base) => <BaseCard base={base} onClick={() => setBaseOpen(base.name as UnitName)} key={base.code} />)}</section>
        <section className="bottom-row"><Alerts onSelect={(record) => record.unit ? openUnit(record.unit, { order: record.ot }) : setSelectedRecord(record)} /><div className="panel insight-panel"><div className="insight-icon"><Sparkles size={18} /></div><span className="section-kicker">Pulse insight</span><h2>Una oportunidad detectada</h2><p>Villa Mercedes mejoró su puntualidad <strong>+4,8%</strong> esta semana. El turno tarde es el principal impulsor.</p><button className="insight-button" onClick={() => { setBaseFilter('Villa Mercedes'); go('Tráfico'); }}>Explorar señal <ArrowUpRight size={15} /></button></div></section>
      </> : activeModule === 'Taller' ? <TallerView unit={unit} notify={notify} requestedTab={tabReq?.module === 'Taller' ? tabReq : null} live={<Taller baseFilter={baseFilter} query={query} period={period} onOpenUnit={openUnit} />} />
        : activeModule === 'Flota' ? <Flota baseFilter={baseFilter} query={query} onOpenUnit={openUnit} />
        : activeModule === 'RRHH' ? <RRHHView unit={unit} notify={notify} />
        : activeModule === 'Seguridad' ? <SiniestrosView unit={unit} notify={notify} requestedTab={tabReq?.module === 'Seguridad' ? tabReq : null} />
        : activeModule === 'Combustible' ? <CombustibleView unit={unit} notify={notify} />
        : <>{activeModule === 'Tráfico' && <TraficoLive unit={unit} notify={notify} />}<ModuleView module={activeModule} bases={gBases} records={visibleRecords} onBase={(b) => setBaseOpen(b.name as UnitName)} onRecord={(r) => r.unit ? openUnit(r.unit, { order: r.ot }) : setSelectedRecord(r)} /></>}
    </main>
    <AnimatePresence>{selectedRecord && <RecordDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} onBase={(b) => { setSelectedRecord(null); setBaseOpen(b); }} />}{baseOpen && <BaseDetail key={baseOpen} base={baseOpen} onClose={() => setBaseOpen(null)} />}{metric && <MetricDrawer key={metric.k + metric.unit} k={metric.k} unit={metric.unit} month={metric.month} onClose={() => setMetric(null)} onGo={(t, tab, u) => go(t as Module, { tab, unit: u })} />}{panel === 'settings' && <SettingsModal theme={theme} toggleTheme={toggleTheme} unit={unit} setUnit={setUnit} onClose={() => setPanel(null)} notify={notify} />}{panel === 'help' && <HelpModal onClose={() => setPanel(null)} />}{panel === 'cmp' && <Comparativa onClose={() => setPanel(null)} />}{sheet && <UnitSheet key={sheet.unit + (sheet.order ?? '')} unit={unitById[sheet.unit]} initialOrder={sheet.order} initialComponent={sheet.component} onClose={() => setSheet(null)} />}</AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="toast"><CheckCircle2 size={17} /> {toast}</motion.div>}
  </div></DrillCtx.Provider></OpenUnitCtx.Provider>;
}

function FleetPanel({ onOpen }: { onOpen: () => void }) { return <div className="panel fleet-panel"><div className="panel-heading"><div><span className="section-kicker">Disponibilidad</span><h2>Estado de flota</h2></div><button className="round-action" onClick={onOpen}><ArrowUpRight size={16} /></button></div><div className="fleet-summary"><div className="fleet-ring"><div><strong>{fleetTotals.total}</strong><span>unidades</span></div></div><div className="fleet-legend"><span><i className="dot purple" /> Operativa <b>{Math.round(fleetTotals.op / fleetTotals.total * 100)}%</b></span><span><i className="dot orange" /> En taller <b>{Math.round(fleetTotals.shop / fleetTotals.total * 100)}%</b></span><span><i className="dot red" /> Fuera de servicio <b>{Math.round(fleetTotals.out / fleetTotals.total * 100)}%</b></span></div></div></div>; }
function BaseCard({ base, onClick }: { base: Base; onClick: () => void }) { return <motion.button layout whileHover={{ y: -5 }} className="base-card" onClick={onClick}><div className="base-glow" style={{ background: base.color }} /><div className="base-card-top"><div className="base-symbol" style={{ color: base.color, borderColor: `${base.color}55` }}>{base.code}</div><span className={base.alerts > 4 ? 'alert-count warning' : 'alert-count'}><Zap size={12} /> {base.alerts} alertas</span></div><h3>{base.name}</h3><div className="base-main-stat"><strong>{base.services.toFixed(1).replace('.', ',')}%</strong><span>servicio cumplido</span></div><div className="base-mini-stats"><span>Flota <b>{base.fleet}%</b></span><span>Puntualidad <b>{base.punctuality}%</b></span></div><div className="base-progress"><div style={{ width: `${base.services}%`, background: base.color }} /></div><div className="base-footer"><span>Ver detalle completo</span><ChevronRight size={16} /></div></motion.button>; }
function Alerts({ onSelect }: { onSelect: (record: RecordItem) => void }) { return <div className="panel alert-panel"><div className="panel-heading"><div><span className="section-kicker">Requieren atención</span><h2>Alertas prioritarias</h2></div><span className="alert-badge">{records.Flota.length} activas</span></div>{records.Flota.concat(records.Tráfico).slice(0, 3).map((item, index) => <button className="alert-row" key={item.id} onClick={() => onSelect(item)}><span className={`alert-marker marker-${index}`}><Zap size={14} /></span><span>{item.title} · {item.base}</span><ChevronRight size={15} /></button>)}</div>; }
function ModuleView({ module, bases: visibleBases, records: visible, onBase, onRecord }: { module: Module; bases: Base[]; records: RecordItem[]; onBase: (base: Base) => void; onRecord: (record: RecordItem) => void }) { return <><section className="module-summary"><div className="module-summary-main"><span className="module-icon-large">{React.createElement(moduleMeta[module].icon, { size: 22 })}</span><div><span className="section-kicker">Indicador consolidado</span><h2>{module === 'RRHH' ? `${average('absenteeism').toFixed(1).replace('.', ',')}%` : module === 'Taller' ? `${allOrders.filter(isOpen).length} OT` : module === 'Combustible' ? '39.300 lts' : module === 'Seguridad' ? '98,2%' : `${average('services').toFixed(1).replace('.', ',')}%`}</h2><p>{moduleMeta[module].subtitle} · todas las bases</p></div></div><div className="module-stat-list"><span>Bases activas <b>{visibleBases.length}/4</b></span><span>Actualización <b>en vivo</b></span></div></section><div className="section-header compact"><div><span className="section-kicker">Desglose por ubicación</span><h2>Seleccioná una base para profundizar</h2></div></div><section className="base-grid">{visibleBases.map((base) => <BaseCard base={base} onClick={() => onBase(base)} key={base.code} />)}</section><div className="section-header compact"><div><span className="section-kicker">Actividad</span><h2>Registros operativos</h2></div></div><section className="records-panel">{visible.length ? visible.map((record) => <button className="record-row" key={record.id} onClick={() => onRecord(record)}><span className={`record-status ${record.status}`}>{record.status === 'Operativo' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</span><div><strong>{record.title}</strong><span>{record.detail}</span></div><small>{record.base} · {record.time}</small><ChevronRight size={17} /></button>) : <div className="empty-state">No hay registros que coincidan con la búsqueda.</div>}</section></>; }
function RecordDrawer({ record, onClose, onBase }: { record: RecordItem; onClose: () => void; onBase: (b: UnitName) => void }) { return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}><motion.aside className="detail-drawer record-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} onClick={(e) => e.stopPropagation()}><div className="drawer-header"><div><span className="section-kicker">Detalle operativo · {record.id}</span><h2>{record.title}</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className={`record-detail-status ${record.status}`}><span>Estado</span><strong>{record.status}</strong></div><div className="detail-list"><div><span>Base</span><strong>{record.base}</strong></div><div><span>Descripción</span><strong>{record.detail}</strong></div><div><span>Actualización</span><strong>{record.time}</strong></div><div><span>Responsable</span><strong>Centro de operaciones</strong></div></div>{(UNIT_NAMES as readonly string[]).includes(record.base) && <button className="drawer-cta secondary" onClick={() => onBase(record.base as UnitName)}>Ver ficha de {record.base} <ArrowUpRight size={16} /></button>}<button className="drawer-cta" onClick={onClose}>Marcar como revisado <CheckCircle2 size={16} /></button></motion.aside></motion.div>; }

