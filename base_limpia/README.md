# Base limpia del Tablero Gerencial

El tablero lee **un solo resultado** (el «snapshot»): un JSON con totales por base y mes, la flota y las órdenes de trabajo.
Lo que llega en el snapshot reemplaza a los datos de demostración; lo que no llega queda en demo y el tablero lo marca.

```
fuentes (planillas, Micronauta, Flitmo, Contabilidad…)
      │  conectores: cada uno reemplaza SOLO sus filas
      ▼
esquema «tablero» en Supabase / Postgres        sql/01_esquema.sql
      │  public.tablero_snapshot()               sql/03_snapshot.sql
      ▼
tablero (menú «Fuente de datos»)
```

## Puesta en marcha

1. En Supabase → SQL Editor, correr en orden `sql/01_esquema.sql` y `sql/03_snapshot.sql`.
   (`sql/02_comodoro_micronauta.sql` es el adaptador de la API de Micronauta de Comodoro: hay que completarle los nombres de tabla.)
2. Cargar las tablas con los conectores. Cada tabla tiene la columna `fuente`: un conector borra e inserta solo lo suyo.
3. Probar: `select jsonb_pretty(public.tablero_snapshot());`
4. En el tablero: **Fuente de datos → Supabase**, pegar la dirección del proyecto y la clave pública (`anon`), **Probar conexión** y **Guardar y recargar**.

Para dejar la conexión fija para todos los usuarios (sin que cada uno la cargue), agregar antes del script del tablero en `index.html`:

```html
<script>window.SOLBUS_CONFIG = { fuente: { tipo: 'supabase', url: 'https://xxxx.supabase.co', anonKey: 'eyJ…' } };</script>
```

## Seguridad

- El navegador **no** tiene acceso a las tablas: solo puede ejecutar `tablero_snapshot()` (función `security definer`).
- RR.HH. sale únicamente como totales por base y mes: sin legajos, nombres ni DNI.
- Usar siempre la clave pública `anon`. El tablero rechaza una clave `service_role`.

## Formato del snapshot

Solo `meta` es obligatorio. Hay un ejemplo en `public/datos/ejemplo-snapshot.json` (sirve para probar con **Fuente de datos → Archivo JSON**).

| Bloque | Una fila por | Campos |
|---|---|---|
| `meta` | — | `hasta` (AAAA-MM, último mes cerrado), `corte`, `generado`, `fuentes[]` |
| `mensual` | base y mes | `kmProg` `kmExec` `pax` `reg` `lts` `sin` `exc` `aux` `aus` `cob` `cost` `inc` `otClosed` `otOpen` `prevDone` `prevPend` `reinc` `repTime` `personal` `horas` `total` `oper` `out` `enRep` `espRep` `fuera` `itcVenc` `itc30` `itc60` |
| `rrhh_mensual` | base y mes | `activos` `altas` `bajas` `ausDias` `ausPct` `artCant` `artDias` `carpCant` `carpDias` `susCant` `susDias` `remun` `feriados` `guardias` |
| `unidades` | coche | `base` `interno` `dominio` `chasis` `carroceria` `anio` `km` `linea` `estado` `ultServiceKm` `ultPreventivoKm` |
| `ot` | orden de trabajo | `id` `base` `interno` `tipo` `estado` `prioridad` `abierta` `cerrada` `km` `titulo` `diagnostico` `mecanico` `horas` `componentes[]` `materiales[]` |

Reglas:

- Las bases se llaman exactamente `Córdoba`, `Comodoro`, `San Luis`, `Villa Mercedes`.
- El tablero muestra los 12 meses que terminan en `meta.hasta`: avanza solo cuando cierra un mes.
- Un mes de tráfico se envía solo si tiene casi todos sus días cargados (no se muestran meses a medias).
- Cualquier campo que falte se deja afuera (no mandar ceros de relleno): así el tablero sabe que ese dato sigue en demo.

## Qué tabla llena cada área

| Área | Tablas |
|---|---|
| Sistemas (planillas SIG / flota) | `unidad` `ot` `ot_material` `comb_mes` `comb_dia` `panol_stock` `panol_mov` `cubierta` `siniestro` |
| Sistemas (Micronauta, SUBE) | `trafico_dia` `trafico_linea_mes` `trafico_hora` `exceso_velocidad` |
| RR.HH. (API de Flitmo) | `personal` `rrhh_novedad` `rrhh_mes` |
| Contabilidad | `finanzas_mes` (conceptos `costo:…` e `ingreso:…`) |
| Taller | `auxilio`, horas en `ot.horas` |
| Administración de flota | `vencimiento` |

La lista completa de lo que falta, con quién lo tiene, está en el tablero (**Fuente de datos**) y se puede descargar.
