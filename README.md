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
