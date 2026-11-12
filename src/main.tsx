import React from 'react';
import { createRoot } from 'react-dom/client';
import { loadSource } from './data/source';
import './fonts.css';
import './styles.css';
import './taller.css';
import './theme-light.css';

// Tema guardado (claro / oscuro); por defecto oscuro. Se aplica antes de dibujar para evitar parpadeos.
try { document.documentElement.dataset.theme = localStorage.getItem('solbus-theme') === 'light' ? 'light' : 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }

// Primero se resuelve la fuente de datos (demo, archivo JSON o base Supabase) y recién después se cargan los módulos,
// porque cada módulo arma sus indicadores al importarse con lo que haya en el snapshot.
const root = createRoot(document.getElementById('root')!);
root.render(<div className="boot"><div className="boot-ring" /><span>Cargando el tablero…</span></div>);
loadSource().finally(() => import('./App').then(({ App }) => root.render(<React.StrictMode><App /></React.StrictMode>)));
