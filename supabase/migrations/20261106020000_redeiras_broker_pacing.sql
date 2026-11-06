-- Broker Redeiras V2 · calibración antes da primeira xornada puntuada.
-- Mantense a sinatura e as subvencións existentes da función.
-- NON se modifican public.market_prices, public.price_history,
-- equipos, transferencias, saldos nin estatísticas xa publicadas.
--
-- ACB: usa a media acumulada + límite +/- 15 %.
-- Adaptación Redeiras: obxectivo 1 M + 250.000 * media Fantasy,
-- e avanza un 20 % da diferenza por xornada para manter o
-- orzamento de 6 M axustado durante máis tempo.
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
          round((
            p_current::numeric
            + 0.20::numeric *
              (greatest(450000::numeric,1000000::numeric + 250000::numeric * coalesce(p_score,0))
                - p_current::numeric)
          ) / 5000)::integer * 5000
        )
      )
    )
  end;
$broker$;
revoke all on function private.next_price(integer,numeric,boolean) from public,anon;
comment on function private.next_price(integer,numeric,boolean) is
  'Redeiras v2: media Fantasy acumulada, obxectivo 1M+250k*media, inercia 20%, max +/-15%, min 450k. Non recalcúla prezos xa publicados.';
