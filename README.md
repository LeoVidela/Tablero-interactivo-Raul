# Dashboard Solbus

Dashboard corporativo multisede para transporte urbano con datos demo de Córdoba, Comodoro, San Luis y Villa Mercedes.

## Ejecutar en Windows PowerShell

```powershell
cd "$HOME\Documents\dashboard-transporte"
npm install
npm run dev
```

Abrir `http://localhost:5173`.

## Funcionalidad demo

### Taller (nuevo)

- Mapa de intervenciones de la flota sobre la imagen del bus Solbus: cada zona del coche muestra cuántas veces se intervino en el período y cuánto costaron los materiales. Se puede ver en corte lateral o como chasis y despiece.
- Ranking de componentes más intervenidos, OT por mes (preventivo/service, correctivo, auxilio/siniestro) y costo de materiales por base.
- Tablero de coches detenidos: ingresadas, en reparación y esperando repuesto.
- Registro de órdenes de trabajo filtrable por tipo, componente y búsqueda, y ranking de materiales de pañol.

### Ficha técnica por coche

- Se abre desde Taller, Flota o las alertas del resumen.
- El bus es la imagen central: al elegir una OT se marcan en el bus las piezas o áreas intervenidas; al tocar una zona se ve el historial de esa pieza y los materiales usados en ella.
- Detalle de cada OT con diagnóstico, mecánico, horas hombre, km al ingreso y materiales consumidos (código de pañol, cantidad, precio e importe).
- Plan de mantenimiento: service cada 30.000 km y preventivo cada 20.000 km, con avisos de vencido.

### Flota

- Grilla de internos por base (Córdoba 501–581, Comodoro 1001–1024, San Luis 2001–2032, Villa Mercedes 3001–3026) con estado por letra y color.

### General

- Logo Solbus integrado en `public/solbus-logo.svg`.
- Módulos navegables: Resumen, Tráfico, Flota, Taller, RRHH, Combustible y Seguridad.
- Filtro por base y búsqueda global.
- Selector de período.
- KPI clickeables que llevan al módulo relacionado.
- Bases operativas clickeables con drawer de detalle.
- KPI del drawer navegables hacia módulos.
- Registros operativos clickeables con detalle.
- Alertas, notificaciones, exportación simulada y mensajes de feedback.
- Responsive para escritorio, tablet y móvil.

Los datos son ficticios y se generan de forma determinística en `src/data/` (`fleet.ts` para unidades y OT, `catalog.ts` para componentes del bus, ubicación de cada zona sobre las imágenes y catálogo de pañol). En la siguiente etapa se pueden reemplazar por endpoints de una API y autenticación por roles.
