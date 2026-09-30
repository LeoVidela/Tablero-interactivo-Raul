/** Exporta lo que se ve en pantalla (indicadores + todas las tablas) a un CSV que abre directo en Excel. */
export function exportView(name: string): number {
  const root = document.querySelector('.main-content') ?? document.body;
  const esc = (s: string) => `"${s.replace(/\s+/g, ' ').trim().replace(/"/g, '""')}"`;
  const lines: string[] = [esc(`Tablero Solbus · ${name}`), esc(`Exportado ${new Date().toLocaleString('es-AR')}`), ''];
  const tiles = [...root.querySelectorAll('.t-tile, .g-kpi, .metric-card, .bd-kpis button')];
  if (tiles.length) {
    lines.push(esc('Indicadores'));
    tiles.forEach((t) => {
      const label = t.querySelector('.t-tile-label, .g-kpi-label, .metric-label, span')?.textContent ?? '';
      const value = t.querySelector('.t-tile-value strong, .g-kpi-value strong, strong')?.textContent ?? '';
      if (label || value) lines.push([esc(label), esc(value)].join(';'));
    });
    lines.push('');
  }
  const tables = [...root.querySelectorAll('table')];
  tables.forEach((tb) => {
    const title = tb.closest('.panel, .g-panel, section')?.querySelector('h3, h2')?.textContent ?? 'Tabla';
    lines.push(esc(title));
    tb.querySelectorAll('tr').forEach((tr) => lines.push([...tr.querySelectorAll('th, td')].map((c) => esc(c.textContent ?? '')).join(';')));
    lines.push('');
  });
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `solbus_${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return tables.length;
}
