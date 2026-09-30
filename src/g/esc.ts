import { RefObject, useEffect } from 'react';

/** ¿Es este el panel/modal de más arriba? (mayor z-index; a igualdad, el último en el DOM) */
export function isTopModal(el: Element | null): boolean {
  if (!el) return false;
  const all = [...document.querySelectorAll('[data-modal]')];
  if (!all.length) return true;
  const z = (e: Element) => Number(getComputedStyle(e).zIndex) || 0;
  let top = all[0];
  for (const e of all) if (z(e) >= z(top)) top = e;
  return top === el;
}
/** Esc cierra sólo el panel superior (no todos los que estén abiertos debajo). */
export function useTopEscape(ref: RefObject<Element>, onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && isTopModal(ref.current)) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [ref, onClose]);
}
