export type Module = 'Resumen' | 'Tráfico' | 'Flota' | 'Taller' | 'RRHH' | 'Combustible' | 'Seguridad';

export type Base = {
  name: string; code: string; city: string; color: string;
  services: number; fleet: number; punctuality: number; absenteeism: number; passengers: number; alerts: number;
  vehicles: number; activeVehicles: number; workshop: number;
};

export type RecordItem = { id: string; base: string; title: string; detail: string; status: 'Operativo' | 'Atención' | 'Crítico'; time: string; unit?: string; ot?: string };

export type SystemGroup = 'Motor y transmisión' | 'Tren rodante' | 'Frenos y neumática' | 'Eléctrico' | 'Carrocería e interior' | 'Confort y seguridad';

export type BusView = 'corte' | 'chasis';

export type BusComponent = {
  id: string;
  name: string;
  system: SystemGroup;
  /** Posición del punto en % sobre cada vista (x, y). Si falta, el componente no se ve en esa vista. */
  spots: Partial<Record<BusView, [number, number]>>;
};

export type Material = { code: string; name: string; unit: 'u' | 'lts' | 'kg' | 'm' | 'jgo' | 'kit'; price: number; component: string };

export type MaterialLine = { code: string; name: string; unit: Material['unit']; qty: number; price: number; origin: 'Pañol' | 'Compra directa' | 'Recuperado' };

export type OTType = 'Correctivo' | 'Preventivo 20K' | 'Service 30K' | 'Auxilio en calle' | 'Siniestro';
export type OTStatus = 'Abierta' | 'En curso' | 'Esperando repuesto' | 'Cerrada';

export type WorkOrder = {
  id: string;
  unit: string;
  base: string;
  type: OTType;
  status: OTStatus;
  priority: 'Alta' | 'Media' | 'Baja';
  opened: Date;
  closed?: Date;
  km: number;
  origin: string;
  components: string[];
  title: string;
  diagnosis: string;
  mechanic: string;
  hours: number;
  materials: MaterialLine[];
};

export type UnitStatus = 'Operativo' | 'En taller' | 'Esperando repuesto' | 'Fuera de servicio';

export type Unit = {
  interno: string;
  base: string;
  plate: string;
  chassis: string;
  body: string;
  year: number;
  km: number;
  lastServiceKm: number;
  lastPreventiveKm: number;
  line: string;
  status: UnitStatus;
  orders: WorkOrder[];
};
