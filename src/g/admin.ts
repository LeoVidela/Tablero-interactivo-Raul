/* Modo Sistemas: muestra el estado de la conexión, qué datos son reales o de demostración, el panel «Fuente de datos»
   y las preguntas técnicas del asistente. Gerencia no lo ve.
   Se activa una vez por equipo entrando con ?sistemas=1 en la dirección (y se desactiva con ?sistemas=0).
   Es para ordenar la vista, no un control de acceso: lo que protege los datos son los permisos de la base. */
const KEY = 'solbus-sistemas';
let admin = (() => {
  try {
    const p = new URLSearchParams(globalThis.location?.search ?? '').get('sistemas');
    if (p === '1') globalThis.localStorage?.setItem(KEY, '1');
    else if (p === '0') globalThis.localStorage?.removeItem(KEY);
    return globalThis.localStorage?.getItem(KEY) === '1';
  } catch { return false; }
})();
export const isAdmin = () => admin;
/** Solo para pruebas. */
export const setAdmin = (v: boolean) => { admin = v; };
