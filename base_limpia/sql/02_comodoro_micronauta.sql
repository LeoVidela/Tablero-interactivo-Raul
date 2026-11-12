-- =====================================================================================
-- Adaptador: datos de Micronauta Comodoro que la API ya deja en Supabase  →  base limpia
-- Corre DENTRO de Supabase (misma base), así que no hace falta copiar datos entre servidores.
--
-- PASO 1 · Descubrir cómo se llaman las tablas que llena la API (correr y pasar el resultado):
--
--   select table_schema, table_name, column_name, data_type
--   from information_schema.columns
--   where table_schema not in ('pg_catalog','information_schema','auth','storage','tablero','realtime','supabase_functions','extensions','graphql','graphql_public','vault','pgsodium','net')
--   order by table_schema, table_name, ordinal_position;
--
-- PASO 2 · Completar las dos vistas de abajo reemplazando <<...>> por las tablas/columnas reales.
-- PASO 3 · select tablero.sync_comodoro();  (y programarlo cada 10 minutos con pg_cron, ver al final)
--
-- OJO: este archivo no corre tal cual: tiene marcadores <<...>> a completar.
-- =====================================================================================
set search_path = tablero, public;

-- Un día por fila: km productivos, teóricos, enlace, pasajeros y servicios de Comodoro
create or replace view v_src_comodoro_dia as
select
  'Comodoro'::text            as base,
  (<<columna_fecha>>)::date   as fecha,
  sum(<<km_productivos>>)     as km_prod,
  sum(<<km_teoricos>>)        as km_teo,
  sum(<<km_enlace>>)          as km_enlace,
  sum(<<pasajeros>>)::int     as pax,
  sum(<<pasajeros_sube>>)::int as pax_sube,
  count(distinct <<servicio_id>>) filter (where <<servicio_programado>>) as servicios_prog,
  count(distinct <<servicio_id>>) filter (where <<servicio_realizado>>)  as servicios_real
from <<esquema.tabla_api_micronauta>>
group by 2;

-- Foto horaria del día (tiempo real): km acumulados, coches en calle, pasajeros y velocidad
create or replace view v_src_comodoro_hora as
select
  'Comodoro'::text                     as base,
  (<<columna_fecha_hora>>)::date       as fecha,
  extract(hour from <<columna_fecha_hora>>)::smallint as hora,
  sum(<<km>>)                          as km_hora,
  count(distinct <<interno>>)          as coches_activos,
  sum(<<pasajeros>>)::int              as pax,
  avg(<<velocidad>>)                   as vel
from <<esquema.tabla_api_posiciones>>
where (<<columna_fecha_hora>>)::date >= current_date - 1
group by 2, 3;

-- Copia a la base limpia solo lo que es de esta fuente (no toca la planilla kms Comodoro)
create or replace function sync_comodoro() returns int language plpgsql security definer set search_path = tablero, public as $$
declare n int := 0; m int;
begin
  insert into fuente (id, nombre, tipo, frecuencia_min) values ('micronauta_crd', 'API Micronauta Comodoro (Supabase)', 'api', 10)
  on conflict (id) do nothing;

  delete from trafico_dia where fuente = 'micronauta_crd';
  insert into trafico_dia (fuente, base, fecha, km_prod, km_teo, km_enlace, pax, pax_sube, pax_micro, recaudacion, km_ipk, servicios_prog, servicios_real)
  select 'micronauta_crd', base, fecha, km_prod, km_teo, km_enlace, pax, pax_sube, 0, 0, km_prod, servicios_prog, servicios_real from v_src_comodoro_dia;
  get diagnostics m = row_count; n := n + m;

  delete from trafico_hora where fuente = 'micronauta_crd' and fecha >= current_date - 1;
  insert into trafico_hora (fuente, base, fecha, hora, km_acum, coches_activos, pax, vel)
  select 'micronauta_crd', base, fecha, hora, sum(km_hora) over (partition by base, fecha order by hora), coches_activos, pax, vel
  from v_src_comodoro_hora;
  get diagnostics m = row_count; n := n + m;

  update fuente set ultima_carga = now(), filas = n, estado = 'ok', detalle = null,
         corte = (select max(fecha) from trafico_dia where fuente = 'micronauta_crd') where id = 'micronauta_crd';
  insert into carga_log (fuente, fin, filas, estado) values ('micronauta_crd', now(), n, 'ok');
  return n;
end $$;

-- Programarlo cada 10 minutos dentro de Supabase (Database → Extensions → pg_cron):
--   select cron.schedule('sync_comodoro', '*/10 * * * *', $$select tablero.sync_comodoro()$$);
