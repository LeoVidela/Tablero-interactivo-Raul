import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, ArrowUpRight, Bot, Database, Eraser, Loader2, Sparkles, X } from 'lucide-react';
import type { UnitFilter } from '../data';
import type { Target } from '../metrics';
import { useDrill } from '../drill';
import { useOpenUnit } from '../openUnit';
import { STARTERS, answer, type Action, type Answer, type Memory } from './engine';
import { sourceLabel } from '../coverage';
import { SOURCE } from '../../data/source';
import { isAdmin } from '../admin';
import { askIa, goesToIa, iaReady, type IaTurn } from './ia';

/** Abre el asistente desde cualquier pantalla (opcionalmente con una pregunta ya enviada). */
export const askAssistant = (q?: string) => window.dispatchEvent(new CustomEvent('solbus-ask', { detail: q ?? '' }));

interface Msg { id: number; q?: string; a?: Answer; ia?: 'cargando' | 'ok' | 'local' }
const KEY = 'solbus-asistente';
const load = (): string[] => { try { const x = JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); return Array.isArray(x) ? x.filter((s) => typeof s === 'string').slice(-12) : []; } catch { return []; } };
const save = (qs: string[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(qs.slice(-12))); } catch { /* sin almacenamiento */ } };

/** Texto con **negritas** y viñetas («• »). */
function Rich({ text }: { text: string }) {
  const bold = (s: string, k: number) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <b key={`${k}-${i}`}>{p.slice(2, -2)}</b> : <React.Fragment key={`${k}-${i}`}>{p}</React.Fragment>));
  const lines = text.split('\n'); const out: React.ReactNode[] = []; let list: React.ReactNode[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={`u${out.length}`}>{list}</ul>); list = []; } };
  lines.forEach((l, i) => { if (l.startsWith('• ')) list.push(<li key={i}>{bold(l.slice(2), i)}</li>); else { flush(); if (l.trim()) out.push(<p key={i}>{bold(l, i)}</p>); } });
  flush();
  return <>{out}</>;
}
function Spark({ s }: { s: NonNullable<Answer['spark']> }) {
  const min = Math.min(...s.values); const max = Math.max(...s.values); const span = max - min || 1;
  return <div className="as-spark" role="img" aria-label="Evolución de 12 meses">{s.values.map((v, i) => <div key={i} className={i === s.hi ? 'hi' : ''} title={`${s.labels[i]}: ${s.fmt(v)}`}><i style={{ height: `${18 + ((v - min) / span) * 82}%` }} /><span>{s.labels[i][0]}</span></div>)}</div>;
}

export function Asistente({ unit, module, onPanel }: { unit: UnitFilter; module: Target; onPanel: (p: 'fuentes' | 'help' | 'cmp') => void }) {
  const drill = useDrill(); const openUnit = useOpenUnit();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [who, setWho] = useState<'gerencia' | 'sistemas'>('gerencia');
  const mem = useRef<Memory>({}); const hist = useRef<IaTurn[]>([]); const seq = useRef(0); const boxRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLInputElement>(null);
  const ctx = useRef({ unit, module }); ctx.current = { unit, module };
  const restored = useRef(false);

  const ask = useCallback((q: string, remember = true) => {
    const clean = q.trim(); if (!clean) return;
    const r = answer(clean, { ...ctx.current, mem: mem.current }); mem.current = r.mem;
    const id = ++seq.current; const useIa = remember && iaReady() && goesToIa(r.a);
    setMsgs((m) => [...m, { id, q: clean, a: r.a, ia: useIa ? 'cargando' : undefined }]);
    if (remember) save([...load(), clean]);
    setText('');
    if (useIa) {
      const month = r.mem.month ?? 11; const unit = r.mem.unit ?? ctx.current.unit;
      askIa(clean, r.a, unit, month, hist.current)
        .then((texto) => { hist.current = [...hist.current, { q: clean, a: texto }].slice(-4); setMsgs((m) => m.map((x) => (x.id === id && x.a ? { ...x, a: { ...x.a, text: texto }, ia: 'ok' } : x))); })
        .catch(() => setMsgs((m) => m.map((x) => (x.id === id ? { ...x, ia: 'local' } : x))));
    }
  }, []);

  // restaura la conversación de esta sesión volviendo a preguntar (las respuestas se recalculan con los datos actuales)
  useEffect(() => { if (restored.current) return; restored.current = true; load().forEach((q) => ask(q, false)); }, [ask]);
  useEffect(() => {
    const onAsk = (e: Event) => { setOpen(true); const q = (e as CustomEvent<string>).detail; if (q) ask(q); window.setTimeout(() => inputRef.current?.focus(), 80); };
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); } else if (e.key === 'Escape' && open && !document.querySelector('[data-modal]')) setOpen(false); };
    window.addEventListener('solbus-ask', onAsk); window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('solbus-ask', onAsk); window.removeEventListener('keydown', onKey); };
  }, [ask, open]);
  useEffect(() => { if (open) { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: 'smooth' }); } }, [msgs, open]);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 120); }, [open]);

  const run = (a: Action) => {
    if (a.kind === 'ask') return ask(a.q);
    if (a.kind === 'metric') drill.openMetric(a.k, { unit: a.unit, month: a.month });
    else if (a.kind === 'go') drill.go(a.module, { tab: a.tab, unit: a.unit });
    else if (a.kind === 'unit') openUnit(a.interno, { order: a.order });
    else if (a.kind === 'base') drill.openBase(a.base);
    else if (a.kind === 'panel') onPanel(a.panel);
    if (window.innerWidth < 900) setOpen(false);
  };
  const admin = isAdmin(); const ia = iaReady();
  const starters = useMemo(() => (admin && who === 'sistemas' ? STARTERS.sistemas : [...STARTERS.porModulo(module).slice(0, 3), ...STARTERS.gerencia.filter((s) => !STARTERS.porModulo(module).includes(s))].slice(0, 7)), [who, module, admin]);
  const clear = () => { setMsgs([]); mem.current = {}; hist.current = []; save([]); };

  return <>
    <button className={`as-fab ${open ? 'hidden' : ''}`} onClick={() => setOpen(true)} aria-label="Abrir el asistente" title="Asistente del tablero (Ctrl + K)"><Sparkles size={18} /><span>Asistente</span></button>
    <AnimatePresence>{open && <motion.aside className="as-panel" role="dialog" aria-label="Asistente del tablero" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
      <header className="as-head">
        <span className="as-logo"><Bot size={19} /></span>
        <div><strong>Asistente del tablero</strong><small>{admin && <><i className={`as-dot ${SOURCE.modo}`} />{sourceLabel()} · </>}{ia ? 'Con Gemini' : 'Datos del tablero'} · {unit === 'Todos' ? 'Grupo Solbus' : unit}</small></div>
        <button className="icon-button" onClick={clear} title="Borrar la conversación" aria-label="Borrar la conversación" disabled={!msgs.length}><Eraser size={16} /></button>
        <button className="icon-button" onClick={() => setOpen(false)} aria-label="Cerrar el asistente"><X size={17} /></button>
      </header>
      <div className="as-body" ref={boxRef}>
        {!msgs.length && <div className="as-welcome">
          <h3>¿Qué querés saber?</h3>
          <p>Preguntá en tus palabras. Respondo con los mismos datos que muestra el tablero{ia ? ' y Gemini redacta la respuesta' : ''}.</p>
          {admin && <div className="as-who" role="tablist"><button role="tab" aria-selected={who === 'gerencia'} className={who === 'gerencia' ? 'on' : ''} onClick={() => setWho('gerencia')}><Sparkles size={14} /> Gerencia</button><button role="tab" aria-selected={who === 'sistemas'} className={who === 'sistemas' ? 'on' : ''} onClick={() => setWho('sistemas')}><Database size={14} /> Sistemas</button></div>}
          <div className="as-starters">{starters.map((s) => <button key={s} onClick={() => ask(s)}>{s}<ArrowUpRight size={13} /></button>)}</div>
        </div>}
        {msgs.map((m, mi) => <div key={m.id} className="as-turn">
          {m.q && <div className="as-q"><span>{m.q}</span></div>}
          {m.a && <motion.div className="as-a" data-intent={m.a.intent} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {m.ia === 'cargando' ? <p className="as-thinking"><Loader2 size={14} className="spin" /> Redactando con Gemini…</p> : <Rich text={m.a.text} />}
            {m.a.spark && <Spark s={m.a.spark} />}
            {m.a.table && <div className="as-table-wrap"><table className="as-table"><thead><tr>{m.a.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{m.a.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>{m.a.table.note && <small>{m.a.table.note}</small>}</div>}
            {m.a.actions && m.a.actions.length > 0 && <div className="as-actions">{m.a.actions.map((a, i) => <button key={i} onClick={() => run(a)}>{a.label}<ArrowUpRight size={13} /></button>)}</div>}
            {m.ia === 'ok' && <small className="as-badge"><Sparkles size={11} /> Gemini · basado en los datos del tablero</small>}
            {mi === msgs.length - 1 && m.a.next && <div className="as-next">{m.a.next.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}</div>}
          </motion.div>}
        </div>)}
      </div>
      <form className="as-input" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí tu pregunta…" aria-label="Pregunta para el asistente" maxLength={200}
          onKeyDown={(e) => { if (e.key === 'ArrowUp' && !text) { const last = [...msgs].reverse().find((m) => m.q)?.q; if (last) { e.preventDefault(); setText(last); } } }} />
        <button type="submit" disabled={!text.trim()} aria-label="Enviar"><ArrowUp size={17} /></button>
      </form>
    </motion.aside>}</AnimatePresence>
  </>;
}
