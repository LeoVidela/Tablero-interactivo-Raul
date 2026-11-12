/* Prueba del asistente: cada pregunta tiene que caer en la intención esperada y, cuando se indica, el número de la
   respuesta tiene que ser EXACTAMENTE el que calcula el tablero.   npm run test:asistente */
import { answer, type Memory } from '../src/g/asistente/engine';
import { METRICS } from '../src/g/metrics';
import { aggregate, UNIT_NAMES } from '../src/g/data';
import { units, orders, isOpen } from '../src/data/fleet';
import { hrTotals } from '../src/g/rrhh';
import { setAdmin } from '../src/g/admin';

setAdmin(true); // las preguntas de Sistemas se prueban en modo Sistemas; abajo se verifica que Gerencia no las vea

type Case = [q: string, intent: string, includes?: string | string[]];
const d = METRICS; const f = (k: keyof typeof METRICS, u: Parameters<typeof d.aus.get>[0], m = 11) => d[k].fmt(d[k].get(u, m));
const openOT = orders.filter(isOpen); const anyUnit = units[11]; const stopped = units.filter((u) => u.status !== 'Operativo');
const cases: Case[] = [
  // --- gerencia: indicadores
  ['¿Cuánto es el ausentismo?', 'valor', f('aus', 'Todos')],
  ['ausentismo en Comodoro', 'valor', f('aus', 'Comodoro')],
  ['Disponibilidad de flota de San Luis en agosto', 'valor', f('disp', 'San Luis', 10)],
  ['costo por km de villa mercedes', 'valor', f('cost', 'Villa Mercedes')],
  ['cuantos pasajeros transportamos en julio', 'valor', f('pax', 'Todos', 9)],
  ['IPK cordoba', 'valor', f('ipk', 'Córdoba')],
  ['cuántos siniestros hubo en córdoba', 'valor', f('sin', 'Córdoba')],
  ['km ejecutados del trimestre', 'valor'],
  ['litros consumidos en el año', 'valor'],
  ['rendimiento km por litro', 'valor', f('kmpl', 'Todos')],
  ['margen por km', 'valor', f('margin', 'Todos')],
  ['ot cerradas en septiembre comodoro', 'valor', f('otClosed', 'Comodoro')],
  ['días de ART', 'valor', f('artDias', 'Todos')],
  ['altas del mes', 'valor', f('altas', 'Todos')],
  ['gasto total de mantenimiento', 'valor', f('gastoTot', 'Todos')],
  ['cobertura de turnos', 'valor', f('cob', 'Todos')],
  ['excesos de velocidad en san luis', 'valor', f('exc', 'San Luis')],
  // --- comparación, ranking, evolución, definición
  ['Comparar disponibilidad entre Córdoba y Comodoro', 'comparar', [f('disp', 'Córdoba'), f('disp', 'Comodoro')]],
  ['ausentismo por base', 'comparar'],
  ['cumplimiento cordoba vs san luis', 'comparar'],
  ['¿Qué base tiene peor disponibilidad?', 'ranking'],
  ['que base tiene mas siniestros', 'ranking'],
  ['cual es la base con mejor rendimiento', 'ranking'],
  ['Evolución del ausentismo', 'evolucion'],
  ['como viene el costo por km en comodoro', 'evolucion'],
  ['tendencia de pasajeros', 'evolucion'],
  ['¿Qué es el IPK?', 'definicion', 'Pasajeros por kilómetro'],
  ['como se calcula la disponibilidad', 'definicion'],
  // --- panorama
  ['Resumen del mes', 'resumen', f('disp', 'Todos')],
  ['como estamos en comodoro', 'resumen', 'Comodoro'],
  ['¿Qué está fuera de objetivo?', 'alertas'],
  ['hay algún problema en villa mercedes?', 'alertas'],
  ['¿Qué base necesita más atención?', 'peor-base'],
  ['Comodoro', 'resumen'],
  // --- flota y taller
  [`Interno ${anyUnit.interno}`, 'coche', anyUnit.plate],
  [`como está el coche ${stopped[0].interno}`, 'coche', stopped[0].status],
  [anyUnit.interno, 'coche'],
  ['interno 99', 'no-encontrado'],
  [openOT[0].id, 'ot', openOT[0].title],
  ['¿Cuántos coches tiene la flota?', 'flota', String(units.length)],
  ['Coches detenidos en taller', 'detenidos', String(stopped.length)],
  ['que coches están parados en córdoba', 'detenidos'],
  ['coches esperando repuesto', 'detenidos'],
  ['Preventivos vencidos', 'preventivos'],
  ['services pendientes en san luis', 'preventivos'],
  ['OT abiertas', 'ot-abiertas', String(openOT.length)],
  ['Reincidencias del mes', 'reincidencias'],
  ['productividad del taller', 'productividad'],
  ['Raúl Ledesma', 'mecanico'],
  // --- tráfico y líneas
  ['línea 72', 'linea', 'Córdoba'],
  ['Peor línea del mes', 'lineas'],
  ['Tráfico de hoy', 'trafico-hoy'],
  // --- RR.HH. y seguridad
  ['legajo 1001', 'legajo'],
  ['rrhh de comodoro', 'rrhh', String(hrTotals('Comodoro', 11).activos)],
  ['Siniestros del mes', 'siniestros'],
  ['Conductores con más siniestros', 'siniestros-choferes'],
  ['Seguimiento económico de siniestros', 'siniestros-eco'],
  // --- combustible y pañol
  ['Estado de los tanques', 'tanques'],
  ['cuanto gasoil queda en comodoro', 'tanques'],
  ['Artículos bajo el mínimo', 'stock-bajo'],
  ['Valor del stock', 'stock'],
  ['stock de batería 12V', 'articulo'],
  ['Cubiertas a cambiar', 'cubiertas'],
  // --- Sistemas
  ['Estado de la conexión', 'fuentes'],
  ['de donde salen los datos', 'fuentes'],
  ['¿Qué indicadores son reales?', 'cobertura'],
  ['porcentaje de avance', 'cobertura'],
  ['¿Qué falta para sacar los datos demo?', 'faltantes'],
  ['que falta en rrhh', 'faltantes', 'Flitmo'],
  ['¿Cómo conecto la base?', 'conectar'],
  ['¿Qué tablas tiene la base?', 'esquema'],
  ['¿Qué formato tiene el snapshot?', 'contrato'],
  // --- conversación
  ['hola', 'ayuda'], ['¿Qué puedo preguntar?', 'ayuda'], ['gracias', 'cortesia'], ['ir a taller', 'navegar'], ['asdf qwerty', 'no-entendi'],
];
let fail = 0;
for (const [q, intent, inc] of cases) {
  const { a } = answer(q, { unit: 'Todos', module: 'Resumen', mem: {} });
  const blob = a.text + JSON.stringify(a.table ?? '');
  const miss = (Array.isArray(inc) ? inc : inc ? [inc] : []).filter((s) => !blob.includes(s));
  const bad = /NaN|undefined|Infinity|\[object/.test(blob);
  if (a.intent !== intent || miss.length || bad) { fail++; console.log(`✗ «${q}» → ${a.intent} (esperado ${intent})${miss.length ? ` · falta «${miss.join('», «')}»` : ''}${bad ? ' · texto roto' : ''}\n    ${a.text.split('\n')[0].slice(0, 160)}`); }
}
// seguimiento con memoria: «¿y en Comodoro?», «¿y el mes pasado?»
let mem: Memory = {};
const chain: [string, string, string][] = [['ausentismo', 'valor', f('aus', 'Todos')], ['¿y en Comodoro?', 'valor', f('aus', 'Comodoro')], ['¿y el mes pasado?', 'valor', f('aus', 'Comodoro', 10)], ['y en san luis', 'valor', f('aus', 'San Luis', 10)]];
for (const [q, intent, inc] of chain) { const r = answer(q, { unit: 'Todos', module: 'Resumen', mem }); mem = r.mem; if (r.a.intent !== intent || !r.a.text.includes(inc)) { fail++; console.log(`✗ cadena «${q}» → ${r.a.intent} · esperaba ${inc}\n    ${r.a.text.split('\n')[0].slice(0, 160)}`); } }
// la unidad activa del tablero se respeta cuando la pregunta no nombra ninguna
const r2 = answer('disponibilidad', { unit: 'San Luis', module: 'Flota', mem: {} }); if (!r2.a.text.includes(f('disp', 'San Luis'))) { fail++; console.log('✗ no respetó la unidad activa'); }
// coherencia con el agregado del tablero
if (Math.abs(d.cumpl.get('Todos', 11) - aggregate('Todos', [11]).cumpl) > 1e-9 || UNIT_NAMES.length !== 4) { fail++; console.log('✗ el catálogo no coincide con el agregado'); }
// en modo Gerencia las preguntas técnicas no muestran conexión, fuentes ni faltantes
setAdmin(false);
const priv = ['Estado de la conexión', '¿Qué falta para sacar los datos demo?', '¿Cómo conecto la base?', '¿Qué tablas tiene la base?', 'porcentaje de avance', 'supabase'];
for (const q of priv) { const r = answer(q, { unit: 'Todos', module: 'Resumen', mem: {} }); if (r.a.intent !== 'reservado') { fail++; console.log(`✗ Gerencia ve «${q}» → ${r.a.intent}`); } }
for (const q of ['ausentismo', 'hola']) { const t = answer(q, { unit: 'Todos', module: 'Resumen', mem: {} }).a.text; if (/demostraci|Sistemas|fuente|conexi/i.test(t)) { fail++; console.log(`✗ Gerencia ve datos internos en «${q}»: ${t.slice(0, 120)}`); } }
console.log(`${cases.length + chain.length + 2 + priv.length + 2} pruebas · ${fail} fallas`);
process.exit(fail ? 1 : 0);
