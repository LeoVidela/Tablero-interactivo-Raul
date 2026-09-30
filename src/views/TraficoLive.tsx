import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Download, ExternalLink, Radio, Users, Route, BusFront, Gauge, WifiOff } from 'lucide-react';
import { UNIT_COLOR, UNIT_NAMES, UnitFilter, UnitName, aggregate } from '../data';
import { fmt, pct } from '../ui';

const LIVE: Partial<Record<UnitName, { url: string; host: string }>> = {
  Comodoro: { url: 'https://micronauta.dnsalias.net/web/urbano/?conf=comodoro', host: 'micronauta.dnsalias.net' },
  'Córdoba': { url: 'https://micronauta4.dnsalias.net/web/urbano/?conf=cbaciudad', host: 'micronauta4.dnsalias.net' },
};
const ROUTES = [
  'M20 150 C 70 120, 110 140, 160 100 S 250 60, 300 80 S 360 130, 400 110',
  'M30 40 C 90 70, 120 30, 190 60 S 280 130, 330 150 S 380 60, 410 50',
  'M10 100 C 60 90, 100 120, 170 130 S 260 110, 320 120 S 390 150, 420 140',
];

function Preview({ color, seed }: { color: string; seed: number }) {
  return <svg viewBox="0 0 430 190" className="live-map" aria-hidden="true">
    <defs><pattern id={`g${seed}`} width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="rgba(255,255,255,.05)" /></pattern></defs>
    <rect width="430" height="190" fill={`url(#g${seed})`} />
    {ROUTES.map((d, i) => <path key={i} id={`r${seed}-${i}`} d={d} fill="none" stroke={color} strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 7" />)}
    {ROUTES.map((_, i) => [0, 1, 2].map((k) => <g key={`${i}-${k}`}><circle r="9" fill={color} opacity=".18"><animateMotion dur={`${16 + i * 3 + k * 2}s`} begin={`-${k * 5 + i}s`} repeatCount="indefinite"><mpath href={`#r${seed}-${i}`} /></animateMotion></circle><circle r="4" fill={color} stroke="#fff" strokeWidth="1.2"><animateMotion dur={`${16 + i * 3 + k * 2}s`} begin={`-${k * 5 + i}s`} repeatCount="indefinite"><mpath href={`#r${seed}-${i}`} /></animateMotion></circle></g>))}
  </svg>;
}

export function TraficoLive({ unit, notify }: { unit: UnitFilter; notify: (m: string) => void }) {
  const list: UnitName[] = unit === 'Todos' ? [...UNIT_NAMES] : [unit];
  const open = (u: UnitName) => {
    const l = LIVE[u]; if (!l) return;
    const w = window.open(l.url, `micronauta-${u}`, 'popup=yes,width=1360,height=860');
    if (!w) window.open(l.url, '_blank', 'noopener');
    notify(`Abriendo la flota de ${u} en tiempo real. Si aparece el diálogo de ingreso, elegí "Entrar como invitado".`);
  };
  return <section className="live-panel">
    <div className="section-header compact"><div><span className="section-kicker">Micronauta</span><h2>Flota en tiempo real</h2></div>
      <a className="text-button" href="/micronauta-invitado.user.js" download="micronauta-invitado.user.js" onClick={() => notify('Asistente descargado: instalalo con Tampermonkey para que el ingreso como invitado sea automático')}><Download size={15} /> Asistente de ingreso automático</a></div>
    <div className="live-grid">
      {list.map((u, idx) => { const l = LIVE[u]; const a = aggregate(u, [11]); const color = UNIT_COLOR[u];
        return <motion.article key={u} className={`live-card ${l ? '' : 'off'}`} style={{ ['--tone' as string]: color }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.06 }}>
          <div className="live-card-head"><div><span className="section-kicker">Tráfico · {u}</span><h3>{u === 'Córdoba' ? 'Córdoba ciudad' : u}</h3></div>{l ? <span className="live-tag"><Radio size={13} /> EN VIVO</span> : <span className="live-tag off"><WifiOff size={13} /> SIN ENLACE</span>}</div>
          {l && <div className="live-map-wrap"><Preview color={color} seed={idx} /><span className="live-map-note">Vista ilustrativa · la flota real se abre en Micronauta</span></div>}
          <div className="live-stats">
            <div><Gauge size={15} /><span>Servicios cumplidos</span><b>{pct(a.cumpl)}</b></div>
            <div><Users size={15} /><span>Choferes activos</span><b>{fmt(Math.round(a.oper * 1.55))}</b></div>
            <div><Route size={15} /><span>Km recorridos hoy</span><b>{fmt(Math.round(a.kmExec / 30))}</b></div>
            <div><BusFront size={15} /><span>Unidades en calle</span><b>{fmt(Math.round(a.oper * 0.78))}</b></div>
          </div>
          {l ? <>
            <button className="live-cta" onClick={() => open(u)}>Ver flota en tiempo real <ArrowUpRight size={16} /></button>
            <ol className="live-steps"><li><b>1</b>Se abre Micronauta ({l.host})</li><li><b>2</b>Paso de acceso: <em>Entrar como invitado</em></li><li><b>3</b>Ves los coches circulando</li></ol>
            <a className="live-link" href={l.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> Abrir en una pestaña nueva</a>
          </> : <p className="live-off-note">Cuando compartan el enlace de Micronauta de {u}, se suma acá con el mismo acceso.</p>}
        </motion.article>; })}
    </div>
    <p className="live-note">El ingreso como invitado lo resuelve Micronauta en su propia página: el navegador no permite que el tablero haga clic dentro de otro sitio. Con el asistente instalado (Tampermonkey) el clic se hace solo; sin él, la pantalla queda esperando esa interacción.</p>
  </section>;
}
