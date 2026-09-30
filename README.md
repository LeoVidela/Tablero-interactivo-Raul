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

Los datos se encuentran en `src/main.tsx` como dataset de demostración. En la siguiente etapa se pueden reemplazar por endpoints de una API y autenticación por roles.


## Novedades: pedido de Gerencia (30/09/2026)

- **Resumen = Tablero de control integral**: 6 grupos de indicadores (Operación, Flota, RR.HH., Seguridad, Económico, Demanda) con semáforo vs. objetivo y variación vs. período anterior, 3 gráficos, tabla por línea y 5 alertas dinámicas. Selector global **Todos · Córdoba · Comodoro · San Luis · Villa Mercedes** y selector de período (trimestres y meses).
- **Taller & Mantenimiento**: 10 pestañas (Resumen general, Preventivo, Correctivo, Reincidencias, Productividad, Análisis de fallas, Repuestos y gastos, Combustible, Kilómetros, Personal taller). Al tocar una OT, unidad o preventivo se abre la **ficha del coche** con el bus marcando la zona intervenida, materiales usados, costos e historial.
- **RR.HH.**: resumen mensual por área + análisis individual por legajo.
- **Tráfico**: acceso a la flota en tiempo real de Micronauta (Comodoro y Córdoba). `public/micronauta-invitado.user.js` (Tampermonkey) acciona "Entrar como invitado" automáticamente.
- Datos demo determinísticos en `src/data.ts`, `src/taller.ts` y `src/rrhh.ts`.

## Novedades: Siniestros y Mantenimiento de flota (30/09/2026)
- **Seguridad → Siniestros e Incidentes** (`src/siniestros.ts`, `src/views/Siniestros.tsx`): resumen ejecutivo, reincidencia de conductores y unidades, seguimiento de reparaciones (pendientes del mes / meses anteriores con antigüedad, en reparación, reparadas), seguimiento económico (seguro, gestión interna, terceros, reclamos) e histórico de 12 meses por conductor. Respeta el selector de unidad; conductores y reclamos abren su detalle y los internos abren la ficha del coche.
- **Taller → Mantenimiento de flota** (`src/mant.ts`, `src/views/Mantenimiento.tsx`): plan de preventivos y services, pendientes y vencidos +30 días, evolución 6 meses, pendientes acumulados, correctivos realizados y producción individual (también en *Personal taller*).
- La ficha del coche ahora incluye también los siniestros del coche en su historial.
- **Versión HTML de un solo archivo**: `npm run build:html` → `dist-html/index.html` (se abre con doble clic, sin servidor ni internet).
