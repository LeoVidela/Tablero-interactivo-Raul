-- =====================================================================================
-- Snapshot del tablero: UNA función que devuelve todo lo que el tablero necesita, en el
-- formato que espera (src/data/source.ts). El tablero la llama una vez al abrir:
--     POST https://<proyecto>.supabase.co/rest/v1/rpc/tablero_snapshot   (con la clave pública «anon»)
--
-- Seguridad:
--  * La función es «security definer»: el navegador NO tiene acceso a las tablas, solo a este resultado.
--  * RR.HH. sale únicamente como totales por base y mes (sin legajos, nombres ni DNI).
--  * No usar nunca la clave service_role en el tablero.
--
-- Regla general: lo que no tiene dato no se envía (el tablero deja ese indicador en demo y lo marca).
-- =====================================================================================
set search_path = tablero, public;

create or replace function public.tablero_snapshot(p_hasta text default null)
returns jsonb language sql stable security definer set search_path = tablero, public as $$
with par as (
  -- último mes cerrado (hora de Argentina), salvo que se pida otro: select tablero_snapshot('2026-10')
  select coalesce(to_date(p_hasta || '-01', 'YYYY-MM-DD'),
                  (date_trunc('month', (now() at time zone 'America/Argentina/Cordoba')) - interval '1 month')::date) as fin
), win as (
  select (fin - interval '11 months')::date as desde, (fin + interval '1 month' - interval '1 day')::date as hasta, to_char(fin, 'YYYY-MM') as ym from par
),
-- ---- tráfico: varias fuentes pueden aportar al mismo día → se toma el mayor valor de cada columna
dia as (
  select base, fecha, max(km_prod) km_prod, max(km_teo) km_teo, max(pax) pax, max(recaudacion) rec,
         max(servicios_prog) sprog, max(servicios_real) sreal
  from trafico_dia, win where fecha between win.desde and win.hasta group by base, fecha
), traf as (
  select base, to_char(fecha, 'YYYY-MM') mes,
         count(*) filter (where km_prod > 0) dias_km,
         sum(km_prod) km_exec, sum(km_teo) km_prog, sum(pax) pax, sum(rec) rec, sum(sprog) sprog, sum(sreal) sreal,
         extract(day from (date_trunc('month', min(fecha)) + interval '1 month' - interval '1 day'))::int dias_mes
  from dia group by 1, 2
), comb as (
  select base, mes, sum(litros) lts from comb_mes group by 1, 2
), otc as (  -- OT cerradas en el mes
  select base, to_char(cerrada, 'YYYY-MM') mes, count(*) cerradas, sum(horas) horas, avg(nullif(horas, 0)) rep_time,
         count(*) filter (where tipo ~* 'prevent|service') prev_done, count(distinct nullif(mecanico, '')) personal
  from ot, win where cerrada between win.desde and win.hasta group by 1, 2
), meses as (
  select b.id base, to_char(d, 'YYYY-MM') mes, (d + interval '1 month' - interval '1 day')::date fin_mes
  from base b, win, generate_series(win.desde, win.hasta, interval '1 month') d
), oto as (  -- OT abiertas al cierre de cada mes
  select m.base, m.mes, count(o.*) abiertas
  from meses m join ot o on o.base = m.base and o.abierta <= m.fin_mes and (o.cerrada is null or o.cerrada > m.fin_mes)
  group by 1, 2
), sinm as (
  select base, to_char(fecha, 'YYYY-MM') mes, count(*) filter (where coalesce(clase, tipo, '') !~* 'incidente') sin
  from siniestro, win where fecha between win.desde and win.hasta group by 1, 2
), excm as (
  select base, to_char(fecha, 'YYYY-MM') mes, count(*) exc from exceso_velocidad, win where fecha between win.desde and win.hasta group by 1, 2
), auxm as (
  select base, to_char(fecha, 'YYYY-MM') mes, count(*) aux from auxilio, win where fecha between win.desde and win.hasta group by 1, 2
), fin as (
  select base, mes, sum(importe) filter (where concepto ilike 'costo%') costo, sum(importe) filter (where concepto ilike 'ingreso%') ingreso
  from finanzas_mes group by 1, 2
), rh as (
  select base, mes, activos, case when turnos_prog > 0 then round(100.0 * turnos_cub / turnos_prog, 2) end cob,
         case when horas_prog > 0 then round(100.0 * horas_aus / horas_prog, 2) end aus, remuneracion
  from rrhh_mes
), flota as (  -- estado actual de la flota: solo para el último mes de la ventana
  select base, (select ym from win) mes, count(*) total,
         count(*) filter (where coalesce(estado, estado_txt, '') ~* 'repuesto') esp_rep,
         count(*) filter (where coalesce(estado, estado_txt, '') ~* 'fuera|baja') fuera,
         count(*) filter (where coalesce(estado, estado_txt, '') ~* 'taller|repar|deten' and coalesce(estado, estado_txt, '') !~* 'repuesto') en_rep
  from unidad group by 1
), mensual as (
  select jsonb_strip_nulls(jsonb_build_object(
    'base', m.base, 'mes', m.mes,
    -- un mes de tráfico cuenta solo si tiene casi todos sus días cargados (evita mostrar meses a medias)
    'kmExec', case when t.dias_km >= t.dias_mes - 3 then round(t.km_exec) end,
    'kmProg', case when t.dias_km >= t.dias_mes - 3 and t.km_prog > 0 then round(t.km_prog) end,
    'pax',    case when t.dias_km >= t.dias_mes - 3 and t.pax > 0 then t.pax end,
    'reg',    case when t.sprog > 0 then round(100.0 * t.sreal / t.sprog, 2) end,
    'inc',    case when t.dias_km >= t.dias_mes - 3 and t.km_exec > 0 and coalesce(f.ingreso, t.rec) > 0 then round(coalesce(f.ingreso, t.rec) / t.km_exec, 2) end,
    'cost',   case when t.dias_km >= t.dias_mes - 3 and t.km_exec > 0 and f.costo > 0 then round(f.costo / t.km_exec, 2) end,
    'lts',    round(c.lts),
    'otClosed', oc.cerradas, 'horas', round(oc.horas), 'repTime', round(oc.rep_time, 2), 'prevDone', oc.prev_done, 'personal', nullif(oc.personal, 0),
    'otOpen', oo.abiertas,
    'sin', s.sin, 'exc', e.exc, 'aux', a.aux,
    'aus', r.aus, 'cob', r.cob,
    'total', fl.total, 'enRep', fl.en_rep, 'espRep', fl.esp_rep, 'fuera', fl.fuera,
    'out', fl.en_rep + fl.esp_rep + fl.fuera, 'oper', fl.total - fl.en_rep - fl.esp_rep - fl.fuera
  )) j
  from meses m
  left join traf t on t.base = m.base and t.mes = m.mes
  left join comb c on c.base = m.base and c.mes = m.mes
  left join otc oc on oc.base = m.base and oc.mes = m.mes
  left join oto oo on oo.base = m.base and oo.mes = m.mes
  left join sinm s on s.base = m.base and s.mes = m.mes
  left join excm e on e.base = m.base and e.mes = m.mes
  left join auxm a on a.base = m.base and a.mes = m.mes
  left join fin f on f.base = m.base and f.mes = m.mes
  left join rh r on r.base = m.base and r.mes = m.mes
  left join flota fl on fl.base = m.base and fl.mes = m.mes
), nov as (  -- novedades de RR.HH. por base y mes: solo totales
  select base, to_char(fecha, 'YYYY-MM') mes,
         count(*) filter (where tipo = 'alta') altas, count(*) filter (where tipo = 'baja') bajas,
         sum(dias) filter (where tipo = 'ausencia') aus_dias,
         count(*) filter (where tipo = 'art') art_cant, sum(dias) filter (where tipo = 'art') art_dias,
         count(*) filter (where tipo = 'carpeta') carp_cant, sum(dias) filter (where tipo = 'carpeta') carp_dias,
         count(*) filter (where tipo = 'suspension') sus_cant, sum(dias) filter (where tipo = 'suspension') sus_dias,
         sum(coalesce(cantidad, 1)) filter (where tipo = 'feriado') feriados, sum(coalesce(cantidad, 1)) filter (where tipo = 'guardia') guardias
  from rrhh_novedad, win where fecha between win.desde and win.hasta group by 1, 2
), rrhh as (
  select jsonb_strip_nulls(jsonb_build_object(
    'base', m.base, 'mes', m.mes, 'activos', r.activos, 'ausPct', r.aus, 'remun', r.remuneracion,
    'altas', n.altas, 'bajas', n.bajas, 'ausDias', n.aus_dias, 'artCant', n.art_cant, 'artDias', n.art_dias,
    'carpCant', n.carp_cant, 'carpDias', n.carp_dias, 'susCant', n.sus_cant, 'susDias', n.sus_dias, 'feriados', n.feriados, 'guardias', n.guardias)) j
  from meses m left join rh r on r.base = m.base and r.mes = m.mes left join nov n on n.base = m.base and n.mes = m.mes
  where r.base is not null or n.base is not null
), uni as (
  select jsonb_strip_nulls(jsonb_build_object(
    'base', base, 'interno', interno, 'dominio', dominio, 'chasis', coalesce(chasis, modelo), 'carroceria', carroceria, 'anio', anio, 'km', round(odometro),
    'linea', linea, 'estado', coalesce(estado, estado_txt), 'ultServiceKm', svc_km, 'ultPreventivoKm', prev_km)) j, base, orden, interno
  from unidad
), ots as (
  select jsonb_strip_nulls(jsonb_build_object(
    'id', coalesce(o.id, 'OT-' || o.seq), 'base', o.base, 'interno', o.interno, 'tipo', o.tipo, 'estado', o.estado, 'prioridad', o.prioridad,
    'abierta', o.abierta, 'cerrada', o.cerrada, 'km', o.km, 'origen', o.origen, 'titulo', o.titulo, 'diagnostico', o.diagnostico,
    'mecanico', o.mecanico, 'horas', o.horas, 'componentes', to_jsonb(o.sistemas),
    'materiales', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('codigo', mt.codigo, 'nombre', mt.articulo, 'unidad', mt.unidad, 'cantidad', mt.cantidad, 'precio', mt.precio, 'origen', mt.origen)) order by mt.orden)
                   from ot_material mt where mt.ot_seq = o.seq))) j, o.abierta, o.seq
  from ot o, win where o.abierta >= win.desde or o.cerrada is null or o.cerrada >= win.desde
)
select jsonb_strip_nulls(jsonb_build_object(
  'meta', jsonb_build_object(
    'generado', to_char(now() at time zone 'America/Argentina/Cordoba', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'hasta', (select ym from win),
    'corte', (select max(corte) from fuente),
    'fuentes', coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from v_fuentes v), '[]'::jsonb)),
  -- solo se mandan las filas que traen algún dato además de base y mes
  'mensual', (select jsonb_agg(j order by j->>'base', j->>'mes') from mensual where (select count(*) from jsonb_object_keys(j)) > 2),
  'rrhh_mensual', (select jsonb_agg(j order by j->>'base', j->>'mes') from rrhh where (select count(*) from jsonb_object_keys(j)) > 2),
  'unidades', (select jsonb_agg(j order by base, orden, interno) from uni),
  'ot', (select jsonb_agg(j order by abierta, seq) from ots)
))
$$;

-- El tablero entra con la clave pública: se le da permiso SOLO a esta función.
revoke all on function public.tablero_snapshot(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then grant execute on function public.tablero_snapshot(text) to anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then grant execute on function public.tablero_snapshot(text) to authenticated; end if;
end $$;

-- Prueba rápida:  select jsonb_pretty(public.tablero_snapshot());
