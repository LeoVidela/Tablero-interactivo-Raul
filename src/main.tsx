import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, BusFront, CalendarDays, CheckCircle2, ChevronRight, CircleHelp, Clock3, Download, Fuel, Gauge, LayoutDashboard, Menu, Search, Settings2, ShieldCheck, Sparkles, Users, Wrench, X, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './styles.css';
import './views.css';
import { UnitFilter } from './data';
import { UnitSelector } from './ui';
import { Gerencia } from './views/Gerencia';
import { TallerView } from './views/Taller';
import { RRHHView } from './views/RRHH';
import { TraficoLive } from './views/TraficoLive';

type Module = 'Resumen' | 'Tráfico' | 'Flota' | 'Taller' | 'RRHH' | 'Combustible' | 'Seguridad';
type Base = { name: string; code: string; city: string; color: string; services: number; fleet: number; punctuality: number; absenteeism: number; passengers: number; alerts: number; vehicles: number; activeVehicles: number; workshop: number };
type RecordItem = { id: string; base: string; title: string; detail: string; status: 'Operativo' | 'Atención' | 'Crítico'; time: string };

const bases: Base[] = [
  { name: 'Córdoba', code: 'COR', city: 'Córdoba Capital', color: '#ff6b1a', services: 97.2, fleet: 92.4, punctuality: 96.5, absenteeism: 3.8, passengers: 118000, alerts: 2, vehicles: 126, activeVehicles: 116, workshop: 7 },
  { name: 'Comodoro', code: 'COM', city: 'Comodoro Rivadavia', color: '#22d3ee', services: 91.5, fleet: 84.1, punctuality: 90.3, absenteeism: 7.1, passengers: 86000, alerts: 5, vehicles: 84, activeVehicles: 71, workshop: 11 },
  { name: 'San Luis', code: 'SLU', city: 'San Luis Capital', color: '#34d399', services: 95.4, fleet: 89.8, punctuality: 94.2, absenteeism: 4.6, passengers: 98000, alerts: 3, vehicles: 72, activeVehicles: 65, workshop: 5 },
  { name: 'Villa Mercedes', code: 'VME', city: 'Villa Mercedes', color: '#f59e0b', services: 93.1, fleet: 81.7, punctuality: 89.8, absenteeism: 5.4, passengers: 71000, alerts: 6, vehicles: 86, activeVehicles: 70, workshop: 9 },
];
const traffic = [{ time: '06:00', value: 82 }, { time: '08:00', value: 94 }, { time: '10:00', value: 88 }, { time: '12:00', value: 91 }, { time: '14:00', value: 86 }, { time: '16:00', value: 96 }, { time: '18:00', value: 99 }, { time: '20:00', value: 93 }];
const moduleMeta: Record<Module, { icon: React.ElementType; subtitle: string }> = { Resumen: { icon: LayoutDashboard, subtitle: 'Una mirada completa de la operación' }, Tráfico: { icon: Activity, subtitle: 'Servicios, recorridos y puntualidad' }, Flota: { icon: BusFront, subtitle: 'Disponibilidad y estado de unidades' }, Taller: { icon: Wrench, subtitle: 'Mantenimiento preventivo y correctivo' }, RRHH: { icon: Users, subtitle: 'Dotación, turnos y ausentismo' }, Combustible: { icon: Fuel, subtitle: 'Consumos y rendimiento por base' }, Seguridad: { icon: ShieldCheck, subtitle: 'Incidentes y cumplimiento' } };

const records: Record<Module, RecordItem[]> = {
  Tráfico: [
    { id: 'SRV-1042', base: 'Córdoba', title: 'Línea 20 · recorrido cumplido', detail: 'Turno mañana · 18 min de demora acumulada', status: 'Operativo', time: 'Hace 8 min' },
    { id: 'SRV-0987', base: 'Comodoro', title: 'Servicio cancelado · Línea B', detail: 'Falta de unidad de relevo', status: 'Crítico', time: 'Hace 14 min' },
    { id: 'SRV-1120', base: 'Villa Mercedes', title: 'Desvío temporal · Línea 21', detail: 'Obra vial · seguimiento activo', status: 'Atención', time: 'Hace 22 min' },
    { id: 'SRV-1177', base: 'San Luis', title: 'Frecuencia normalizada', detail: 'Línea 12 · operación estable', status: 'Operativo', time: 'Hace 31 min' },
  ],
  Flota: [
    { id: 'INT-342', base: 'Villa Mercedes', title: 'Vehículo fuera de servicio', detail: 'Falla de motor · OT-5482 abierta', status: 'Crítico', time: 'Hace 18 min' },
    { id: 'INT-118', base: 'Comodoro', title: 'Unidad ingresada a taller', detail: 'Mantenimiento preventivo', status: 'Atención', time: 'Hace 42 min' },
    { id: 'INT-071', base: 'Córdoba', title: 'Unidad liberada', detail: 'Inspección completada', status: 'Operativo', time: 'Hace 1 h' },
  ],
  Taller: [
    { id: 'OT-5482', base: 'Villa Mercedes', title: 'Reparación de motor', detail: 'Esperando repuesto · prioridad alta', status: 'Crítico', time: 'Abierta hace 3 días' },
    { id: 'OT-5471', base: 'Comodoro', title: 'Servicio de frenos', detail: 'Trabajo en progreso', status: 'Atención', time: 'Abierta hace 9 h' },
    { id: 'OT-5464', base: 'Córdoba', title: 'Preventivo 40.000 km', detail: 'Programado para turno noche', status: 'Operativo', time: 'Hoy' },
  ],
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

function App() {
  const [activeModule, setActiveModule] = useState<Module>('Resumen');
  const [period, setPeriod] = useState('Hoy');
  const [baseFilter, setBaseFilter] = useState<UnitFilter>('Todos');
  const [query, setQuery] = useState('');
  const [selectedBase, setSelectedBase] = useState<Base | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState('');

  const filteredBases = useMemo(() => bases.filter((base) => (baseFilter === 'Todos' || base.name === baseFilter) && `${base.name} ${base.city}`.toLowerCase().includes(query.toLowerCase())), [baseFilter, query]);
  const visibleRecords = useMemo(() => (records[activeModule] || []).filter((item) => (baseFilter === 'Todos' || item.base === baseFilter) && `${item.title} ${item.detail} ${item.base}`.toLowerCase().includes(query.toLowerCase())), [activeModule, baseFilter, query]);
  const managed = activeModule === 'Resumen' || activeModule === 'Taller' || activeModule === 'RRHH';
  const go = (module: Module) => { setActiveModule(module); setSelectedRecord(null); setMobileNav(false); };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3000); };

  const metrics = [
    { label: 'Servicios cumplidos', value: `${average('services').toFixed(1).replace('.', ',')}%`, detail: 'vs. objetivo 92%', icon: Gauge, tone: 'good', action: () => go('Tráfico') },
    { label: 'Flota disponible', value: `${average('fleet').toFixed(1).replace('.', ',')}%`, detail: `${format(bases.reduce((s, b) => s + b.activeVehicles, 0))} unidades activas`, icon: BusFront, tone: 'warn', action: () => go('Flota') },
    { label: 'Pasajeros transportados', value: format(bases.reduce((s, b) => s + b.passengers, 0)), detail: 'en las 4 bases', icon: Users, tone: 'good', action: () => go('Tráfico') },
    { label: 'Puntualidad', value: `${average('punctuality').toFixed(1).replace('.', ',')}%`, detail: 'demora media 4 min', icon: Clock3, tone: 'good', action: () => go('Tráfico') },
  ];

  return <div className="app-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><img src="/solbus-logo.svg" alt="Solbus" /></div>
      <div className="workspace"><span className="workspace-dot" /> Grupo Solbus <ChevronRight size={14} /></div>
      <p className="nav-title">Operación</p><nav>{(Object.keys(moduleMeta) as Module[]).slice(0, 5).map((item) => { const Icon = moduleMeta[item].icon; return <button className={activeModule === item ? 'nav-item active' : 'nav-item'} onClick={() => go(item)} key={item}><Icon size={18} /><span>{item}</span>{item === 'Resumen' && <span className="live-dot" />}</button>; })}</nav>
      <p className="nav-title second">Gestión</p><nav>{(['Combustible', 'Seguridad'] as Module[]).map((item) => { const Icon = moduleMeta[item].icon; return <button className={activeModule === item ? 'nav-item active' : 'nav-item'} onClick={() => go(item)} key={item}><Icon size={18} /><span>{item}</span></button>; })}<button className="nav-item" onClick={() => notify('La configuración estará disponible en la siguiente versión')}><Settings2 size={18} /><span>Configuración</span></button></nav>
      <div className="sidebar-bottom"><div className="help"><CircleHelp size={17} /><div><strong>¿Necesitas ayuda?</strong><span>Centro de soporte</span></div></div><div className="user"><div className="avatar">LV</div><div><strong>Leo Videla</strong><span>Gerente general</span></div><ChevronRight size={15} /></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button><div className="breadcrumbs"><span>Grupo Solbus</span><ChevronRight size={14} /><strong>{activeModule}</strong></div><div className="top-actions"><div className="search"><Search size={16} /><input placeholder="Buscar base, línea, OT..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="notification-wrap"><button className="icon-button notification" onClick={() => setShowNotifications(!showNotifications)}><Bell size={18} /><i /></button>{showNotifications && <div className="notification-pop"><strong>Notificaciones</strong><span>7 alertas requieren atención</span><button onClick={() => { go('Taller'); setShowNotifications(false); }}>Ver alertas <ChevronRight size={14} /></button></div>}</div><div className="top-avatar">LV</div></div></header>
      {activeModule !== 'Taller' && activeModule !== 'RRHH' && <section className="hero"><div><div className="eyebrow"><span className="status-pulse" /> Operación en vivo <span className="separator">·</span> Actualizado hace 2 min</div><h1>{activeModule === 'Resumen' ? <>Buen día, Leo <span>✦</span></> : activeModule}</h1><p>{moduleMeta[activeModule].subtitle}</p></div><div className="hero-actions">{!managed && <div className="period-switcher">{['Hoy', '7 días', '30 días'].map((item) => <button className={period === item ? 'selected' : ''} onClick={() => setPeriod(item)} key={item}>{item}</button>)}</div>}<button className="export-button" onClick={() => notify('Reporte preparado: la descarga comenzará en breve')}><Download size={15} /> Exportar</button></div></section>}
      <div className="filterbar"><div className="filter-label"><CalendarDays size={15} /> Unidad de negocio <strong>{baseFilter === 'Todos' ? 'Todas' : baseFilter}</strong></div><UnitSelector value={baseFilter} onChange={setBaseFilter} /></div>
      {activeModule === 'Resumen' ? <>
        <Gerencia unit={baseFilter} setUnit={setBaseFilter} go={(m) => go(m)} notify={notify} onRecord={(record) => setSelectedRecord(record)} />
        <section className="section-header"><div><span className="section-kicker">Visión por ubicación</span><h2>Las bases operativas</h2></div><button className="text-button" onClick={() => notify('Comparativa lista para seleccionar una base')}>Ver comparativa <ArrowUpRight size={15} /></button></section><section className="base-grid">{filteredBases.map((base) => <BaseCard base={base} onClick={() => setSelectedBase(base)} key={base.code} />)}</section>
      </> : activeModule === 'Taller' ? <TallerView unit={baseFilter} notify={notify} />
        : activeModule === 'RRHH' ? <RRHHView unit={baseFilter} notify={notify} />
        : <>{activeModule === 'Tráfico' && <TraficoLive unit={baseFilter} notify={notify} />}<ModuleView module={activeModule} bases={filteredBases} records={visibleRecords} onBase={setSelectedBase} onRecord={setSelectedRecord} /></>}
    </main>
    <AnimatePresence>{selectedBase && <BaseDrawer base={selectedBase} onClose={() => setSelectedBase(null)} onModule={go} />}{selectedRecord && <RecordDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} />}</AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="toast"><CheckCircle2 size={17} /> {toast}</motion.div>}
  </div>;
}

function FleetPanel({ onOpen }: { onOpen: () => void }) { return <div className="panel fleet-panel"><div className="panel-heading"><div><span className="section-kicker">Disponibilidad</span><h2>Estado de flota</h2></div><button className="round-action" onClick={onOpen}><ArrowUpRight size={16} /></button></div><div className="fleet-summary"><div className="fleet-ring"><div><strong>326</strong><span>unidades</span></div></div><div className="fleet-legend"><span><i className="dot purple" /> Operativa <b>84%</b></span><span><i className="dot orange" /> En taller <b>10%</b></span><span><i className="dot red" /> Fuera de servicio <b>6%</b></span></div></div></div>; }
function BaseCard({ base, onClick }: { base: Base; onClick: () => void }) { return <motion.button layout whileHover={{ y: -5 }} className="base-card" onClick={onClick}><div className="base-glow" style={{ background: base.color }} /><div className="base-card-top"><div className="base-symbol" style={{ color: base.color, borderColor: `${base.color}55` }}>{base.code}</div><span className={base.alerts > 4 ? 'alert-count warning' : 'alert-count'}><Zap size={12} /> {base.alerts} alertas</span></div><h3>{base.name}</h3><div className="base-main-stat"><strong>{base.services.toFixed(1).replace('.', ',')}%</strong><span>servicio cumplido</span></div><div className="base-mini-stats"><span>Flota <b>{base.fleet}%</b></span><span>Puntualidad <b>{base.punctuality}%</b></span></div><div className="base-progress"><div style={{ width: `${base.services}%`, background: base.color }} /></div><div className="base-footer"><span>Ver detalle completo</span><ChevronRight size={16} /></div></motion.button>; }
function Alerts({ onSelect }: { onSelect: (record: RecordItem) => void }) { return <div className="panel alert-panel"><div className="panel-heading"><div><span className="section-kicker">Requieren atención</span><h2>Alertas prioritarias</h2></div><span className="alert-badge">6 activas</span></div>{records.Flota.concat(records.Tráfico).slice(0, 3).map((item, index) => <button className="alert-row" key={item.id} onClick={() => onSelect(item)}><span className={`alert-marker marker-${index}`}><Zap size={14} /></span><span>{item.title} · {item.base}</span><ChevronRight size={15} /></button>)}</div>; }
function ModuleView({ module, bases: visibleBases, records: visible, onBase, onRecord }: { module: Module; bases: Base[]; records: RecordItem[]; onBase: (base: Base) => void; onRecord: (record: RecordItem) => void }) { return <><section className="module-summary"><div className="module-summary-main"><span className="module-icon-large">{React.createElement(moduleMeta[module].icon, { size: 22 })}</span><div><span className="section-kicker">Indicador consolidado</span><h2>{module === 'RRHH' ? `${average('absenteeism').toFixed(1).replace('.', ',')}%` : module === 'Taller' ? `${bases.reduce((s, b) => s + b.workshop, 0)} OT` : module === 'Combustible' ? '39.300 lts' : module === 'Seguridad' ? '98,2%' : `${average('services').toFixed(1).replace('.', ',')}%`}</h2><p>{moduleMeta[module].subtitle} · todas las bases</p></div></div><div className="module-stat-list"><span>Bases activas <b>{visibleBases.length}/4</b></span><span>Actualización <b>en vivo</b></span></div></section><div className="section-header compact"><div><span className="section-kicker">Desglose por ubicación</span><h2>Seleccioná una base para profundizar</h2></div></div><section className="base-grid">{visibleBases.map((base) => <BaseCard base={base} onClick={() => onBase(base)} key={base.code} />)}</section><div className="section-header compact"><div><span className="section-kicker">Actividad</span><h2>Registros operativos</h2></div></div><section className="records-panel">{visible.length ? visible.map((record) => <button className="record-row" key={record.id} onClick={() => onRecord(record)}><span className={`record-status ${record.status}`}>{record.status === 'Operativo' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</span><div><strong>{record.title}</strong><span>{record.detail}</span></div><small>{record.base} · {record.time}</small><ChevronRight size={17} /></button>) : <div className="empty-state">No hay registros que coincidan con la búsqueda.</div>}</section></>; }
function BaseDrawer({ base, onClose, onModule }: { base: Base; onClose: () => void; onModule: (module: Module) => void }) { return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.aside className="detail-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28 }} onClick={(e) => e.stopPropagation()}><div className="drawer-header"><div><span className="section-kicker">Base operativa · {base.code}</span><h2>{base.name}</h2><small>{base.city}</small></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="drawer-score"><span>Índice de servicio</span><strong>{base.services}%</strong><div className="score-line"><div style={{ width: `${base.services}%` }} /></div><small><ArrowUpRight size={12} /> +2,4% vs. período anterior</small></div><div className="drawer-kpis"><button onClick={() => onModule('Flota')}><BusFront size={17} /><span>Flota activa</span><strong>{base.fleet}%</strong></button><button onClick={() => onModule('Tráfico')}><Clock3 size={17} /><span>Puntualidad</span><strong>{base.punctuality}%</strong></button><button onClick={() => onModule('RRHH')}><Users size={17} /><span>Ausentismo</span><strong>{base.absenteeism}%</strong></button><button onClick={() => onModule('Taller')}><Wrench size={17} /><span>En taller</span><strong>{base.workshop}</strong></button></div><div className="drawer-section"><div className="panel-heading"><h3>Actividad reciente</h3><span className="live-label"><span /> Actualizado</span></div>{records.Tráfico.filter((r) => r.base === base.name).concat(records.Flota.filter((r) => r.base === base.name)).map((item, i) => <div className="timeline" key={item.id}><span className={`timeline-dot dot-${i}`} /><div><strong>{item.title}</strong><small>{item.detail} · {item.time}</small></div></div>)}</div><button className="drawer-cta" onClick={() => onModule('Tráfico')}>Abrir tablero de {base.name} <ArrowUpRight size={16} /></button></motion.aside></motion.div>; }
function RecordDrawer({ record, onClose }: { record: RecordItem; onClose: () => void }) { return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}><motion.aside className="detail-drawer record-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} onClick={(e) => e.stopPropagation()}><div className="drawer-header"><div><span className="section-kicker">Detalle operativo · {record.id}</span><h2>{record.title}</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className={`record-detail-status ${record.status}`}><span>Estado</span><strong>{record.status}</strong></div><div className="detail-list"><div><span>Base</span><strong>{record.base}</strong></div><div><span>Descripción</span><strong>{record.detail}</strong></div><div><span>Actualización</span><strong>{record.time}</strong></div><div><span>Responsable</span><strong>Centro de operaciones</strong></div></div><button className="drawer-cta" onClick={onClose}>Marcar como revisado <CheckCircle2 size={16} /></button></motion.aside></motion.div>; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
