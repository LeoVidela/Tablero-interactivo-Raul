import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { CheckCircle2, Clock3, Download, Gauge, Hammer, MapPin, Package, User, Wrench, X } from 'lucide-react';
import { UNIT_COLOR } from '../data';
import { ANCHOR_LABEL, AnchorKey, Bus, OT, OTEstado, SECTOR_COLOR, busHistory } from '../taller';
import { fmt, money } from '../ui';
import { allSiniestros, siniestroOT } from '../siniestros';

// ---------- geometría del bus (vista lateral, frente hacia la derecha) ----------
type Shape = { t: 'r'; x: number; y: number; w: number; h: number } | { t: 'c'; r: number };
interface Anchor { x: number; y: number; px: number; py: number; shape: Shape; lab: 'top' | 'bot' }
const A: Record<AnchorKey, Anchor> = {
  motor: { x: 147, y: 168, px: 147, py: 168, shape: { t: 'r', x: 86, y: 102, w: 122, h: 132 }, lab: 'top' },
  caja: { x: 340, y: 272, px: 340, py: 274, shape: { t: 'r', x: 292, y: 265, w: 96, h: 18 }, lab: 'bot' },
  'freno-del': { x: 700, y: 282, px: 700, py: 282, shape: { t: 'c', r: 32 }, lab: 'bot' },
  'freno-tras': { x: 250, y: 282, px: 250, py: 282, shape: { t: 'c', r: 32 }, lab: 'bot' },
  'neum-del': { x: 700, y: 282, px: 742, py: 312, shape: { t: 'c', r: 52 }, lab: 'bot' },
  'neum-tras': { x: 250, y: 282, px: 208, py: 312, shape: { t: 'c', r: 52 }, lab: 'bot' },
  'susp-del': { x: 700, y: 236, px: 700, py: 238, shape: { t: 'r', x: 674, y: 224, w: 52, h: 28 }, lab: 'bot' },
  'susp-tras': { x: 250, y: 236, px: 250, py: 238, shape: { t: 'r', x: 224, y: 224, w: 52, h: 28 }, lab: 'bot' },
  bateria: { x: 480, y: 272, px: 480, py: 274, shape: { t: 'r', x: 436, y: 265, w: 88, h: 18 }, lab: 'bot' },
  luces: { x: 934, y: 214, px: 934, py: 214, shape: { t: 'r', x: 918, y: 196, w: 30, h: 38 }, lab: 'top' },
  tablero: { x: 900, y: 150, px: 900, py: 150, shape: { t: 'r', x: 868, y: 118, w: 56, h: 64 }, lab: 'top' },
  'puerta-del': { x: 813, y: 178, px: 813, py: 178, shape: { t: 'r', x: 776, y: 104, w: 76, h: 146 }, lab: 'top' },
  'puerta-cen': { x: 569, y: 178, px: 569, py: 178, shape: { t: 'r', x: 532, y: 104, w: 76, h: 146 }, lab: 'top' },
  vidrio: { x: 370, y: 146, px: 370, py: 146, shape: { t: 'r', x: 324, y: 108, w: 92, h: 78 }, lab: 'top' },
  panel: { x: 420, y: 230, px: 516, py: 240, shape: { t: 'r', x: 312, y: 210, w: 216, h: 38 }, lab: 'bot' },
  aire: { x: 510, y: 74, px: 510, py: 75, shape: { t: 'r', x: 378, y: 62, w: 264, h: 22 }, lab: 'top' },
};

export function BusSvg({ active, activeText, counts, zone, onZone }: { active: AnchorKey | null; activeText: string; counts: Partial<Record<AnchorKey, number>>; zone: AnchorKey | null; onZone: (k: AnchorKey | null) => void }) {
  const wheels = [250, 700];
  const glass = [224, 324, 424, 622];
  const a = active ? A[active] : null;
  const label = active ? ANCHOR_LABEL[active] : '';
  const w = Math.max(label.length, activeText.length * 0.86) * 7.4 + 34;
  const cx = a ? Math.min(1000 - w / 2 - 8, Math.max(w / 2 + 8, a.px)) : 0;
  const cy = a ? (a.lab === 'top' ? 8 : 352) : 0;
  return <svg viewBox="0 0 1000 400" className="bus-svg" role="img" aria-label="Vista lateral del coche con la zona intervenida">
    <defs>
      <linearGradient id="bbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a63d6" /><stop offset=".55" stopColor="#1748b0" /><stop offset="1" stopColor="#0d2a70" /></linearGradient>
      <linearGradient id="bglass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1b3555" /><stop offset=".5" stopColor="#0d1c33" /><stop offset="1" stopColor="#152b48" /></linearGradient>
      <linearGradient id="bshine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".35" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <radialGradient id="bgshadow"><stop offset="0" stopColor="#000" stopOpacity=".65" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      <radialGradient id="brim" cx=".4" cy=".35"><stop offset="0" stopColor="#e2e8f0" /><stop offset="1" stopColor="#64748b" /></radialGradient>
      <filter id="bglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <ellipse cx="500" cy="338" rx="470" ry="14" fill="url(#bgshadow)" />
    {/* chasis */}
    <rect x="86" y="258" width="850" height="14" rx="4" fill="#0a0f1d" />
    <rect x="292" y="266" width="96" height="14" rx="5" fill="#1f2937" stroke="#334155" /><rect x="436" y="266" width="88" height="14" rx="4" fill="#1f2937" stroke="#334155" /><rect x="388" y="270" width="48" height="5" fill="#475569" />
    {/* carrocería */}
    <path d="M70 112 Q70 84 98 84 L858 84 Q914 84 928 138 L948 236 Q950 262 924 262 L82 262 Q70 262 70 248 Z" fill="url(#bbody)" stroke="#0a1a4a" strokeWidth="2" />
    <path d="M70 112 Q70 84 98 84 L858 84 Q914 84 928 138 L940 200 L70 200 Z" fill="url(#bshine)" />
    <rect x="70" y="192" width="878" height="9" fill="#ff6b1a" /><rect x="70" y="203" width="878" height="3" fill="#ffffff" opacity=".8" />
    <text x="326" y="238" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontStyle="italic" fontSize="30" letterSpacing="-1" fill="#ffffff" opacity=".95">SOLBUS</text>
    {/* techo A/A */}
    <rect x="378" y="62" width="264" height="24" rx="8" fill="#cbd5e1" stroke="#64748b" />{[398, 430, 462, 494, 526, 558, 590, 622].map((x) => <rect key={x} x={x} y="66" width="16" height="4" rx="2" fill="#94a3b8" />)}
    {/* motor */}
    <rect x="86" y="102" width="122" height="132" rx="8" fill="#141a2b" stroke="#334155" />{Array.from({ length: 9 }, (_, i) => <rect key={i} x="96" y={112 + i * 13.5} width="102" height="5" rx="2" fill="#334155" />)}
    {/* ventanillas */}
    {glass.map((x) => <g key={x}><rect x={x} y="108" width="92" height="78" rx="7" fill="url(#bglass)" stroke="#0a1a4a" strokeWidth="2" /><path d={`M${x + 10} 180 L${x + 42} 112 L${x + 58} 112 L${x + 26} 180Z`} fill="#fff" opacity=".07" /></g>)}
    {/* puertas */}
    {[532, 776].map((x) => <g key={x}><rect x={x} y="104" width="76" height="146" rx="6" fill="#0f172a" stroke="#0a1a4a" strokeWidth="2" /><rect x={x + 5} y="110" width="30" height="134" rx="3" fill="url(#bglass)" /><rect x={x + 41} y="110" width="30" height="134" rx="3" fill="url(#bglass)" /><rect x={x + 34} y="170" width="3" height="20" rx="1.5" fill="#94a3b8" /></g>)}
    {/* parabrisas + cabina */}
    <path d="M862 100 L900 100 Q916 104 922 128 L936 200 L862 200 Z" fill="url(#bglass)" stroke="#0a1a4a" strokeWidth="2" /><rect x="872" y="90" width="44" height="9" rx="2" fill="#f59e0b" opacity=".9" /><text x="894" y="98" textAnchor="middle" fontSize="8" fontWeight="700" fill="#3b2300">SOLBUS</text>
    <path d="M896 168 L930 168 L934 196 L900 196Z" fill="#0b1224" opacity=".6" />
    <rect x="916" y="198" width="28" height="36" rx="9" fill="#fef3c7" stroke="#b45309" /><rect x="920" y="238" width="24" height="10" rx="4" fill="#f97316" />
    <rect x="66" y="212" width="12" height="24" rx="4" fill="#ef4444" /><rect x="900" y="248" width="52" height="16" rx="6" fill="#0a0f1d" />
    {/* ruedas */}
    {wheels.map((x) => <g key={x}>
      <circle cx={x} cy="272" r="60" fill="#080b14" />
      <rect x={x - 24} y="226" width="48" height="24" rx="6" fill="#1f2937" stroke="#475569" /><rect x={x - 12} y="236" width="24" height="8" rx="3" fill="#0f172a" />
      <circle cx={x} cy="282" r="48" fill="#0b0f19" stroke="#1f2937" strokeWidth="3" /><circle cx={x} cy="282" r="41" fill="none" stroke="#1f2937" strokeWidth="5" strokeDasharray="4 5" />
      <circle cx={x} cy="282" r="30" fill="url(#brim)" stroke="#475569" strokeWidth="2" /><circle cx={x} cy="282" r="20" fill="#475569" stroke="#0f172a" />
      {[0, 60, 120, 180, 240, 300].map((deg) => <circle key={deg} cx={x + 13 * Math.cos((deg * Math.PI) / 180)} cy={282 + 13 * Math.sin((deg * Math.PI) / 180)} r="2.6" fill="#0f172a" />)}<circle cx={x} cy="282" r="6" fill="#cbd5e1" />
    </g>)}
    {/* zonas: resaltado de la intervención activa */}
    {a && <g filter="url(#bglow)">
      {a.shape.t === 'r' ? <rect x={a.shape.x} y={a.shape.y} width={a.shape.w} height={a.shape.h} rx="10" fill="#ff6b1a" fillOpacity=".2" stroke="#ff8a4c" strokeWidth="3" strokeDasharray="7 5"><animate attributeName="stroke-dashoffset" values="0;-24" dur="1.4s" repeatCount="indefinite" /></rect>
        : <circle cx={a.x} cy={a.y} r={a.shape.r} fill="#ff6b1a" fillOpacity=".2" stroke="#ff8a4c" strokeWidth="3" strokeDasharray="7 5"><animate attributeName="stroke-dashoffset" values="0;-24" dur="1.4s" repeatCount="indefinite" /></circle>}
    </g>}
    {/* pines de todas las zonas (mapa de calor de intervenciones) */}
    {(Object.keys(A) as AnchorKey[]).map((k) => { const n = counts[k] || 0; const sel = zone === k; if (k === active) return null; return <g key={k} className="bus-pin" onClick={() => onZone(sel ? null : k)} style={{ cursor: 'pointer' }}>
      <circle cx={A[k].px} cy={A[k].py} r={13 + Math.min(n, 5)} fill="transparent" />
      <circle cx={A[k].px} cy={A[k].py} r={sel ? 9 : 6 + Math.min(n, 4)} fill={n ? '#ff6b1a' : '#94a3b8'} fillOpacity={n ? 0.35 + Math.min(n, 6) * 0.1 : 0.35} stroke={sel ? '#fff' : '#ffffff99'} strokeWidth={sel ? 2.5 : 1.5} />
      {n > 0 && <text x={A[k].px} y={A[k].py + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" style={{ pointerEvents: 'none' }}>{n}</text>}
      <title>{`${ANCHOR_LABEL[k]}${n ? ` · ${n} intervención(es)` : ''}`}</title>
    </g>; })}
    {a && active && <g>
      <circle cx={a.px} cy={a.py} r="14" fill="none" stroke="#ff8a4c" strokeWidth="3"><animate attributeName="r" values="12;34" dur="1.6s" repeatCount="indefinite" /><animate attributeName="opacity" values=".9;0" dur="1.6s" repeatCount="indefinite" /></circle>
      <circle cx={a.px} cy={a.py} r="11" fill="#ff6b1a" stroke="#fff" strokeWidth="3" /><path d={`M${a.px - 4} ${a.py + 4} l8 -8 M${a.px + 1} ${a.py - 6} l5 5`} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <line x1={a.px} y1={a.py + (a.lab === 'top' ? -12 : 12)} x2={cx} y2={a.lab === 'top' ? cy + 46 : cy} stroke="#ff8a4c" strokeWidth="2" strokeDasharray="3 4" />
      <g transform={`translate(${cx - w / 2} ${cy})`}><rect width={w} height="46" rx="12" fill="#0b1020" stroke="#ff8a4c" strokeWidth="2" /><text x={w / 2} y="19" textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffb27f">{label}</text><text x={w / 2} y="36" textAnchor="middle" fontSize="12" fill="#cbd5e1">{activeText}</text></g>
    </g>}
  </svg>;
}

// ---------- modal de ficha ----------
const ESTADO_TONE: Record<OTEstado, string> = { 'En proceso': 'warn', 'Espera repuesto': 'bad', Pendiente: 'warn', Cerrada: 'good' };
const BUS_TONE: Record<string, string> = { Operativa: 'good', 'En reparación': 'warn', 'Esperando repuestos': 'warn', 'Fuera de servicio': 'bad' };

export function BusModal({ bus, ot, onClose, notify }: { bus: Bus; ot?: OT; onClose: () => void; notify: (m: string) => void }) {
  const history = useMemo(() => {
    const key = (o: OT) => o.abierta.split('/').reverse().join('');
    const sin = allSiniestros().filter((x) => x.bus.id === bus.id).map((x) => siniestroOT(x, 11));
    return [...busHistory(bus), ...sin].sort((a, b) => key(b).localeCompare(key(a)));
  }, [bus]);
  const all = useMemo(() => (ot && !history.some((h) => h.id === ot.id) ? [ot, ...history] : history), [ot, history]);
  const [active, setActive] = useState<OT>(ot ?? history[0]);
  const [zone, setZone] = useState<AnchorKey | null>(null);
  const counts = useMemo(() => { const c: Partial<Record<AnchorKey, number>> = {}; all.forEach((h) => { c[h.anchor] = (c[h.anchor] || 0) + 1; }); return c; }, [all]);
  const rows = zone ? all.filter((h) => h.anchor === zone) : all;
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const mx = useMotionValue(0); const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-1, 1], [5, -5]), { stiffness: 120, damping: 18 }); const ry = useSpring(useTransform(mx, [-1, 1], [-7, 7]), { stiffness: 120, damping: 18 });
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); mx.set(((e.clientX - r.left) / r.width) * 2 - 1); my.set(((e.clientY - r.top) / r.height) * 2 - 1); };
  const totalOT = active.costoRep + active.costoMO;
  const tone = bus.salud >= 90 ? 'good' : bus.salud >= 70 ? 'warn' : 'bad';
  const shownAnchor = zone ?? active.anchor;

  return createPortal(<motion.div className="modal-backdrop bus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="bus-modal" initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} transition={{ type: 'spring', damping: 26, stiffness: 260 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Ficha del coche ${bus.interno}`}>
      <header className="bus-head">
        <div className="bus-id"><span className="bus-int">{bus.interno}</span><div><span className="section-kicker">Ficha del coche · {bus.unit}</span><h2>{bus.dominio} <small>{bus.modelo}</small></h2></div></div>
        <div className="bus-badges">
          <span className={`pill ${BUS_TONE[bus.estado]}`}>{bus.estado}</span>
          <span className="pill unit"><i style={{ background: UNIT_COLOR[bus.unit] }} />{bus.unit}</span>
          <span className={`pill ${tone}`}><Gauge size={13} /> Salud {bus.salud}</span>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
      </header>

      <div className="bus-grid">
        <section className="bus-stage-wrap">
          <div className="bus-stage" onMouseMove={onMove} onMouseLeave={() => { mx.set(0); my.set(0); }}>
            <div className="bus-stage-grid" />
            <motion.div className="bus-tilt" style={{ rotateX: rx, rotateY: ry, transformPerspective: 1300 }}><BusSvg active={shownAnchor} activeText={zone ? `${counts[zone] ?? 0} intervención(es) en esta zona` : active.problem} counts={counts} zone={zone} onZone={setZone} /></motion.div>
            <div className="bus-stage-hint"><MapPin size={13} /> Tocá una zona del coche para ver su historial · el resaltado naranja marca la intervención seleccionada</div>
          </div>
          <div className="bus-facts">
            <div><span>Kilometraje</span><b>{fmt(bus.km)} km</b></div><div><span>Año</span><b>{bus.anio}</b></div><div><span>OT últimos 12 meses</span><b>{bus.ot12}</b></div><div><span>Zona más intervenida</span><b>{ANCHOR_LABEL[(Object.entries(counts).sort((x, y) => (y[1] as number) - (x[1] as number))[0]?.[0] ?? 'motor') as AnchorKey]}</b></div>
          </div>
        </section>

        <aside className="bus-ot">
          <div className="bus-ot-head"><div><span className="section-kicker">Intervención seleccionada</span><h3>{active.id} · {active.sector}</h3></div><span className={`pill ${ESTADO_TONE[active.estado]}`}>{active.estado}</span></div>
          <p className="bus-problem" style={{ borderColor: SECTOR_COLOR[active.sector] }}><Wrench size={15} /> {active.problem} <em>{ANCHOR_LABEL[active.anchor]}</em></p>
          <div className="bus-meta">
            <span><User size={13} /> {active.mecanico}</span><span><Clock3 size={13} /> {fmt(active.horas, 1)} h de taller</span><span><Hammer size={13} /> Apertura {active.abierta}</span><span><CheckCircle2 size={13} /> {active.estado === 'Cerrada' ? `Cierre ${active.fecha}` : 'En curso'}</span>
          </div>
          <div className="bus-mat-title"><Package size={15} /> Materiales utilizados</div>
          <table className="g-table bus-mat"><thead><tr><th>Código</th><th>Descripción</th><th>Cant.</th><th>Importe</th></tr></thead>
            <tbody>{active.materiales.map((m) => <tr key={m.code}><td>{m.code}</td><td>{m.desc}</td><td>{m.qty}</td><td>{money(m.qty * m.price, 0)}</td></tr>)}</tbody></table>
          <div className="bus-costs"><div><span>Repuestos</span><b>{money(active.costoRep, 0)}</b></div><div><span>Mano de obra ({fmt(active.horas, 1)} h)</span><b>{money(active.costoMO, 0)}</b></div><div className="total"><span>Total de la OT</span><b>{money(totalOT, 0)}</b></div></div>
          <div className="bus-actions"><button className="export-button" onClick={() => notify(`Ficha del coche ${bus.interno} lista para exportar`)}><Download size={14} /> Exportar ficha</button>{active.estado !== 'Cerrada' && <button className="ghost-button" onClick={() => notify(`${active.id} marcada para cierre`)}>Cerrar OT</button>}</div>
        </aside>
      </div>

      <section className="bus-history">
        <div className="bus-history-head"><h3>Historial de intervenciones {zone && <em>· {ANCHOR_LABEL[zone]}</em>}</h3>{zone && <button className="clear-filter" onClick={() => setZone(null)}>Ver todas <X size={12} /></button>}</div>
        <div className="g-table-wrap tall"><table className="g-table clickable"><thead><tr><th>OT</th><th>Fecha</th><th>Sector</th><th>Problema</th><th>Mecánico</th><th>Horas</th><th>Costo</th><th>Estado</th></tr></thead>
          <tbody>{rows.length === 0 && <tr><td colSpan={8} className="muted-cell">Sin intervenciones registradas en esta zona en los últimos 12 meses.</td></tr>}{rows.map((h) => <tr key={h.id} className={h.id === active.id ? 'row-active' : ''} onClick={() => { setActive(h); setZone(null); }}><td><b>{h.id}</b></td><td>{h.abierta}</td><td><span className="sector-tag"><i style={{ background: SECTOR_COLOR[h.sector] }} />{h.sector}</span></td><td>{h.problem}</td><td>{h.mecanico}</td><td>{fmt(h.horas, 1)}</td><td>{money(h.costoRep + h.costoMO, 0)}</td><td><span className={`pill mini ${ESTADO_TONE[h.estado]}`}>{h.estado}</span></td></tr>)}</tbody></table></div>
      </section>
    </motion.div>
  </motion.div>, document.body);
}
export { AnimatePresence };
