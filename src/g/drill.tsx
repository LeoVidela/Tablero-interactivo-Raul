import { createContext, useContext } from 'react';
import type { UnitFilter, UnitName } from './data';
import type { MetricKey, Target } from './metrics';

/** Navegación profunda compartida por todas las vistas: detalle de indicador, ficha de base y saltos a módulo/pestaña. */
export interface Drill {
  openMetric: (key: MetricKey, opts?: { unit?: UnitFilter; month?: number }) => void;
  openBase: (base: UnitName) => void;
  go: (target: Target, opts?: { tab?: string; unit?: UnitFilter }) => void;
}
export const DrillCtx = createContext<Drill>({ openMetric: () => {}, openBase: () => {}, go: () => {} });
export const useDrill = () => useContext(DrillCtx);
