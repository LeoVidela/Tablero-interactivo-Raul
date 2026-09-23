import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { components } from '../data/catalog';
import type { BusView } from '../data/types';
import { date, fmt, moneyShort } from '../lib/format';

export type SpotStat = { count: number; open: boolean; last?: Date; cost?: number };

const views: Record<BusView, { src: string; label: string; ratio: string }> = {
  corte: { src: '/img/bus-corte.webp', label: 'Corte lateral', ratio: '938 / 560' },
  chasis: { src: '/img/bus-chasis.webp', label: 'Chasis y despiece', ratio: '1376 / 768' },
};

type Props = {
  view: BusView;
  onView: (view: BusView) => void;
  stats: Record<string, SpotStat>;
  highlight?: string[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  heatLabel?: string;
  /** false = mapa de flota: no marcar OT abiertas, solo cantidad */
  showOpen?: boolean;
};

export function BusDiagram({ view, onView, stats, highlight = [], selected = null, onSelect, heatLabel = 'intervenciones', showOpen = true }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const max = useMemo(() => Math.max(1, ...Object.values(stats).map((s) => s.count)), [stats]);
  const focus = highlight.length > 0;
  const visible = components.filter((c) => c.spots[view]);
  const elsewhere = components.filter((c) => !c.spots[view] && ((stats[c.id]?.count ?? 0) > 0 || highlight.includes(c.id)));
  const otherView: BusView = view === 'corte' ? 'chasis' : 'corte';
  const hovered = hover ? components.find((c) => c.id === hover) : null;

  return <div className="bus-stage">
    <div className="bus-toolbar">
      <div className="segmented">{(Object.keys(views) as BusView[]).map((v) => <button key={v} className={v === view ? 'on' : ''} onClick={() => onView(v)}>{views[v].label}</button>)}</div>
      <div className="bus-legend">
        <span><i className="lg-heat" /> Más {heatLabel}</span>
        {showOpen && <span><i className="lg-open"><Wrench size={8} /></i> OT abierta</span>}
        {focus && <span><i className="lg-focus" /> Intervenido en la OT</span>}
      </div>
    </div>

    <div className={`bus-canvas ${focus ? 'focus-mode' : ''}`} style={{ aspectRatio: views[view].ratio }} onClick={() => onSelect?.(null)}>
      <AnimatePresence mode="wait">
        <motion.img key={view} src={views[view].src} alt={`Bus Solbus · ${views[view].label}`} initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: .35 }} draggable={false} />
      </AnimatePresence>
      <div className="bus-shade" />
      <div className="bus-scan" />

      {visible.map((c) => {
        const raw = stats[c.id]; const s = raw && !showOpen ? { ...raw, open: false } : raw; const [x, y] = c.spots[view]!;
        const count = s?.count ?? 0; const intensity = count / max;
        const isHi = highlight.includes(c.id); const isSel = selected === c.id;
        if (!count && !isHi && !s?.open) return <button key={c.id} className={`spot idle ${isSel ? 'selected' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} onClick={(e) => { e.stopPropagation(); onSelect?.(isSel ? null : c.id); }} aria-label={c.name} />;
        return <div key={c.id} className="spot-wrap" style={{ left: `${x}%`, top: `${y}%` }}>
          {!focus && count > 0 && <span className="heat" style={{ ['--i' as string]: intensity.toFixed(2) }} />}
          {isHi && <><span className="focus-ring" /><span className="focus-ring delay" /></>}
          <button className={`spot ${s?.open ? 'open' : ''} ${isHi ? 'hi' : ''} ${isSel ? 'selected' : ''} ${focus && !isHi ? 'dim' : ''}`} style={{ ['--i' as string]: intensity.toFixed(2) }}
            onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} onClick={(e) => { e.stopPropagation(); onSelect?.(isSel ? null : c.id); }} aria-label={`${c.name}: ${count} ${heatLabel}`}>
            {s?.open ? <Wrench size={11} /> : count > 0 ? count : ''}
          </button>
          {isHi && <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`callout ${x > 60 ? 'left' : 'right'} ${y < 25 ? 'below' : ''}`}>{c.name}</motion.span>}
        </div>;
      })}

      <AnimatePresence>{hovered && hovered.spots[view] && <motion.div key={hovered.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`spot-tip ${hovered.spots[view]![0] > 62 ? 'tip-left' : ''} ${hovered.spots[view]![1] > 70 ? 'tip-up' : ''}`} style={{ left: `${hovered.spots[view]![0]}%`, top: `${hovered.spots[view]![1]}%` }}>
        <small>{hovered.system}</small>
        <strong>{hovered.name}</strong>
        {stats[hovered.id]?.count ? <>
          <span><b>{fmt(stats[hovered.id].count)}</b> {heatLabel}{stats[hovered.id].cost ? <> · <b>{moneyShort(stats[hovered.id].cost!)}</b></> : null}</span>
          {stats[hovered.id].last && <span>Última: {date(stats[hovered.id].last!)}</span>}
          {showOpen && stats[hovered.id].open && <span className="tip-open"><Wrench size={11} /> Con OT abierta</span>}
        </> : <span>Sin intervenciones en el período</span>}
        <em>Click para ver detalle</em>
      </motion.div>}</AnimatePresence>
    </div>

    {elsewhere.length > 0 && <div className="elsewhere"><span>Visibles en {views[otherView].label.toLowerCase()}:</span>{elsewhere.map((c) => <button key={c.id} className={highlight.includes(c.id) ? 'hi' : ''} onClick={() => { onView(otherView); onSelect?.(c.id); }}>{c.name}{stats[c.id]?.count ? <b>{stats[c.id].count}</b> : null}</button>)}</div>}
  </div>;
}
