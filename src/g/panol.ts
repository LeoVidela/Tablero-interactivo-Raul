// Pañol por base (demo): artículos clasificados como en el sistema de pañol actual, stock valorizado
// y registro de cubiertas (número de fuego, ubicación en coche/posición o en pañol, mediciones de dibujo,
// proyecciones de cambio y de compra). Al conectarlo se reemplaza por el maestro de artículos y sus fotos.
import { UNIT_NAMES, UnitFilter, UnitName, hashStr, mulberry32, unitsOf } from './data';
import { BUSES, Bus, dstr } from './taller';

export const HOY = new Date(2026, 9, 1, 12);
const DAY = 86400000;

// ---------- categorías del sistema de pañol ----------
export const CATS = ['Repuesto', 'Repuesto eléctrico', 'Herramienta', 'Inventario', 'Higiene y seguridad', 'Chapa y pintura', 'Lubricantes', 'Ferretería y bulonería', 'Neumáticos nuevos', 'Neumáticos precurados', 'Cristales', 'Gomería', 'Consumibles'] as const;
export type Cat = (typeof CATS)[number];
export const CAT_COLOR: Record<Cat, string> = {
  'Repuesto': '#f97316', 'Repuesto eléctrico': '#3b82f6', 'Herramienta': '#64748b', 'Inventario': '#8b5cf6', 'Higiene y seguridad': '#14b8a6', 'Chapa y pintura': '#ec4899', 'Lubricantes': '#eab308',
  'Ferretería y bulonería': '#94a3b8', 'Neumáticos nuevos': '#22c55e', 'Neumáticos precurados': '#84cc16', 'Cristales': '#22d3ee', 'Gomería': '#a3a3a3', 'Consumibles': '#f43f5e',
};
// [nombre, unidad, precio $]
const TPL: Record<Cat, [string, string, number][]> = {
  'Repuesto': [['Pastilla de freno delantera MB O500', 'juego', 186000], ['Disco de freno trasero MB', 'u', 312000], ['Filtro de aceite motor OM 926', 'u', 38500], ['Filtro de gasoil primario', 'u', 29800], ['Filtro de aire principal', 'u', 74200], ['Correa poly-V alternador', 'u', 46500], ['Kit embrague MB O500 U', 'kit', 1480000], ['Amortiguador delantero', 'u', 268000], ['Pulmón de suspensión trasero', 'u', 214000], ['Bomba de agua OM 926', 'u', 392000], ['Cruceta cardán', 'u', 88600], ['Buje de barra estabilizadora', 'u', 21400]],
  'Repuesto eléctrico': [['Alternador 28V 150A', 'u', 845000], ['Motor de arranque 24V', 'u', 920000], ['Batería 12V 180Ah', 'u', 486000], ['Lámpara H7 24V', 'u', 6800], ['Faro trasero LED', 'u', 98000], ['Relé 24V 5 patas', 'u', 9400], ['Sensor ABS rueda', 'u', 118000], ['Cableado validador SUBE', 'u', 64000]],
  'Herramienta': [['Llave de impacto 1"', 'u', 1290000], ['Torquímetro 1/2" 40-200 Nm', 'u', 268000], ['Gato hidráulico 20 t', 'u', 455000], ['Juego de tubos 1/2"', 'juego', 186000], ['Multímetro automotor', 'u', 94000], ['Profundímetro digital de neumáticos', 'u', 38000]],
  'Inventario': [['Matafuego ABC 5 kg', 'u', 72000], ['Botiquín reglamentario', 'u', 31000], ['Cuña de seguridad', 'u', 18500], ['Validador SUBE (reserva)', 'u', 1650000], ['Pantalla de destino LED', 'u', 2140000]],
  'Higiene y seguridad': [['Guantes de nitrilo (caja x100)', 'caja', 14800], ['Anteojos de seguridad', 'u', 6200], ['Botín de seguridad', 'par', 96000], ['Protector auditivo', 'u', 8900], ['Lavandina 5 L', 'bidón', 6900], ['Desengrasante industrial 20 L', 'bidón', 58000], ['Paño microfibra', 'u', 2400], ['Detergente concentrado 5 L', 'bidón', 11800], ['Bolsas de residuo 90x120', 'rollo', 8600]],
  'Chapa y pintura': [['Pintura poliuretánica naranja Solbus 4 L', 'lata', 168000], ['Masilla poliéster 3 kg', 'u', 26500], ['Lija al agua 400', 'pliego', 1300], ['Thinner 4 L', 'lata', 18200], ['Panel lateral inferior', 'u', 238000], ['Paragolpes delantero', 'u', 690000]],
  'Lubricantes': [['Aceite motor 15W40 tambor 205 L', 'tambor', 1850000], ['Aceite de caja 75W90 20 L', 'balde', 238000], ['Grasa de chasis 15 kg', 'balde', 92000], ['Refrigerante 20 L', 'bidón', 64000], ['Líquido de frenos DOT4 1 L', 'u', 11900], ['Aceite hidráulico dirección 20 L', 'balde', 168000]],
  'Ferretería y bulonería': [['Bulón de rueda M22', 'u', 9800], ['Tuerca de rueda M22', 'u', 4200], ['Abrazadera sinfín 60 mm', 'u', 1900], ['Precinto 300 mm (bolsa x100)', 'bolsa', 6400], ['Tornillo autoperforante (caja)', 'caja', 9800], ['Arandela grower 16 mm', 'u', 350]],
  'Neumáticos nuevos': [['Cubierta 295/80 R22.5 nueva', 'u', 845000], ['Cubierta 275/80 R22.5 nueva', 'u', 768000]],
  'Neumáticos precurados': [['Cubierta 295/80 R22.5 precurada', 'u', 398000], ['Cubierta 275/80 R22.5 precurada', 'u', 362000]],
  'Cristales': [['Parabrisas MB O500 (izq.)', 'u', 1240000], ['Parabrisas MB O500 (der.)', 'u', 1240000], ['Ventanilla lateral corrediza', 'u', 286000], ['Luneta trasera', 'u', 612000], ['Espejo retrovisor exterior', 'u', 148000]],
  'Gomería': [['Válvula para neumático', 'u', 3800], ['Parche radial', 'u', 12400], ['Cámara de vulcanizado', 'u', 26000], ['Manómetro de presión', 'u', 42000], ['Balanceo: pesas (caja)', 'caja', 18600]],
  'Consumibles': [['Disco de corte 115 mm', 'u', 2100], ['Electrodo 2,5 mm (kg)', 'kg', 11500], ['Cinta aisladora', 'u', 1600], ['Trapo industrial (kg)', 'kg', 3900], ['Siliconas en pomo', 'u', 7800], ['Aerosol afloja-todo', 'u', 6400]],
};

export interface Art { codigo: string; cat: Cat; nombre: string; unidad: string; precio: number; min: Record<UnitName, number>; stock: Record<UnitName, number>; ubic: Record<UnitName, string>; consumo: number[]; ultMov: string; foto?: string }
const RACK = (r: () => number) => `${String.fromCharCode(65 + Math.floor(r() * 8))}-${1 + Math.floor(r() * 12)}-${1 + Math.floor(r() * 5)}`;
const SIZE: Record<UnitName, number> = { 'Córdoba': 1.6, Comodoro: 1, 'San Luis': 0.75, 'Villa Mercedes': 0.65 };

// ---------- cubiertas ----------
export const POS = ['DI', 'DD', 'TIE', 'TII', 'TDI', 'TDE'] as const;
export type Pos = (typeof POS)[number];
export const POS_LABEL: Record<Pos, string> = { DI: 'Delantera izquierda', DD: 'Delantera derecha', TIE: 'Trasera izquierda exterior', TII: 'Trasera izquierda interior', TDI: 'Trasera derecha interior', TDE: 'Trasera derecha exterior' };
export const POS_SHORT: Record<Pos, string> = { DI: 'Del. izq.', DD: 'Del. der.', TIE: 'Tras. izq. ext.', TII: 'Tras. izq. int.', TDI: 'Tras. der. int.', TDE: 'Tras. der. ext.' };
/** Ubicación de cada rueda sobre la imagen del chasis (% del ancho/alto). */
export const POS_XY: Record<Pos, { x: number; y: number; w: number; h: number }> = {
  DI: { x: 25.2, y: 22.8, w: 11.5, h: 19.5 }, DD: { x: 73.8, y: 22.8, w: 11.5, h: 19.5 },
  TIE: { x: 22.6, y: 64.2, w: 8.6, h: 19.5 }, TII: { x: 31.6, y: 64.2, w: 8.6, h: 19.5 }, TDI: { x: 66.0, y: 64.2, w: 8.6, h: 19.5 }, TDE: { x: 74.6, y: 64.2, w: 8.6, h: 19.5 },
};
export const MARCAS = ['Michelin X Multi Z', 'Bridgestone R268', 'Pirelli MC:01', 'Fate DR-450', 'Firestone FS400'];
export const LIMITE: Record<'del' | 'tras', number> = { del: 5, tras: 3 }; // mm mínimos de política de la empresa
export const PSI_OBJ = 120;
export type TireTipo = 'Nueva' | 'Precurada';
export type TireEstado = 'Montada' | 'En stock' | 'En recapado' | 'Descarte';
export interface Medicion { fecha: string; t: number; km: number; mm: number; psi: number }
export interface Mov { fecha: string; detalle: string }
export interface Tire {
  serie: string; marca: string; medida: string; tipo: TireTipo; vida: number; unit: UnitName; estado: TireEstado;
  bus?: Bus; pos?: Pos; ubic: string; inicial: number; mm: number; psi: number; kmMont: number; kmTotal: number; montada?: string;
  tasa: number; // mm cada 10.000 km
  limite: number; diasCambio: number | null; fechaCambio: string | null; med: Medicion[]; movs: Mov[]; precio: number;
}
const KM_DIA: Record<UnitName, number> = { 'Córdoba': 215, Comodoro: 190, 'San Luis': 175, 'Villa Mercedes': 160 };
export const kmDia = (u: UnitName) => KM_DIA[u];
const medidaOf = (b: Bus) => (b.modelo.includes('1621') || b.modelo.includes('Agrale') ? '275/80 R22.5' : '295/80 R22.5');
export const tirePrice = (medida: string, tipo: TireTipo) => (tipo === 'Nueva' ? (medida.startsWith('295') ? 845000 : 768000) : medida.startsWith('295') ? 398000 : 362000);

function buildTires(): Tire[] {
  const out: Tire[] = []; let n = 10000;
  const mk = (r: () => number, unit: UnitName, medida: string, tipo: TireTipo, front: boolean, estado: TireEstado, bus?: Bus, pos?: Pos): Tire => {
    const serie = `F-${++n}`; const marca = MARCAS[Math.floor(r() * (tipo === 'Nueva' ? 3 : 5))];
    const vida = tipo === 'Nueva' ? 0 : 1 + (r() < 0.3 ? 1 : 0);
    const inicial = tipo === 'Nueva' ? 16 : 14;
    const tasa = (front ? 1.15 : 0.95) * (0.8 + r() * 0.45) * (tipo === 'Precurada' ? 1.08 : 1);
    const limite = front ? LIMITE.del : LIMITE.tras;
    let kmMont = 0; let mm = inicial; let montada: string | undefined; const med: Medicion[] = []; const movs: Mov[] = [];
    const kd = KM_DIA[unit];
    const compra = new Date(HOY.getTime() - (200 + r() * 700) * DAY);
    movs.push({ fecha: dstr(compra), detalle: tipo === 'Nueva' ? `Ingreso al pañol de ${unit} · compra` : `Ingreso de recapado (vida ${vida}) · pañol ${unit}` });
    if (estado === 'Montada' && bus && pos) {
      const maxKm = ((inicial - limite) / tasa) * 10000;
      kmMont = Math.round(maxKm * (0.05 + r() * 0.97));
      const dias = Math.round(kmMont / kd);
      const mDate = new Date(HOY.getTime() - dias * DAY); montada = dstr(mDate);
      movs.push({ fecha: montada, detalle: `Montada en interno ${bus.interno} · ${POS_LABEL[pos]}` });
      if (dias > 120 && !front && r() < 0.5) movs.push({ fecha: dstr(new Date(mDate.getTime() + dias * 0.5 * DAY)), detalle: `Rotación en interno ${bus.interno} (cambio de lado)` });
      // mediciones cada ~15 días durante los últimos 6 meses (o desde el montaje)
      for (let d = Math.min(dias, 180); d >= 0; d -= 14 + Math.floor(r() * 4)) {
        const km = Math.round((dias - d) * kd); const depth = Math.max(0.5, inicial - (tasa * km) / 10000 + (r() - 0.5) * 0.35);
        med.push({ fecha: dstr(new Date(HOY.getTime() - d * DAY)), t: HOY.getTime() - d * DAY, km, mm: +depth.toFixed(1), psi: Math.round(PSI_OBJ - 8 + r() * 14) });
      }
      mm = med.length ? med[med.length - 1].mm : inicial - (tasa * kmMont) / 10000;
    }
    const psi = med.length ? med[med.length - 1].psi : PSI_OBJ;
    const rest = (mm - limite) / ((tasa * kd) / 10000);
    const diasCambio = estado === 'Montada' ? Math.max(0, Math.round(rest)) : null;
    if (estado === 'En recapado') movs.push({ fecha: dstr(new Date(HOY.getTime() - (5 + r() * 25) * DAY)), detalle: 'Enviada a recapar (casco apto)' });
    if (estado === 'Descarte') movs.push({ fecha: dstr(new Date(HOY.getTime() - (5 + r() * 120) * DAY)), detalle: 'Baja por desgaste / casco no apto' });
    const kmPrev = vida * (80000 + r() * 40000);
    return {
      serie, marca, medida, tipo, vida, unit, estado, bus, pos, inicial, mm: +mm.toFixed(1), psi, kmMont, kmTotal: Math.round(kmPrev + kmMont), montada, tasa: +tasa.toFixed(2), limite,
      diasCambio, fechaCambio: diasCambio === null ? null : dstr(new Date(HOY.getTime() + diasCambio * DAY)), med, movs: movs.reverse(), precio: tirePrice(medida, tipo),
      ubic: estado === 'Montada' ? `Interno ${bus!.interno} · ${POS_SHORT[pos!]}` : estado === 'En stock' ? `Pañol ${unit} · rack cubiertas ${String.fromCharCode(65 + Math.floor(r() * 4))}-${1 + Math.floor(r() * 10)}` : estado === 'En recapado' ? 'Recapadora (proveedor externo)' : 'Depósito de descarte',
    };
  };
  for (const b of BUSES) {
    const r = mulberry32(hashStr(`tire-${b.id}`)); const medida = medidaOf(b);
    for (const p of POS) { const front = p === 'DI' || p === 'DD'; out.push(mk(r, b.unit, medida, front || r() < 0.45 ? 'Nueva' : 'Precurada', front, 'Montada', b, p)); }
  }
  for (const u of UNIT_NAMES) {
    const r = mulberry32(hashStr(`tire-stock-${u}`)); const nb = BUSES.filter((b) => b.unit === u).length;
    const add = (k: number, tipo: TireTipo, estado: TireEstado) => { for (let i = 0; i < k; i++) out.push(mk(r, u, r() < 0.75 ? '295/80 R22.5' : '275/80 R22.5', tipo, false, estado)); };
    add(Math.round(nb * 0.12 + r() * 3), 'Nueva', 'En stock'); add(Math.round(nb * 0.1 + r() * 3), 'Precurada', 'En stock');
    add(Math.round(nb * 0.06 + 1), 'Precurada', 'En recapado'); add(Math.round(nb * 0.08 + 2), 'Precurada', 'Descarte');
  }
  return out;
}
export const TIRES: Tire[] = buildTires();
export const tiresOf = (f: UnitFilter) => TIRES.filter((t) => unitsOf(f).includes(t.unit));
export const busTires = (busId: string) => TIRES.filter((t) => t.bus?.id === busId);
export const tireColor = (t: Tire) => (t.estado !== 'Montada' ? '#94a3b8' : t.mm - t.limite <= 1.5 ? '#ef4444' : t.mm - t.limite <= 4 ? '#f59e0b' : '#22c55e');

// ---------- artículos (stock de neumáticos sale del registro de cubiertas) ----------
function buildArts(): Art[] {
  const out: Art[] = []; let k = 0;
  for (const cat of CATS) for (const [nombre, unidad, precio] of TPL[cat]) {
    const r = mulberry32(hashStr(`art-${nombre}`)); k++;
    const cheap = precio < 20000; const big = precio > 700000;
    const stock = {} as Record<UnitName, number>; const min = {} as Record<UnitName, number>; const ubic = {} as Record<UnitName, string>;
    for (const u of UNIT_NAMES) {
      const base = (cheap ? 40 + r() * 160 : big ? 1 + r() * 4 : 4 + r() * 22) * SIZE[u];
      min[u] = Math.max(1, Math.round(base * 0.45)); stock[u] = Math.max(0, Math.round(base * (r() < 0.14 ? 0.25 : 0.6 + r() * 0.9)));
      ubic[u] = cat.startsWith('Neumáticos') ? 'Rack de cubiertas' : RACK(r);
    }
    if (cat.startsWith('Neumáticos')) {
      const tipo: TireTipo = cat === 'Neumáticos nuevos' ? 'Nueva' : 'Precurada'; const medida = nombre.includes('295') ? '295/80' : '275/80';
      for (const u of UNIT_NAMES) { stock[u] = TIRES.filter((t) => t.unit === u && t.estado === 'En stock' && t.tipo === tipo && t.medida.startsWith(medida)).length; min[u] = Math.max(2, Math.round(BUSES.filter((b) => b.unit === u).length * (medida === '295/80' ? 0.07 : 0.025))); }
    }
    const cons = Array.from({ length: 12 }, () => Math.round((cheap ? 20 + r() * 80 : big ? r() * 2.2 : 2 + r() * 12) * (cat.startsWith('Neumáticos') ? 6 : 1)));
    out.push({ codigo: `${cat.slice(0, 3).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}-${String(k).padStart(4, '0')}`, cat, nombre, unidad, precio, min, stock, ubic, consumo: cons, ultMov: dstr(new Date(HOY.getTime() - Math.floor(r() * 40) * DAY)) });
  }
  return out;
}
export const ARTS: Art[] = buildArts();
export const stockOf = (a: Art, f: UnitFilter) => unitsOf(f).reduce((s, u) => s + a.stock[u], 0);
export const minOf = (a: Art, f: UnitFilter) => unitsOf(f).reduce((s, u) => s + a.min[u], 0);
export const valorOf = (a: Art, f: UnitFilter) => stockOf(a, f) * a.precio;
export const bajoMin = (a: Art, f: UnitFilter) => stockOf(a, f) < minOf(a, f);
/** Meses de cobertura: stock / consumo mensual promedio. */
export const cobertura = (a: Art, f: UnitFilter) => { const c = (a.consumo.reduce((s, x) => s + x, 0) / 12) * (f === 'Todos' ? 1 : SIZE[f as UnitName] / 4); return c ? stockOf(a, f) / c : 99; };

// ---------- proyecciones de cubiertas ----------
export const MESES_PROY = 6;
export function proyeccion(f: UnitFilter) {
  const ts = tiresOf(f); const now = HOY;
  const months = Array.from({ length: MESES_PROY }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); return { i, label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }).replace('.', ''), nuevas: 0, precuradas: 0, recap: 0 }; });
  for (const t of ts) {
    if (t.estado !== 'Montada' || t.diasCambio === null) continue;
    const d = new Date(now.getTime() + t.diasCambio * DAY); const i = (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
    if (i < 0 || i >= MESES_PROY) continue;
    const front = t.pos === 'DI' || t.pos === 'DD';
    if (front) months[i].nuevas++; else months[i].precuradas++;
    if (t.vida < 2) months[i].recap++; // el casco vuelve como precurada
  }
  let stockN = ts.filter((t) => t.estado === 'En stock' && t.tipo === 'Nueva').length;
  let stockP = ts.filter((t) => t.estado === 'En stock' && t.tipo === 'Precurada').length + ts.filter((t) => t.estado === 'En recapado').length;
  const pN = 845000; const pP = 398000;
  return months.map((m) => {
    const usaN = Math.min(stockN, m.nuevas); stockN -= usaN; const compN = m.nuevas - usaN;
    const usaP = Math.min(stockP, m.precuradas); stockP -= usaP; const compP = m.precuradas - usaP;
    stockP += Math.round(m.recap * 0.85); // cascos recapados que vuelven el mes siguiente (aprox.)
    return { ...m, compN, compP, stockN, stockP, costo: compN * pN + compP * pP };
  });
}
