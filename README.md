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

## Pedidos de Gerencia integrados sobre esta base (30/09/2026)

Todo se construyó **encima** del tablero con la imagen real del bus: la ficha técnica (`UnitSheet`) es el destino de cualquier profundización.

- **Selector de unidad de negocio** Todos / Córdoba / Comodoro / San Luis / Villa Mercedes, aplicado a todos los módulos.
- **Resumen → Tablero de control integral** (`src/g/views/Gerencia.tsx`): 6 grupos de KPI con semáforo y variación, gráficos, indicadores por línea (70-76, A-D, 10-16, 21-23) y 5 alertas gerenciales con acceso al módulo.
- **Taller**: la vista original queda como pestaña *Taller en vivo* y se suman las pestañas de Gerencia: Resumen general, **Mantenimiento de flota** (plan preventivo/service, pendientes, correctivos realizados, producción por mecánico), Preventivo, Correctivo, Reincidencias, Productividad, Análisis de fallas, Repuestos y gastos, Combustible, Kilómetros y Personal taller. Cada OT, coche, pendiente o reincidencia abre la ficha técnica en esa OT.
- **Seguridad → Siniestros e Incidentes** (`src/g/views/Siniestros.tsx`): resumen ejecutivo, reincidencia de conductores y unidades, reparación de unidades, seguimiento económico e histórico 12 meses. Cada siniestro que entró a taller es una OT "Siniestro" en el historial del coche, con la zona dañada marcada sobre el bus.
- **RR.HH.** (resumen mensual y análisis por legajo) y **Tráfico** con acceso en vivo a Micronauta (Córdoba y Comodoro; asistente `public/micronauta-invitado.user.js` para "Entrar como invitado").
- **Datos unificados**: los indicadores de Gerencia se calculan con la misma flota (163 internos) y las mismas OT de `src/data/fleet.ts`. El plan de mantenimiento por km de cada coche ahora sale de sus OT de preventivo/service. Fecha de corte de la demo: 30/09/2026.
- **Versión HTML de un solo archivo**: `npm run build:html` → `dist-html/index.html` (se abre con doble clic, sin servidor).
- **Modo claro / oscuro**: botón sol/luna en la barra superior (se recuerda en el navegador). El tema claro (`src/theme-light.css`) se genera desde las hojas oscuras con `npm run theme:light` (`scripts/gen-light-theme.py`); correrlo después de cambiar estilos.
