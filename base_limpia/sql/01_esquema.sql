-- =====================================================================================
-- Base limpia del Tablero Gerencial Solbus  ·  esquema «tablero»
-- Una sola base ordenada que juntan todas las fuentes (planillas SIG/flota, tableros de la
-- carpeta Sistemas, kms Comodoro, Micronauta, y más adelante Flitmo y Contabilidad).
-- El tablero NO cambia: lee un único «snapshot» que arma public.tablero_snapshot() (03_snapshot.sql).
--
-- Reglas:
--  * Cada fila guarda de qué fuente vino (columna fuente) y cuándo se cargó (cargado).
--  * Cada conector reemplaza SOLO sus filas (delete por fuente + insert), así una fuente
--    caída no borra lo de otra.
--  * Nada de datos demo acá adentro: lo que no tiene fuente simplemente no está.
-- Probado en PostgreSQL 16 (mismo motor que Supabase).
-- =====================================================================================
create schema if not exists tablero;
set search_path = tablero, public;

-- ---------- catálogo de fuentes y bitácora de cargas ----------
create table if not exists fuente (
  id            text primary key,          -- 'sig_flota', 'trafico_cba', 'kms_comodoro', 'micronauta_crd', 'flitmo', ...
  nombre        text not null,
  tipo          text not null,             -- planilla | html | api | sql | manual
  frecuencia_min int not null default 60,  -- cada cuánto se espera que actualice
  corte         date,                       -- fecha del último dato que trajo
  ultima_carga  timestamptz,
  filas         int,
  estado        text default 'sin cargar',  -- ok | error | sin cargar
  detalle       text
);
create table if not exists carga_log (
  id      bigserial primary key,
  fuente  text references fuente(id),
  inicio  timestamptz not null default now(),
  fin     timestamptz,
  filas   int,
  estado  text,
  error   text
);
-- avisos de calidad y datos faltantes que detecta cada conector
create table if not exists aviso (
  fuente  text references fuente(id) on delete cascade,
  tipo    text not null check (tipo in ('aviso', 'faltante')),
  modulo  text, dato text not null, origen text, impacto text, orden int
);

-- ---------- dimensiones ----------
create table if not exists base (
  id     text primary key,                  -- nombre tal como lo usa el tablero
  codigo text unique
);
insert into base values ('Córdoba','COR'),('Comodoro','CRD'),('San Luis','SL'),('Villa Mercedes','VM') on conflict do nothing;

-- ---------- flota ----------
create table if not exists unidad (
  fuente text, cargado timestamptz default now(),
  base text references base(id), interno text, tipo text, estado text, estado_txt text, motivo text,
  odometro numeric, odo_fecha date, dominio text, chasis text, modelo text, carroceria text, anio int, linea text,
  svc_km numeric, svc_fecha date, svc_cada numeric, prev_km numeric, prev_fecha date, prev_dias numeric,
  orden int,
  primary key (base, interno)
);
create table if not exists plan_mant (
  fuente text, base text, interno text, tipo text, frec_km numeric, frec_dias numeric,
  ult_km numeric, ult_fecha date, rest_km numeric, rest_dias numeric, orden int
);
create table if not exists vencimiento (
  fuente text, base text, interno text, vtv date, seguro date, ruta date, orden int
);

-- ---------- taller ----------
create table if not exists ot (
  fuente text, cargado timestamptz default now(),
  seq bigserial primary key, id text, base text, interno text, tipo text, estado text, prioridad text, abierta date, cerrada date,
  km numeric, origen text, titulo text, diagnostico text, mecanico text, horas numeric,
  sistemas text[], orden int
);
create table if not exists ot_material (
  ot_seq bigint references ot(seq) on delete cascade, codigo text, articulo text, unidad text, cantidad numeric, precio numeric, origen text, orden int
);
create table if not exists checklist_mes (
  fuente text, base text, mes text, total int, con_novedad int, primary key (base, mes)
);
-- auxilios en calle (botón SOS / guardia)
create table if not exists auxilio (
  fuente text, base text, fecha date, interno text, motivo text, orden int
);

-- ---------- combustible ----------
create table if not exists comb_mes (       -- litros y km por coche y mes
  fuente text, base text, interno text, mes text, litros numeric, km numeric, cargas int, litros_con_km numeric,
  primary key (base, interno, mes)
);
create table if not exists comb_dia (
  fuente text, base text, fecha date, litros numeric, primary key (base, fecha, fuente)
);
create table if not exists comb_ingreso (   -- también trasvases (tipo)
  fuente text, tipo text default 'ingreso', base text, fecha date, litros numeric, proveedor text, remito text,
  precio numeric, importe numeric, responsable text, orden int
);
create table if not exists comb_aforo (
  fuente text, base text, fecha date, surtidor text, turno text, declarado numeric, calculado numeric, dif numeric, responsable text, orden int
);
create table if not exists comb_precio_ref (fuente text primary key, precio numeric);

-- ---------- pañol y cubiertas ----------
create table if not exists panol_stock (
  fuente text, base text, codigo text, articulo text, categoria text, cantidad numeric, critico numeric, ubicacion text, foto text, precio numeric, orden int
);
create table if not exists panol_mov (       -- ingresos y consumos valorizados
  fuente text, tipo text check (tipo in ('ingreso','consumo')), base text, fecha date, articulo text, cantidad numeric, precio numeric,
  importe numeric, proveedor text, comprobante text, interno text, estado text, orden int
);
create table if not exists cubierta (
  fuente text, base text, interno text, pos text, mm numeric, fuego text, marca text, medida text, clase text,
  odometro numeric, fecha date, desgaste numeric, irregular boolean, anomalia boolean, orden int
);
create table if not exists cubierta_medicion (
  fuente text, interno text, pos text, fecha date, mm numeric, odometro numeric, orden int
);
create table if not exists cubierta_stock (
  fuente text, tipo text check (tipo in ('stock','aux')), base text, medida text, clase text, cantidad numeric, obs text,
  mm numeric, estado text, fuego text, marca text, orden int
);

-- ---------- siniestros ----------
create table if not exists siniestro (
  fuente text, id text, base text, fecha date, interno text, chofer text, tipo text, clase text, estado text,
  lesionados text, responsabilidad text, monto numeric, sancion text, etapa text, obs text, cierre date, ubicacion text, orden int
);
create table if not exists siniestro_geo (
  fuente text, base text, fecha date, interno text, chofer text, tipo text, categoria text, estado text, lat numeric, lng numeric, obs text, orden int
);
-- excesos de velocidad detectados por GPS
create table if not exists exceso_velocidad (
  fuente text, base text, fecha date, interno text, chofer text, velocidad numeric, limite numeric, orden int
);

-- ---------- RR.HH. ----------
create table if not exists personal (
  fuente text, base text, dni text, nombre text, legajo text, sector text, puesto text, ingreso date, estado text, orden int
);
create table if not exists asistencia_dia (fuente text, base text, fecha date, presentes int, primary key (base, fecha, fuente));
-- novedades por legajo (Flitmo): ausencia, carpeta, art, informe, apercibimiento, suspension, alta, baja, hora_extra, feriado, guardia
create table if not exists rrhh_novedad (
  fuente text, base text, legajo text, fecha date, hasta date, tipo text, dias numeric, cantidad numeric, detalle text
);
-- dotación y turnos por mes (Flitmo / diagramación): activos al cierre, turnos programados y cubiertos, remuneraciones
create table if not exists rrhh_mes (
  fuente text, base text, mes text, activos int, turnos_prog int, turnos_cub int, horas_prog numeric, horas_aus numeric, remuneracion numeric,
  primary key (base, mes)
);

-- ---------- tráfico ----------
create table if not exists trafico_dia (
  fuente text, base text references base(id), fecha date,
  km_prod numeric, km_teo numeric, km_enlace numeric, pax int, pax_sube int, pax_micro int, recaudacion numeric, km_ipk numeric,
  servicios_prog int, servicios_real int,
  -- varias fuentes pueden aportar al mismo día (p. ej. km de la planilla y pasajeros de la API): se combinan en el snapshot
  primary key (base, fecha, fuente)
);
create table if not exists trafico_linea_mes (
  fuente text, base text, mes text, linea text, km numeric, km_enlace numeric, pax int, pax_sube int, pax_micro int, recaudacion numeric,
  primary key (base, mes, linea)
);
create table if not exists trafico_micro_mes (     -- boletos Micronauta por hora
  fuente text, base text, mes text, total int, coches int, por_hora int[], primary key (base, mes)
);
create table if not exists trafico_micro_cat (     -- boletos Micronauta por tipo de boleto y por parada
  fuente text, base text, mes text, grupo text check (grupo in ('tipo','parada')), nombre text, cantidad int, orden int
);
-- foto horaria del día (tiempo real): la llenan Micronauta/GPS cada 10 minutos
create table if not exists trafico_hora (
  fuente text, base text, fecha date, hora smallint, km_acum numeric, km_ideal numeric, coches_activos int, pax int, vel numeric,
  actualizado timestamptz default now(),
  primary key (base, fecha, hora, fuente)
);

-- ---------- económico (Contabilidad, cuando llegue) ----------
-- concepto: 'costo:sueldos', 'costo:combustible', 'costo:repuestos', 'costo:seguros', 'costo:otros', 'ingreso:sube', 'ingreso:subsidios', ...
create table if not exists finanzas_mes (
  fuente text, base text, mes text, concepto text, importe numeric, primary key (base, mes, concepto)
);

-- ---------- vistas de control ----------
-- qué tan al día está cada fuente
create or replace view v_fuentes as
select f.id, f.nombre, f.tipo, f.frecuencia_min, f.corte, f.ultima_carga, f.filas, f.estado, f.detalle,
       case when f.ultima_carga is null then 'sin cargar'
            when now() - f.ultima_carga > make_interval(mins => f.frecuencia_min * 3) then 'atrasada'
            else 'al día' end as frescura
from fuente f;

-- qué datos existen por base y mes (sirve para medir el avance real, sin demo)
create or replace view v_cobertura_mes as
with m as (
  select base, to_char(fecha,'YYYY-MM') mes, 'km' dato from trafico_dia where km_prod > 0
  union select base, to_char(fecha,'YYYY-MM'), 'pasajeros' from trafico_dia where pax > 0
  union select base, to_char(fecha,'YYYY-MM'), 'recaudacion' from trafico_dia where recaudacion > 0
  union select base, mes, 'combustible' from comb_mes
  union select base, to_char(abierta,'YYYY-MM'), 'ot' from ot
  union select base, to_char(fecha,'YYYY-MM'), 'siniestros' from siniestro
  union select base, to_char(fecha,'YYYY-MM'), 'rrhh_novedades' from rrhh_novedad
  union select base, mes, 'costos' from finanzas_mes
)
select base, mes, array_agg(dato order by dato) datos from m group by base, mes;

-- Si el esquema ya existía de una versión anterior, agrega las columnas nuevas (no borra nada).
alter table unidad add column if not exists carroceria text, add column if not exists anio int, add column if not exists linea text;
alter table ot add column if not exists prioridad text;
alter table ot_material add column if not exists codigo text, add column if not exists unidad text, add column if not exists origen text;
