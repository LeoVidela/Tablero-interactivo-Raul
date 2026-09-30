import { createContext, useContext } from 'react';

/** Abre la ficha técnica del coche (UnitSheet con la imagen real del bus), opcionalmente en una OT o componente. */
export type OpenUnit = (interno: string, opts?: { order?: string; component?: string }) => void;
export const OpenUnitCtx = createContext<OpenUnit>(() => {});
export const useOpenUnit = () => useContext(OpenUnitCtx);
