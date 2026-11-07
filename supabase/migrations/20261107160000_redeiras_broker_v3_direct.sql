-- Redeiras V3 · broker inspirando na mecánica ACB con escala propia.
-- Aprobación: 7 novembro 2026, antes da primeira publicación de puntuacións.
-- Conserva prezos existentes, quintetos, efectivo, fichaxes e historial.
-- p_score = media acumulada real de puntos Fantasy dos partidos xogados.
-- Non se modifican public.market_prices nin táboas de negocio.
create or replace function private.next_price(p_current integer,p_score numeric,p_played boolean)
returns integer
language sql immutable
set search_path = ''
as $broker$
  select case when p_played is distinct from true then p_current
    else greatest(
      450000,
      least(
        floor(p_current::numeric * 1.15 / 5000)::integer * 5000,
        greatest(
          ceil(p_current::numeric * 0.85 / 5000)::integer * 5000,
          round(
            greatest(450000::numeric,1080000::numeric + 125000::numeric * coalesce(p_score,0))
            / 5000
          )::integer * 5000
        )
      )
    )
  end;
$broker$;
revoke all on function private.next_price(integer,numeric,boolean) from public,anon;
comment on function private.next_price(integer,numeric,boolean) is
 'Redeiras V3: prezo teorico max(450k, 1.080.000+125.000*media Fantasy acumulada), aproximacion directa, +/-15% por partido xogado, redondeo 5k; non altera prezos previos.';
