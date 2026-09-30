import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, BusFront, CalendarDays, ChevronRight, Gauge, RefreshCw, Route, ShieldAlert, Ticket, Users, Wallet } from 'lucide-react';
import { LineRow, MONTH_LABELS, OBJ, PERIODS, Sem, UnitFilter, aggregate, delta, lineRows, objectives, semMax, semMin, DeltaKind, UNIT_COLOR, UnitName } from '../data';
import { AXIS, DeltaChip, GRID, Panel, SemDot, TOOLTIP_STYLE, fmt, money, pct } from '../ui';

type Target = 'Tráfico' | 'Seguridad' | 'RRHH' | 'Taller' | 'Flota';
export interface GRecord { id: string; base: string; title: string; detail: string; status: 'Operativo' | 'Atención' | 'Crítico'; time: string }
interface Props { unit: UnitFilter; setUnit: (u: UnitFilter) => void; go: (m: Target) => void; notify: (m: string) => void; onRecord: (r: GRecord) => void }
interface K { label: string; value: string; sem?: Sem; obj?: string; d: number | null; kind: DeltaKind; goodUp: boolean; digits?: number; go?: Target }
interface Group { title: string; icon: React.ElementType; color: string; items: K[]; go: Target }

const stamp = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };

export function Gerencia({ unit, setUnit, go, notify, onRecord }: Props) {
  const [periodId, setPeriodId] = useState('q3');
  const [updated, setUpdated] = useState(stamp());
  const period = PERIODS.find((p) => p.id === periodId)!;
  const cur = useMemo(() => aggregate(unit, period.months), [unit, period]);
  const prev = useMemo(() => aggregate(unit, period.prev), [unit, period]);
  const obj = useMemo(() => objectives(unit, period.months.length), [unit, period]);
  const lines = useMemo(() => lineRows(unit, period.months), [unit, period]);
  const dl = (kind: DeltaKind, a: number, b: number) => delta(kind, a, b);
  const perTxt = period.quarter ? 'trimestre anterior' : 'mes anterior';

  const groups: Group[] = [
    { title: 'OPERACIÓN', icon: Route, color: '#3b82f6', go: 'Tráfico', items: [
      { label: 'KM ejecutados', value: pct(cur.cumpl), sem: semMin(cur.cumpl, OBJ.km, 1), obj: `Objetivo ≥ ${OBJ.km}%`, d: dl('pp', cur.cumpl, prev.cumpl), kind: 'pp', goodUp: true },
      { label: 'Regularidad', value: pct(cur.reg), sem: semMin(cur.reg, OBJ.reg, 1), obj: `Objetivo ≥ ${OBJ.reg}%`, d: dl('pp', cur.reg, prev.reg), kind: 'pp', goodUp: true },
    ] },
    { title: 'FLOTA', icon: BusFront, color: '#14b8a6', go: 'Flota', items: [
      { label: 'Disponibilidad operativa', value: pct(cur.disp), sem: semMin(cur.disp, OBJ.disp, 3), obj: `Objetivo ≥ ${OBJ.disp}%`, d: dl('pp', cur.disp, prev.disp), kind: 'pp', goodUp: true },
      { label: 'Auxilios en vía', value: fmt(cur.aux), sem: semMax(cur.aux, obj.aux, Math.ceil(obj.aux * 0.5)), obj: `Objetivo ≤ ${obj.aux}`, d: dl('abs', cur.aux, prev.aux), kind: 'abs', goodUp: false },
    ] },
    { title: 'RR.HH.', icon: Users, color: '#f97316', go: 'RRHH', items: [
      { label: 'Ausentismo', value: pct(cur.aus), sem: semMax(cur.aus, OBJ.aus, 1.5), obj: `Objetivo ≤ ${OBJ.aus}%`, d: dl('pp', cur.aus, prev.aus), kind: 'pp', goodUp: false },
      { label: 'Cobertura de turnos', value: pct(cur.cob), sem: semMin(cur.cob, OBJ.cob, 1), obj: `Objetivo ≥ ${OBJ.cob}%`, d: dl('pp', cur.cob, prev.cob), kind: 'pp', goodUp: true },
    ] },
    { title: 'SEGURIDAD', icon: ShieldAlert, color: '#ef4444', go: 'Seguridad', items: [
      { label: 'Siniestros', value: fmt(cur.sin), sem: semMax(cur.sin, obj.sin, Math.ceil(obj.sin * 0.25)), obj: `Objetivo ≤ ${obj.sin}`, d: dl('abs', cur.sin, prev.sin), kind: 'abs', goodUp: false },
      { label: 'Excesos de velocidad', value: fmt(cur.exc), sem: semMax(cur.exc, obj.exc, Math.ceil(obj.exc * 0.4)), obj: `Objetivo ≤ ${obj.exc}`, d: dl('abs', cur.exc, prev.exc), kind: 'abs', goodUp: false },
    ] },
    { title: 'ECONÓMICO', icon: BarChart3, color: '#8b5cf6', go: 'Taller', items: [
      { label: 'Costo por km', value: money(cur.cost), sem: semMax(cur.cost, OBJ.cost, 3), obj: `Objetivo ≤ ${money(OBJ.cost, 2)}`, d: dl('pct', cur.cost, prev.cost), kind: 'pct', goodUp: false },
      { label: 'Ingreso por km', value: money(cur.inc), d: dl('pct', cur.inc, prev.inc), kind: 'pct', goodUp: true },
      { label: 'Margen por km', value: money(cur.margin), d: dl('pct', cur.margin, prev.margin), kind: 'pct', goodUp: true },
    ] },
    { title: 'DEMANDA', icon: Ticket, color: '#0ea5e9', go: 'Tráfico', items: [
      { label: 'Pasajeros transportados', value: fmt(cur.pax), d: dl('pct', cur.pax, prev.pax), kind: 'pct', goodUp: true },
      { label: 'Índice pasajeros por km (IPK)', value: fmt(cur.ipk, 2), d: dl('pct', cur.ipk, prev.ipk), kind: 'pct', goodUp: true },
    ] },
  ];

  // gráficos: trimestre → 3 meses; mes → 6 meses de contexto
  const chartMonths = period.quarter ? period.months : Array.from({ length: Math.min(6, period.months[0] + 1) }, (_, i) => period.months[0] - Math.min(5, period.months[0]) + i);
  const series = chartMonths.map((m) => { const a = aggregate(unit, [m]); return { m: MONTH_LABELS[m], kmProg: a.kmProg, kmExec: a.kmExec, cumpl: +a.cumpl.toFixed(1), oper: a.oper, out: a.out, disp: +a.disp.toFixed(1), pax: a.pax, ipk: +a.ipk.toFixed(2) }; });
  const mil = (v: number) => (v >= 1_000_000 ? `${fmt(v / 1_000_000, 1)} M` : `${fmt(v / 1000, 0)} mil`);

  // alertas dinámicas
  const worst = lines.length ? [...lines].sort((a, b) => a.cumpl - b.cumpl)[0] : null;
  const worstTxt = worst ? `${unit === 'Todos' ? `${worst.unit} · ` : ''}Línea ${worst.line}` : '';
  const pctOver = (v: number, o: number) => Math.round(((v - o) / o) * 100);
  const alerts = [
    { n: 1, sem: semMax(cur.sin, obj.sin, 0), icon: ShieldAlert, title: cur.sin > obj.sin ? 'Siniestros por encima del objetivo' : 'Siniestros dentro del objetivo', big: fmt(cur.sin), sub: `siniestros en ${period.quarter ? 'el trimestre' : 'el mes'}`, obj: `Objetivo ≤ ${obj.sin}`, note: prev.sin ? `${cur.sin >= prev.sin ? 'Incremento' : 'Reducción'} del ${Math.abs(Math.round(((cur.sin - prev.sin) / prev.sin) * 100))}% vs. ${perTxt}.` : '', cta: 'Definir plan correctivo inmediato', to: 'Seguridad' as Target },
    { n: 2, sem: semMax(cur.exc, obj.exc, 0), icon: Gauge, title: cur.exc > obj.exc ? 'Excesos de velocidad en aumento' : 'Excesos de velocidad controlados', big: fmt(cur.exc), sub: `eventos en ${period.quarter ? 'el trimestre' : 'el mes'}`, obj: `Objetivo ≤ ${obj.exc}`, note: prev.exc ? `${cur.exc >= prev.exc ? 'Incremento' : 'Reducción'} del ${Math.abs(Math.round(((cur.exc - prev.exc) / prev.exc) * 100))}% vs. ${perTxt}.` : '', cta: 'Aprobar plan de control y capacitación', to: 'Seguridad' as Target },
    { n: 3, sem: semMax(cur.aus, OBJ.aus, 0), icon: Users, title: cur.aus > OBJ.aus ? 'Ausentismo por encima del límite' : 'Ausentismo dentro del límite', big: pct(cur.aus), sub: 'del total de horas', obj: `Objetivo ≤ ${OBJ.aus}%`, note: cur.aus > OBJ.aus ? 'Impacto en cobertura y aumento de horas extra.' : 'Cobertura de turnos sostenida.', cta: 'Revisar medidas con RR.HH. y salud laboral', to: 'RRHH' as Target },
    { n: 4, sem: worst ? semMin(worst.cumpl, OBJ.km, 0) : 'good', icon: BusFront, title: worst && worst.cumpl < OBJ.km ? `${worstTxt} con bajo cumplimiento` : 'Todas las líneas en objetivo', big: worst ? pct(worst.cumpl) : '—', sub: 'km ejecutados', obj: `Objetivo ≥ ${OBJ.km}%`, note: worst ? `${worst.sin} siniestros y ${worst.exc} excesos de velocidad en ${period.quarter ? 'el trimestre' : 'el mes'}.` : '', cta: 'Definir refuerzos y plan operativo específico', to: 'Tráfico' as Target },
    { n: 5, sem: semMax(cur.cost, OBJ.cost, 0), icon: Wallet, title: cur.cost > OBJ.cost ? 'Costo por km aún elevado' : 'Costo por km en objetivo', big: money(cur.cost), sub: 'costo por km', obj: `Objetivo ≤ ${money(OBJ.cost, 2)}`, note: `${cur.cost <= prev.cost ? 'Mejora' : 'Aumento'} del ${Math.abs(delta('pct', cur.cost, prev.cost)).toFixed(1).replace('.', ',')}%${cur.cost > OBJ.cost ? ', pero aún por encima del objetivo' : ''}.`, cta: 'Evaluar optimización de costos técnicos', to: 'Taller' as Target },
  ];
  const openAlerts = alerts.filter((a) => a.sem !== 'good').length;

  const openLine = (r: LineRow) => onRecord({
    id: `LIN-${r.unit.slice(0, 3).toUpperCase()}-${r.line}`, base: r.unit, title: `Línea ${r.line} · ${pct(r.cumpl)} de km cumplidos`,
    detail: `${fmt(r.kmExec)} km · IPK ${fmt(r.ipk, 2)} · ${r.sin} siniestros · ${r.exc} excesos de velocidad`,
    status: r.cumpl >= OBJ.km ? 'Operativo' : r.cumpl >= OBJ.km - 1 ? 'Atención' : 'Crítico', time: period.short,
  });

  return <div className="gerencia">
    <section className="g-header">
      <div><span className="section-kicker">Gerencia general</span><h2>Tablero de control integral</h2>
        <p>{unit === 'Todos' ? 'Grupo Solbus · 4 unidades de negocio: Córdoba, Comodoro, San Luis y Villa Mercedes' : `Grupo Solbus · Unidad ${unit}`}</p></div>
      <div className="g-header-tools">
        <label className="g-select"><CalendarDays size={16} /><span>Período<select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></span></label>
        <button className="g-refresh" onClick={() => { setUpdated(stamp()); notify('Indicadores actualizados'); }}><RefreshCw size={16} /><span>Última actualización<b>{updated}</b></span></button>
      </div>
    </section>

    <section className="g-kpis">
      {groups.map((g, gi) => <motion.div key={g.title} className="g-kpi-card" style={{ ['--tone' as string]: g.color }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.05 }}>
        <button className="g-kpi-head" onClick={() => go(g.go)}><g.icon size={18} /><span>{g.title}</span><ChevronRight size={15} /></button>
        <div className="g-kpi-body">{g.items.map((k) => <div className="g-kpi" key={k.label}>
          <span className="g-kpi-label">{k.label}</span>
          <div className="g-kpi-value"><strong>{k.value}</strong>{k.sem && <SemDot sem={k.sem} />}</div>
          <div className="g-kpi-foot">{k.obj && <small>{k.obj}</small>}<DeltaChip value={k.d} kind={k.kind} goodUp={k.goodUp} digits={k.kind === 'pct' ? 1 : 1} label={`vs. ${perTxt}`} /></div>
        </div>)}</div>
      </motion.div>)}
    </section>

    <section className="g-charts">
      <Panel kicker="Operación" title="KM ejecutados y cumplimiento" className="g-chart">
        <div className="g-chart-box"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={series} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} />
          <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={AXIS} tickFormatter={mil} /><YAxis yAxisId="r" orientation="right" domain={[90, 100]} axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v: number, n: string) => (n === 'Cumplimiento' ? [`${fmt(v, 1)}%`, n] : [fmt(v), n])} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#8c96ac' }} />
          <Bar yAxisId="l" dataKey="kmProg" name="Programados" fill="#93c5fd" fillOpacity={0.55} radius={[4, 4, 0, 0]} /><Bar yAxisId="l" dataKey="kmExec" name="Ejecutados" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Line yAxisId="r" dataKey="cumpl" name="Cumplimiento" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4, fill: '#0b1020', stroke: '#34d399', strokeWidth: 2 }} />
        </ComposedChart></ResponsiveContainer></div>
      </Panel>
      <Panel kicker="Flota" title="Disponibilidad de flota" className="g-chart">
        <div className="g-chart-box"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={series} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} />
          <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={AXIS} /><YAxis yAxisId="r" orientation="right" domain={[80, 100]} axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => `${v}%`} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v: number, n: string) => (n === 'Disponibilidad' ? [`${fmt(v, 1)}%`, n] : [fmt(v), n])} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#8c96ac' }} />
          <Bar yAxisId="l" dataKey="oper" name="Operativas" fill="#2563eb" radius={[4, 4, 0, 0]} /><Bar yAxisId="l" dataKey="out" name="Fuera de servicio" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Line yAxisId="r" dataKey="disp" name="Disponibilidad" stroke="#34d399" strokeWidth={2.5} dot={{ r: 4, fill: '#0b1020', stroke: '#34d399', strokeWidth: 2 }} />
        </ComposedChart></ResponsiveContainer></div>
      </Panel>
      <Panel kicker="Demanda" title="Pasajeros transportados" className="g-chart">
        <div className="g-chart-box"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={series} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} /><XAxis dataKey="m" axisLine={false} tickLine={false} tick={AXIS} />
          <YAxis yAxisId="l" axisLine={false} tickLine={false} tick={AXIS} tickFormatter={mil} /><YAxis yAxisId="r" orientation="right" domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={AXIS} tickFormatter={(v) => fmt(v, 2)} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,.04)' }} formatter={(v: number, n: string) => (n === 'IPK' ? [fmt(v, 2), n] : [fmt(v), n])} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#8c96ac' }} />
          <Bar yAxisId="l" dataKey="pax" name="Pasajeros" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Line yAxisId="r" dataKey="ipk" name="IPK" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 4, fill: '#0b1020', stroke: '#fbbf24', strokeWidth: 2 }} />
        </ComposedChart></ResponsiveContainer></div>
      </Panel>
      <Panel kicker={period.quarter ? 'Trimestre' : 'Mes'} title="Indicadores por línea" className="g-lines">
        <div className="g-table-wrap"><table className="g-table"><thead><tr><th>Línea</th>{unit === 'Todos' && <th>Unidad</th>}<th>Km ejec.</th><th>Cumpl. %</th><th>IPK</th><th>Sin.</th><th>Exc.</th></tr></thead>
          <tbody>{lines.map((r) => <tr key={r.unit + r.line} className={r === worst && r.cumpl < OBJ.km ? 'row-bad' : ''} onClick={() => openLine(r)}>
            <td><b>{r.line}</b></td>{unit === 'Todos' && <td><span className="unit-tag"><i style={{ background: UNIT_COLOR[r.unit as UnitName] }} />{r.unit}</span></td>}
            <td>{fmt(r.kmExec)}</td><td className={r.cumpl >= OBJ.km ? 'ok' : 'low'}>{pct(r.cumpl)}</td><td>{fmt(r.ipk, 2)}</td><td>{r.sin}</td><td>{r.exc}</td></tr>)}</tbody>
          <tfoot><tr><td>Total</td>{unit === 'Todos' && <td />}<td>{fmt(cur.kmExec)}</td><td>{pct(cur.cumpl)}</td><td>{fmt(cur.ipk, 2)}</td><td>{cur.sin}</td><td>{cur.exc}</td></tr></tfoot></table></div>
      </Panel>
    </section>

    <section className="g-alerts">
      <div className="g-alerts-head"><AlertTriangle size={20} /><h3>{openAlerts ? `${openAlerts} de 5 alertas principales requieren decisión gerencial` : 'Sin alertas críticas: todos los indicadores en objetivo'}</h3><button onClick={() => notify('Panel completo de alertas disponible en Seguridad y Flota')}>Ver todas las alertas <ChevronRight size={14} /></button></div>
      <div className="g-alert-grid">{alerts.map((a) => <motion.div key={a.n} className={`g-alert ${a.sem}`} whileHover={{ y: -3 }}>
        <div className="g-alert-title"><span className="g-alert-n">{a.n}</span><b>{a.title}</b></div>
        <div className="g-alert-metric"><a.icon size={26} /><div><strong>{a.big}</strong><span>{a.sub}</span><small>{a.obj}</small></div></div>
        <p>{a.note}</p>
        <button onClick={() => { if (a.n === 4 && worst && unit === 'Todos') setUnit(worst.unit); go(a.to); }}>{a.cta}</button>
      </motion.div>)}</div>
    </section>
  </div>;
}
