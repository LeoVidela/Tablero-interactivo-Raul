import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import './taller.css';
import './theme-light.css';

// Tema guardado (claro / oscuro); por defecto oscuro. Se aplica antes de dibujar para evitar parpadeos.
try { document.documentElement.dataset.theme = localStorage.getItem('solbus-theme') === 'light' ? 'light' : 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
