import { useState } from 'react';
import { motion } from 'framer-motion';
import { bases, isOpen, SERVICE_KM, units } from '../data/fleet';
import type { UnitStatus } from '../data/types';
import { fmt, pct } from '../lib/format';
import { componentById } from '../data/catalog';
import type { OpenUnit } from './Taller';

const statusMeta: Record<UnitStatus, { letter: string; cls: string }> = {
  Operativo: { letter: 'O', cls: 'operativo' },
  'En taller': { letter: 'T', cls: 'en-taller' },
  'Esperando repuesto': { letter: 'R', cls: 'esperando-repuesto' },
  'Fuera de servicio': { letter: 'F', cls: 'fuera-de-servicio' },
};

export function Flota({ baseFilter, query, onOpenUnit }: { baseFilter: string; query: string; onOpenUnit: OpenUnit }) {
  const [status, setStatus] = useState<UnitStatus | 'Todos'>('Todos');
  const q = query.trim().toLowerCase();
  const list = units.filter((u) => (baseFilter === 'Todas las bases' || u.base === baseFilter) && (status === 'Todos' || u.status === status) && (!q || `${u.interno} ${u.plate} ${u.line} ${u.body}`.toLowerCase().includes(q)));
  const scope = units.filter((u) => baseFilter === 'Todas las bases' || u.base === baseFilter);
  const count = (s: UnitStatus) => scope.filter((u) => u.status === s).length;

  return <>
    <section className="module-summary">
      <div className="module-summary-main"><div><span className="section-kicker">Disponibilidad de flota</span><h2>{pct((count('Operativo') / scope.length) * 100)}</h2><p>{count('Operativo')} de {scope.length} coches operativos · click en un coche para abrir su ficha técnica</p></div></div>
      <div className="status-filter">{(['Todos', 'Operativo', 'En taller', 'Esperando repuesto', 'Fuera de servicio'] as const).map((s) => <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s !== 'Todos' && <i className={`st-dot ${statusMeta[s].cls}`}>{statusMeta[s].letter}</i>}{s}<b>{s === 'Todos' ? scope.length : count(s)}</b></button>)}</div>
    </section>
    {bases.filter((b) => baseFilter === 'Todas las bases' || b.name === baseFilter).map((b) => {
      const items = list.filter((u) => u.base === b.name); if (!items.length) return null;
      return <section key={b.code} className="fleet-grid-block">
        <div className="section-header compact"><div><span className="section-kicker">{b.city}</span><h2><i className="base-dot" style={{ background: b.color }} />{b.name}</h2></div><span className="muted">{items.length} coches</span></div>
        <div className="unit-grid">{items.map((u) => {
          const open = u.orders.find(isOpen); const overdue = u.km - u.lastServiceKm >= SERVICE_KM;
          return <motion.button whileHover={{ y: -3, scale: 1.03 }} key={u.interno} className={`unit-tile ${statusMeta[u.status].cls}`} onClick={() => onOpenUnit(u.interno, open ? { order: open.id } : undefined)} title={`${u.interno} · ${u.status}${open ? ` · ${open.title}` : ''}`}>
            <span className="ut-letter">{statusMeta[u.status].letter}</span>
            <strong>{u.interno}</strong>
            <small>Línea {u.line}</small>
            <small className="ut-detail">{open ? componentById[open.components[0]].name : `${fmt(u.km / 1000)} mil km`}</small>
            {overdue && <span className="ut-flag" title="Service vencido">S</span>}
          </motion.button>;
        })}</div>
      </section>;
    })}
    <p className="footnote">Letra + color: O operativo · T en taller · R esperando repuesto · F fuera de servicio · S service vencido.</p>
  </>;
}
