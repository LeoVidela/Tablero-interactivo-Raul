import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BusFront, ExternalLink, Gauge, Maximize2, Radio, RefreshCw, Route, Settings2, Users, WifiOff, X } from 'lucide-react';
import { UNIT_COLOR, UNIT_NAMES, UnitFilter, UnitName, aggregate } from '../data';
import { fmt, pct } from '../ui';
import { useDrill } from '../drill';

/** Flotas con vista en vivo de Micronauta (servidas por micronauta-live/micronauta_live.py). */
const LIVE: Partial<Record<UnitName, { feed: string; vista: string; usuario: string }>> = {
  'Córdoba': { feed: 'cordoba', vista: 'Vista Corredores', usuario: 'svidela' },
  Comodoro: { feed: 'comodoro', vista: 'Activos', usuario: 'leonardov' },
};
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
function LiveImage({ src, every, className, onClick }: { src: string; every: number; className?: string; onClick?: () => void }) {
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
  return url ? <img src={url} alt="Micronauta en vivo" className={className} onClick={onClick} /> : <div className={`${className} live-wait`}><RefreshCw size={18} className="spin" /> Esperando la primera imagen…</div>;
}

export function TraficoLive({ unit, notify }: { unit: UnitFilter; notify: (m: string) => void }) {
  const list: UnitName[] = unit === 'Todos' ? [...UNIT_NAMES] : [unit];
  const [base, setBase] = useState(readBridge);
  const [cfg, setCfg] = useState(false);
  const [big, setBig] = useState<UnitName | null>(null);
  const br = useBridge(base);
  const drill = useDrill();
  const liveList = list.filter((u) => LIVE[u]);
  const saveBase = (v: string) => { const clean = v.trim().replace(/\/$/, '') || DEFAULT_BRIDGE; setBase(clean); try { localStorage.setItem('micronauta-live-url', clean); } catch { /* sin almacenamiento */ } setCfg(false); notify(`Servicio en vivo: ${clean}`); };

  return <section className="live-panel">
    <div className="section-header compact"><div><span className="section-kicker">Micronauta · tiempo real</span><h2>Flota en vivo</h2></div>
      <div className="live-bridge"><span className={`live-tag ${br.online ? '' : 'off'}`}>{br.online ? <><Radio size={13} /> SERVICIO CONECTADO</> : <><WifiOff size={13} /> SERVICIO APAGADO</>}</span>
        <button className="icon-button" title="Dirección del servicio en vivo" onClick={() => setCfg(!cfg)}><Settings2 size={16} /></button></div></div>
    {cfg && <form className="live-cfg" onSubmit={(e) => { e.preventDefault(); saveBase(String(new FormData(e.currentTarget).get('u') ?? '')); }}>
      <label>Servicio en vivo<input name="u" defaultValue={base} placeholder={DEFAULT_BRIDGE} /></label><button type="submit" className="export-button">Guardar</button>
      <small>En la PC que corre <code>micronauta-live</code> es <code>{DEFAULT_BRIDGE}</code>; desde otra PC de la red, <code>http://IP-de-esa-PC:8765</code>.</small></form>}

    {liveList.length > 0 && <div className={`live-streams n${liveList.length}`}>
      {liveList.map((u, idx) => { const l = LIVE[u]!; const f = br.feeds[l.feed]; const ok = br.online && f?.state === 'en vivo'; const color = UNIT_COLOR[u];
        return <motion.article key={u} className="live-stream" style={{ ['--tone' as string]: color }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
          <header><div><span className="section-kicker">Tráfico · {u}</span><h3>{u === 'Córdoba' ? 'Córdoba ciudad' : u} <small>· {l.vista}</small></h3></div>
            <span className={`live-tag ${ok ? '' : 'off'}`}>{ok ? <><Radio size={13} /> EN VIVO</> : br.online ? <><RefreshCw size={13} /> {(f?.state ?? 'conectando').toUpperCase()}</> : <><WifiOff size={13} /> SIN SEÑAL</>}</span>
            {br.online && f && <button className="icon-button" title="Pantalla completa" onClick={() => setBig(u)}><Maximize2 size={16} /></button>}</header>
          <div className="live-screen">
            {br.online ? <LiveImage src={`${base}/${l.feed}.png`} every={br.intervalo} className="live-shot" onClick={() => setBig(u)} />
              : <div className="live-off-box"><WifiOff size={26} /><b>El servicio en vivo no está corriendo</b><p>En la PC de monitoreo: <code>micronauta-live\iniciar.bat</code>. Entra a Micronauta con el usuario <b>{l.usuario}</b> y deja la vista <b>{l.vista}</b> en pantalla.</p><a className="live-link" href={MICRONAUTA} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Abrir Micronauta en otra pestaña</a></div>}
            {br.online && f?.error && f.state !== 'en vivo' && <p className="live-err">{f.error}</p>}
          </div>
          <footer>{f?.age != null ? `Actualizado hace ${fmt(f.age, 0)} s` : 'Sin imagen todavía'} · Micronauta · usuario {l.usuario}</footer>
        </motion.article>; })}
    </div>}

    <div className="live-grid">
      {list.map((u, idx) => { const a = aggregate(u, [11]); const color = UNIT_COLOR[u];
        return <motion.article key={u} className={`live-card ${LIVE[u] ? '' : 'off'}`} style={{ ['--tone' as string]: color }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
          <div className="live-card-head"><button className="live-card-title" onClick={() => drill.openBase(u)} title={`Ficha de ${u}`}><span className="section-kicker">Tráfico · {u}</span><h3>{u}</h3></button>{LIVE[u] ? <span className="live-tag"><Radio size={13} /> MICRONAUTA</span> : <span className="live-tag off"><WifiOff size={13} /> SIN ENLACE</span>}</div>
          <div className="live-stats">
            <button onClick={() => drill.openMetric('cumpl', { unit: u })}><Gauge size={15} /><span>Servicios cumplidos</span><b>{pct(a.cumpl)}</b></button>
            <button onClick={() => drill.openMetric('cob', { unit: u })}><Users size={15} /><span>Choferes activos</span><b>{fmt(Math.round(a.oper * 1.55))}</b></button>
            <button onClick={() => drill.openMetric('kmExec', { unit: u })}><Route size={15} /><span>Km recorridos hoy</span><b>{fmt(Math.round(a.kmExec / 30))}</b></button>
            <button onClick={() => drill.openMetric('oper', { unit: u })}><BusFront size={15} /><span>Unidades en calle</span><b>{fmt(Math.round(a.oper * 0.78))}</b></button>
          </div>
          {!LIVE[u] && <p className="live-off-note">Cuando haya usuario de Micronauta para {u}, se suma al vivo agregándolo en el servicio.</p>}
        </motion.article>; })}
    </div>

    <AnimatePresence>{big && LIVE[big] && createPortal(<motion.div className="modal-backdrop live-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBig(null)}>
      <div className="live-full-inner" onClick={(e) => e.stopPropagation()}><header><h3>Micronauta en vivo · {big} · {LIVE[big]!.vista}</h3><button className="icon-button" onClick={() => setBig(null)} aria-label="Cerrar"><X size={18} /></button></header>
        <LiveImage src={`${base}/${LIVE[big]!.feed}.png`} every={br.intervalo} className="live-shot big" /></div></motion.div>, document.body)}</AnimatePresence>
  </section>;
}
