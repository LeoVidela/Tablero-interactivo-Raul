/* Ventana de 12 meses que muestra el tablero.
   En demo termina en septiembre de 2026. Con una fuente conectada termina en «meta.hasta» del snapshot,
   así el tablero avanza solo cuando cierra un mes (sin tocar código). */
import { SNAP } from './source';

const m = /^(\d{4})-(\d{2})$/.exec(SNAP?.meta?.hasta ?? '');
export const END_Y = m ? Number(m[1]) : 2026;
/** mes final de la ventana, 0 = enero */
export const END_M = m ? Math.min(11, Math.max(0, Number(m[2]) - 1)) : 8;

const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Primer día del mes i de la ventana (0 = hace 11 meses … 11 = último mes cerrado). */
export const monthStart = (i: number) => new Date(END_Y, END_M - 11 + i, 1);
export const monthEndDate = (i: number) => new Date(END_Y, END_M - 11 + i + 1, 0, 23, 59, 59);
export const monthDate = (i: number, day: number) => new Date(END_Y, END_M - 11 + i, day);
export const daysInMonth = (i: number) => monthEndDate(i).getDate();
/** Índice en la ventana de una fecha (puede quedar fuera de 0…11). */
export const monthIdx = (d: Date) => (d.getFullYear() - END_Y) * 12 + d.getMonth() - END_M + 11;
export const ymOf = (i: number) => { const d = monthStart(i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
/** Índice en la ventana de un 'AAAA-MM' (o -1 si no es válido). */
export const idxOfYm = (ym: string) => { const x = /^(\d{4})-(\d{2})/.exec(ym); return x ? (Number(x[1]) - END_Y) * 12 + Number(x[2]) - 1 - END_M + 11 : -1; };

export const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => MES[monthStart(i).getMonth()]);
export const MONTH_FULL = Array.from({ length: 12 }, (_, i) => { const d = monthStart(i); return `${MES_L[d.getMonth()]} ${d.getFullYear()}`; });
export const monthYear = (i: number) => monthStart(i).getFullYear();
/** Fecha de corte: último día del último mes de la ventana, a las 9:00. */
export const CORTE = new Date(END_Y, END_M + 1, 0, 9, 0, 0, 0);
export const corteTxt = `${String(CORTE.getDate()).padStart(2, '0')}/${String(CORTE.getMonth() + 1).padStart(2, '0')}/${CORTE.getFullYear()}`;
