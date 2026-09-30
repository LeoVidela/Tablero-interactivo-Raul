export const fmt = (value: number, digits = 0) => value.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const money = (value: number) => `$ ${fmt(Math.round(value))}`;
export const moneyShort = (value: number) => value >= 1e6 ? `$ ${fmt(value / 1e6, 1)} M` : value >= 1e3 ? `$ ${fmt(value / 1e3, 0)} mil` : money(value);
export const pct = (value: number, digits = 1) => `${fmt(value, digits)}%`;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
export const date = (d: Date) => `${dm(d)} ${d.getFullYear()}`;
export const dateTime = (d: Date) => `${dm(d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} h`;
export const ago = (d: Date, ref = new Date()) => {
  const h = (ref.getTime() - d.getTime()) / 3_600_000;
  if (h < 1) return 'hace minutos';
  if (h < 24) return `hace ${Math.round(h)} h`;
  const days = Math.round(h / 24);
  if (days < 45) return `hace ${days} día${days === 1 ? '' : 's'}`;
  return `hace ${Math.round(days / 30)} meses`;
};
