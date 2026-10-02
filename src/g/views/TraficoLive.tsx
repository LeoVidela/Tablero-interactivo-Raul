import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ExternalLink, Maximize2, Radio, RefreshCw, Settings2, WifiOff, X } from 'lucide-react';
import { UNIT_COLOR, UNIT_NAMES, UnitFilter, UnitName, hashStr, mulberry32 } from '../data';
import { fmt } from '../ui';
import { useOpenUnit } from '../openUnit';
import { useTopEscape } from '../esc';
import { trafficDay, type DayBus } from '../trafico';
import { arNow, useArClock } from './Greeting';
import { TraficoGeneral } from './TraficoGeneral';

/** Flotas con vista en vivo de Micronauta (servidas por micronauta-live/micronauta_live.py). */
const LIVE: Partial<Record<UnitName, { feed: string; vista: string; usuario: string }>> = {
  'Córdoba': { feed: 'cordoba', vista: 'Vista Corredores', usuario: 'svidela' },
  Comodoro: { feed: 'comodoro', vista: 'Vista Corredores', usuario: 'leonardov' },
};
const VISTA: Record<UnitName, string> = { 'Córdoba': 'Vista Corredores', Comodoro: 'Vista Corredores', 'San Luis': 'Corredores (ejemplo)', 'Villa Mercedes': 'Activos (ejemplo)' };
const MICRONAUTA = 'https://micronauta.dnsalias.net/megaweb/psw/login.php';
const DEFAULT_BRIDGE = 'http://localhost:8765';
const readBridge = () => { try { return localStorage.getItem('micronauta-live-url') || DEFAULT_BRIDGE; } catch { return DEFAULT_BRIDGE; } };

interface FeedStatus { label: string; state: string; error: string; updated: number | null; age: number | null }
type Bridge = { online: boolean; feeds: Record<string, FeedStatus>; intervalo: number };

function useBridge(base: string): Bridge {
  const [st, setSt] = useState<Bridge>({ online: false, feeds: {}, intervalo: 3 });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`${base}/status`, { cache: 'no-store' });
        const j = await r.json();
        if (alive) setSt({ online: true, feeds: j.feeds ?? {}, intervalo: j.intervalo ?? 3 });
      } catch { if (alive) setSt((s) => ({ ...s, online: false })); }
    };
    tick(); const id = window.setInterval(tick, 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, [base]);
  return st;
}

/** Imagen en vivo: precarga cada captura y la cambia sin parpadeo. */
function LiveImage({ src, every, className }: { src: string; every: number; className?: string }) {
  const [url, setUrl] = useState('');
  const busy = useRef(false);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (busy.current) return; busy.current = true;
      const next = `${src}?t=${Date.now()}`; const img = new Image();
      img.onload = () => { busy.current = false; if (alive) setUrl(next); };
      img.onerror = () => { busy.current = false; };
      img.src = next;
    };
    load(); const id = window.setInterval(load, Math.max(1500, every * 1000));
    return () => { alive = false; window.clearInterval(id); };
  }, [src, every]);
  return url ? <img src={url} alt="Micronauta en vivo" className={className} /> : <div className={`${className} live-wait`}><RefreshCw size={18} className="spin" /> Esperando la primera imagen…</div>;
}

// ---------- mapa simulado (ejemplo / servicio apagado) ----------
const VW = 1600; const VH = 900;
type Pt = [number, number];
function cityGeo(u: UnitName, nLines: number) {
  const r = mulberry32(hashStr(`geo-${u}`));
  const xs = Array.from({ length: 17 }, (_, i) => i * 100 + (r() - 0.5) * 30);
  const ys = Array.from({ length: 10 }, (_, i) => i * 100 + (r() - 0.5) * 30);
  const routes: { pts: Pt[]; len: number[]; total: number }[] = [];
  for (let k = 0; k < nLines; k++) {
    let ci = 0; let ri = 1 + Math.floor(r() * 8); const pts: Pt[] = [[xs[0], ys[ri]]];
    while (ci < 16) {
      if (r() < 0.6) ci = Math.min(16, ci + 1 + Math.floor(r() * 3)); else ri = Math.max(1, Math.min(8, ri + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2))));
      pts.push([xs[ci], ys[ri]]);
    }
    const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    routes.push({ pts, len, total: len[len.length - 1] });
  }
  const parks = Array.from({ length: 4 }, () => ({ x: 100 + r() * 1300, y: 80 + r() * 650, w: 120 + r() * 160, h: 80 + r() * 110 }));
  return { xs, ys, routes, parks, river: u === 'Córdoba' ? `M0 ${380 + r() * 80} C 400 ${300 + r() * 120}, 900 ${520 + r() * 80}, 1600 ${420 + r() * 80}` : u === 'Comodoro' ? 'M0 880 L1600 760 L1600 900 L0 900 Z' : '' };
}
function along(route: { pts: Pt[]; len: number[]; total: number }, f: number): Pt {
  const d = (f < 0.5 ? f * 2 : 2 - f * 2) * route.total;
  let i = 1; while (i < route.len.length - 1 && route.len[i] < d) i++;
  const [x0, y0] = route.pts[i - 1]; const [x1, y1] = route.pts[i]; const seg = route.len[i] - route.len[i - 1] || 1; const t = (d - route.len[i - 1]) / seg;
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

function SimMap({ u, big, buses, lines, onBus }: { u: UnitName; big?: boolean; buses: DayBus[]; lines: { line: string; color: string }[]; onBus: (id: string) => void }) {
  const geo = useMemo(() => cityGeo(u, lines.length), [u, lines.length]);
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => setTick((x) => x + 1), 1500); return () => window.clearInterval(id); }, []);
  const moving = buses.filter((b) => b.estado === 'En servicio');
  const col = (l: string) => lines.find((x) => x.line === l)?.color ?? '#94a3b8';
  return <svg className="sim-map" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Mapa simulado de ${u}`}>
    <rect width={VW} height={VH} className="sim-bg" />
    {geo.parks.map((p, i) => <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={14} className="sim-park" />)}
    {geo.river && <path d={geo.river} className={u === 'Comodoro' ? 'sim-sea' : 'sim-river'} />}
    {geo.xs.map((x, i) => <line key={`x${i}`} x1={x} y1={0} x2={x + (i % 3 ? 0 : 40)} y2={VH} className={i % 4 ? 'sim-street' : 'sim-avenue'} />)}
    {geo.ys.map((y, i) => <line key={`y${i}`} x1={0} y1={y} x2={VW} y2={y + (i % 3 ? 0 : 30)} className={i % 4 ? 'sim-street' : 'sim-avenue'} />)}
    {geo.routes.map((r, i) => <polyline key={i} points={r.pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={lines[i]?.color} strokeWidth={big ? 6 : 7} strokeOpacity={0.5} strokeLinejoin="round" strokeLinecap="round" />)}
    {moving.map((b, k) => {
      const li = Math.max(0, lines.findIndex((x) => x.line === b.linea)); const rr = mulberry32(hashStr(b.bus.id));
      const phase = rr(); const speed = 0.004 + rr() * 0.006;
      const [x, y] = along(geo.routes[li], (phase + tick * speed) % 1);
      return <g key={b.bus.id} className="sim-bus" style={{ transform: `translate(${x}px, ${y}px)` }} onClick={(e) => { e.stopPropagation(); onBus(b.bus.id); }}>
        <title>{`Interno ${b.bus.interno} · línea ${b.linea} · ${fmt(b.vel, 0)} km/h${b.demora ? ` · ${b.demora} min de demora` : ''}`}</title>
        <circle r={big ? 15 : 17} fill={col(b.linea)} className={b.demora > 5 ? 'late' : ''} />
        {(big || k % 3 === 0) && <text y={big ? -22 : -24} textAnchor="middle">{b.bus.interno}</text>}
      </g>;
    })}
  </svg>;
}

function Screen({ u, bridge, br, onBig, iso, hour }: { u: UnitName; bridge: string; br: Bridge; onBig: () => void; iso: string; hour: number }) {
  const openUnit = useOpenUnit();
  const l = LIVE[u]; const f = l ? br.feeds[l.feed] : undefined;
  const real = !!l && br.online && !!f;
  const ok = real && f?.state === 'en vivo';
  const day = useMemo(() => trafficDay(u, iso, hour), [u, iso, hour]);
  const [help, setHelp] = useState(false);
  return <motion.article className="live-stream" style={{ ['--tone' as string]: UNIT_COLOR[u] }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <header><div><span className="section-kicker">Tráfico · {u}</span><h3>{u === 'Córdoba' ? 'Córdoba ciudad' : u} <small>· {VISTA[u]}</small></h3></div>
      <span className={`live-tag ${ok ? '' : real ? 'off' : 'demo'}`}>{ok ? <><Radio size={13} /> EN VIVO</> : real ? <><RefreshCw size={13} /> {(f?.state ?? 'conectando').toUpperCase()}</> : l ? <><WifiOff size={13} /> SIMULACIÓN</> : <><Radio size={13} /> EJEMPLO</>}</span>
      <button className="icon-button" title="Ampliar pantalla" aria-label={`Ampliar ${u}`} onClick={onBig}><Maximize2 size={16} /></button></header>
    <div className="live-screen" onClick={onBig} role="button" tabIndex={0} title="Tocá para ampliar">
      {real ? <LiveImage src={`${bridge}/${l!.feed}.png`} every={br.intervalo} className="live-shot" />
        : <SimMap u={u} buses={day.buses} lines={day.lines} onBus={(id) => openUnit(id)} />}
      {!real && <div className="sim-hud"><b>{day.activos}</b> en calle · <b>{fmt(day.vel, 1)}</b> km/h prom.</div>}
      {real && f?.error && f.state !== 'en vivo' && <p className="live-err">{f.error}</p>}
    </div>
    <footer>{real ? (f?.age != null ? `Actualizado hace ${fmt(f.age, 0)} s · Micronauta · usuario ${l!.usuario}` : 'Sin imagen todavía') : l
      ? <>Simulación: el servicio en vivo está apagado. <button className="link-btn" onClick={() => setHelp(!help)}>{help ? 'Ocultar' : 'Cómo encenderlo'}</button></>
      : <>Pantalla de ejemplo · se reemplaza por Micronauta cuando haya usuario para {u}.</>}
      {help && l && <span className="live-help">En la PC de monitoreo corré <code>micronauta-live\iniciar.bat</code> (usuario <b>{l.usuario}</b>, vista <b>{l.vista}</b>). <a className="live-link" href={MICRONAUTA} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Abrir Micronauta</a></span>}
    </footer>
  </motion.article>;
}

function BigScreen({ u, bridge, br, iso, hour, onClose }: { u: UnitName; bridge: string; br: Bridge; iso: string; hour: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null); useTopEscape(ref, onClose);
  const openUnit = useOpenUnit();
  const l = LIVE[u]; const real = !!l && br.online && !!br.feeds[l.feed];
  const day = useMemo(() => trafficDay(u, iso, hour), [u, iso, hour]);
  const [line, setLine] = useState<string | null>(null);
  const list = day.buses.filter((b) => b.estado === 'En servicio' && (!line || b.linea === line)).sort((a, b) => b.demora - a.demora);
  return createPortal(<div ref={ref} data-modal="" className="modal-backdrop live-full" onClick={onClose}>
    <div className="live-full-inner" onClick={(e) => e.stopPropagation()}>
      <header><h3>{real ? 'Micronauta en vivo' : l ? 'Simulación' : 'Ejemplo'} · {u} · {VISTA[u]}</h3><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></header>
      <div className="live-full-body">
        <div className="live-full-screen">{real ? <LiveImage src={`${bridge}/${l!.feed}.png`} every={br.intervalo} className="live-shot big" /> : <SimMap u={u} big buses={day.buses.filter((b) => !line || b.linea === line)} lines={day.lines} onBus={(id) => openUnit(id)} />}</div>
        <aside className="live-full-side">
          <div className="lf-lines"><button className={!line ? 'on' : ''} onClick={() => setLine(null)}>Todas</button>{day.lines.map((x) => <button key={x.line} className={line === x.line ? 'on' : ''} onClick={() => setLine(line === x.line ? null : x.line)}><i style={{ background: x.color }} />{x.line}</button>)}</div>
          <span className="section-kicker">Coches en calle · {list.length} · tocá uno para ver su ficha</span>
          <ul>{list.map((b) => <li key={b.bus.id}><button onClick={() => openUnit(b.bus.id)}><b>{b.bus.interno}</b><span>Línea {b.linea} · {fmt(b.km)} km hoy</span><em className={b.demora > 5 ? 'low' : 'ok'}>{b.demora ? `+${b.demora} min` : 'a horario'}</em></button></li>)}</ul>
        </aside>
      </div>
    </div>
  </div>, document.body);
}

export function TraficoLive({ unit, notify }: { unit: UnitFilter; notify: (m: string) => void }) {
  const list: UnitName[] = unit === 'Todos' ? [...UNIT_NAMES] : [unit];
  const [bridge, setBridge] = useState(readBridge);
  const [cfg, setCfg] = useState(false);
  const [big, setBig] = useState<UnitName | null>(null);
  const br = useBridge(bridge);
  const clock = useArClock(60_000);
  const { iso } = arNow(); const hour = clock.hour;
  const saveBase = (v: string) => { const clean = v.trim().replace(/\/$/, '') || DEFAULT_BRIDGE; setBridge(clean); try { localStorage.setItem('micronauta-live-url', clean); } catch { /* sin almacenamiento */ } setCfg(false); notify(`Servicio en vivo: ${clean}`); };

  return <section className="live-panel">
    <div className="section-header compact"><div><span className="section-kicker">Micronauta · tiempo real</span><h2>Flota en vivo</h2></div>
      <div className="live-bridge"><span className={`live-tag ${br.online ? '' : 'off'}`}>{br.online ? <><Radio size={13} /> SERVICIO CONECTADO</> : <><WifiOff size={13} /> SERVICIO APAGADO</>}</span>
        <button className="icon-button" title="Dirección del servicio en vivo" onClick={() => setCfg(!cfg)}><Settings2 size={16} /></button></div></div>
    {cfg && <form className="live-cfg" onSubmit={(e) => { e.preventDefault(); saveBase(String(new FormData(e.currentTarget).get('u') ?? '')); }}>
      <label>Servicio en vivo<input name="u" defaultValue={bridge} placeholder={DEFAULT_BRIDGE} /></label><button type="submit" className="export-button">Guardar</button>
      <small>En la PC que corre <code>micronauta-live</code> es <code>{DEFAULT_BRIDGE}</code>; desde otra PC de la red, <code>http://IP-de-esa-PC:8765</code>.</small></form>}

    <div className={`live-streams n${list.length}`}>{list.map((u) => <Screen key={u} u={u} bridge={bridge} br={br} iso={iso} hour={hour} onBig={() => setBig(u)} />)}</div>
    {big && <BigScreen u={big} bridge={bridge} br={br} iso={iso} hour={hour} onClose={() => setBig(null)} />}

    <TraficoGeneral unit={unit} iso={iso} hour={hour} />
  </section>;
}
