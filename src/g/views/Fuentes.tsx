/* Panel «Fuente de datos»: de dónde lee el tablero, qué tan al día está cada fuente, cuánto falta para cero demo
   y la conexión (demo · archivo JSON · Supabase). Pensado para Sistemas; Gerencia lo usa para ver el avance. */
import React, { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Database, Download, FileJson, FlaskConical, Loader2, PlugZap, RefreshCw, Sparkles } from 'lucide-react';
import { SNAP, SOURCE, loadSource, readConfig, saveConfig, type SourceConfig, type SourceKind } from '../../data/source';
import { corteTxt } from '../../data/window';
import { MONTH_FULL } from '../data';
import { FALTANTES, avance, snapshotBlocks, sourceLabel } from '../coverage';
import { downloadCsv } from '../inspect';
import { askAssistant } from '../asistente/Asistente';
import { Modal } from './Shell';

const MOD_LABEL: Record<string, string> = { Resumen: 'Resumen', Tráfico: 'Tráfico', Flota: 'Flota', Taller: 'Taller', RRHH: 'RR.HH.', Combustible: 'Combustible', Seguridad: 'Siniestros y seguridad', Pañol: 'Pañol' };
const KINDS: { k: SourceKind; label: string; desc: string; icon: React.ElementType }[] = [
  { k: 'demo', label: 'Demostración', desc: 'Sin conexión: datos de ejemplo.', icon: FlaskConical },
  { k: 'json', label: 'Archivo JSON', desc: 'Un snapshot publicado en una dirección.', icon: FileJson },
  { k: 'supabase', label: 'Supabase', desc: 'La base limpia, en vivo.', icon: Database },
];
const when = (iso?: string | null) => { if (!iso) return '—'; const d = new Date(iso); return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
/** Si la clave pegada es una service_role (acceso total a la base), se rechaza: el tablero solo usa la clave pública. */
function keyProblem(key: string): string | null {
  const k = key.trim(); if (!k) return null;
  if (/^sb_secret_/i.test(k)) return 'Esa es una clave secreta. El tablero solo acepta la clave pública (anon / publishable).';
  const part = k.split('.')[1]; if (!part) return null;
  try { const p = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }; if (p.role && p.role !== 'anon') return `Esa clave es «${p.role}» y da acceso completo a la base. Usá la clave pública «anon».`; } catch { /* no es un JWT legible: se deja pasar */ }
  return null;
}

export function FuentesModal({ onClose, notify }: { onClose: () => void; notify: (m: string) => void }) {
  const [cfg, setCfg] = useState<SourceConfig>(() => readConfig());
  const [test, setTest] = useState<{ busy?: boolean; ok?: boolean; msg?: string } | null>(null);
  const av = useMemo(() => avance(), []);
  const blocks = snapshotBlocks();
  const fuentes = SNAP?.meta?.fuentes ?? [];
  const bad = cfg.tipo === 'supabase' ? keyProblem(cfg.anonKey ?? '') : null;
  const ready = cfg.tipo === 'demo' || (cfg.tipo === 'json' ? !!cfg.url?.trim() : !!cfg.url?.trim() && !!cfg.anonKey?.trim() && !bad);
  const clean = (): SourceConfig => (cfg.tipo === 'demo' ? { tipo: 'demo' } : cfg.tipo === 'json' ? { tipo: 'json', url: cfg.url?.trim() } : { tipo: 'supabase', url: cfg.url?.trim().replace(/\/$/, ''), anonKey: cfg.anonKey?.trim(), rpc: cfg.rpc?.trim() || undefined });
  const probar = async () => {
    setTest({ busy: true });
    const { state, snap } = await loadSource(clean(), { apply: false });
    if (state.modo === 'real' && snap) setTest({ ok: true, msg: `Conexión correcta en ${state.ms} ms · último mes ${snap.meta.hasta ?? 'sin informar'} · ${snap.mensual?.length ?? 0} filas mensuales, ${snap.rrhh_mensual?.length ?? 0} de RR.HH., ${snap.unidades?.length ?? 0} coches y ${snap.ot?.length ?? 0} OT.` });
    else setTest({ ok: false, msg: state.error ?? 'No se pudo leer la fuente.' });
  };
  const guardar = () => { saveConfig(clean()); notify('Fuente guardada · recargando el tablero'); window.setTimeout(() => window.location.reload(), 500); };
  const tone = SOURCE.modo === 'real' ? 'good' : SOURCE.modo === 'cache' ? 'warn' : '';

  return <Modal kicker="Sistemas · conexión y cobertura" title="Fuente de datos" onClose={onClose} wide>
    <div className="fx-status">
      <div className={`fx-card ${tone}`}><span>Estado</span><strong>{sourceLabel()}</strong><small>{SOURCE.modo === 'demo' ? 'Sin fuente conectada' : `Leído ${when(SOURCE.cargado)}${SOURCE.ms ? ` · ${SOURCE.ms} ms` : ''}`}</small></div>
      <div className="fx-card"><span>Período que se muestra</span><strong>{MONTH_FULL[0].replace(/ \d+$/, '').slice(0, 3)} {MONTH_FULL[0].slice(-4)} – {MONTH_FULL[11].replace(/ \d+$/, '').slice(0, 3)} {MONTH_FULL[11].slice(-4)}</strong><small>Corte {SNAP?.meta?.corte ? SNAP.meta.corte.split('-').reverse().join('/') : corteTxt}</small></div>
      <div className="fx-card"><span>Avance hacia cero demo</span><strong>{av.pct.toLocaleString('es-AR', { maximumFractionDigits: 0 })}%</strong><small>{av.real} reales · {av.parcial} parciales · {av.demo} demo</small></div>
      <div className="fx-card"><span>Bloques recibidos</span><strong>{blocks.mensual + blocks.rrhh_mensual} filas</strong><small>{blocks.unidades} coches · {blocks.ot} OT</small></div>
    </div>
    {SOURCE.error && <p className="fx-alert bad"><CircleAlert size={15} /> No se pudo leer la fuente: {SOURCE.error} {SOURCE.modo === 'cache' ? 'Se muestra la última copia guardada.' : 'Se muestran los datos de demostración.'}</p>}
    {SOURCE.avisos.length > 0 && <details className="fx-details"><summary>{SOURCE.avisos.length} avisos al aplicar los datos</summary><ul>{SOURCE.avisos.map((a) => <li key={a}>{a}</li>)}</ul></details>}

    <div className="fx-grid">
      <section>
        <h3 className="md-sub">Indicadores reales por módulo</h3>
        <ul className="fx-mods">{av.porModulo.map((x) => <li key={x.modulo}><span>{MOD_LABEL[x.modulo] ?? x.modulo}</span><div className="fx-bar"><i style={{ width: `${x.pct}%` }} /></div><b>{x.pct.toLocaleString('es-AR', { maximumFractionDigits: 0 })}%</b><small>{x.real}/{x.total}</small></li>)}</ul>
        <h3 className="md-sub">Fuentes de la base</h3>
        {fuentes.length ? <div className="g-table-wrap"><table className="g-table"><thead><tr><th>Fuente</th><th>Estado</th><th>Corte</th><th>Última carga</th><th>Filas</th></tr></thead>
          <tbody>{fuentes.map((f) => <tr key={f.id}><td><b>{f.nombre}</b></td><td className={f.estado === 'ok' ? 'ok' : f.estado === 'error' ? 'low' : ''}>{f.frescura ?? f.estado ?? '—'}</td><td>{f.corte ? f.corte.split('-').reverse().join('/') : '—'}</td><td>{when(f.ultima_carga)}</td><td>{f.filas ?? '—'}</td></tr>)}</tbody></table></div>
          : <p className="fx-empty">Todavía no hay fuentes informadas. Aparecen acá cuando el tablero lee la base (bloque <code>meta.fuentes</code>).</p>}
      </section>

      <section>
        <h3 className="md-sub">Conexión</h3>
        <div className="fx-kinds" role="radiogroup" aria-label="Tipo de fuente">{KINDS.map(({ k, label, desc, icon: I }) => <button key={k} role="radio" aria-checked={cfg.tipo === k} className={cfg.tipo === k ? 'on' : ''} onClick={() => { setCfg({ ...cfg, tipo: k }); setTest(null); }}><I size={16} /><b>{label}</b><small>{desc}</small></button>)}</div>
        {cfg.tipo === 'json' && <label className="fx-field"><span>Dirección del archivo</span><input value={cfg.url ?? ''} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} placeholder="datos/ejemplo-snapshot.json" spellCheck={false} /></label>}
        {cfg.tipo === 'supabase' && <>
          <label className="fx-field"><span>Dirección del proyecto</span><input value={cfg.url ?? ''} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} placeholder="https://xxxxxxxx.supabase.co" spellCheck={false} /></label>
          <label className="fx-field"><span>Clave pública (anon)</span><input value={cfg.anonKey ?? ''} onChange={(e) => setCfg({ ...cfg, anonKey: e.target.value })} placeholder="eyJ…" spellCheck={false} autoComplete="off" /></label>
          {bad && <p className="fx-alert bad"><CircleAlert size={15} /> {bad}</p>}
          <label className="fx-field"><span>Función</span><input value={cfg.rpc ?? ''} onChange={(e) => setCfg({ ...cfg, rpc: e.target.value })} placeholder="tablero_snapshot" spellCheck={false} /></label>
        </>}
        {cfg.tipo !== 'demo' && <p className="fx-note">El tablero recibe solo totales por base y mes, la flota y las OT. No baja tablas completas ni datos personales de RR.HH.</p>}
        {test && !test.busy && <p className={`fx-alert ${test.ok ? 'good' : 'bad'}`}>{test.ok ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />} {test.msg}</p>}
        <div className="fx-actions">
          {cfg.tipo !== 'demo' && <button className="cfg-btn" onClick={probar} disabled={!ready || test?.busy}>{test?.busy ? <Loader2 size={14} className="spin" /> : <PlugZap size={14} />} Probar conexión</button>}
          <button className="export-button" onClick={guardar} disabled={!ready}><RefreshCw size={14} /> Guardar y recargar</button>
        </div>
      </section>
    </div>

    <details className="fx-details" open={SOURCE.modo === 'demo'}>
      <summary>{FALTANTES.length} datos todavía sin fuente <button className="cfg-btn" onClick={(e) => { e.preventDefault(); downloadCsv('datos-faltantes', [{ key: 'modulo', label: 'Módulo' }, { key: 'dato', label: 'Dato que falta' }, { key: 'completa', label: 'Indicadores que completa' }, { key: 'area', label: 'Quién lo tiene' }, { key: 'bloque', label: 'Tabla de la base' }], FALTANTES.map((f) => ({ ...f }))); }}><Download size={13} /> Descargar</button></summary>
      <div className="g-table-wrap"><table className="g-table"><thead><tr><th>Módulo</th><th>Dato que falta</th><th>Completa</th><th>Quién lo tiene</th><th>Tabla</th></tr></thead>
        <tbody>{FALTANTES.map((f) => <tr key={f.dato}><td>{MOD_LABEL[f.modulo] ?? f.modulo}</td><td><b>{f.dato}</b></td><td>{f.completa}</td><td>{f.area}</td><td><code>{f.bloque}</code></td></tr>)}</tbody></table></div>
    </details>
    <div className="sn-actions cfg-actions"><button className="text-button" onClick={() => { onClose(); askAssistant('¿Cómo conecto la base?'); }}><Sparkles size={14} /> Preguntar al asistente cómo conectar</button><span className="fx-foot">Guía completa: <code>base_limpia/README.md</code></span></div>
  </Modal>;
}
