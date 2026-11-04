-- Migration 005: fixtures from official regular-season calendar, phase 1
-- Dates for round 6 onwards are only reference Sundays. Actual tip-off is set by admin
-- when announced (typically Tuesdays at 18:00). Never infer a kick-off time.
begin;
insert into public.fixtures(season_id,round_number,opponent,is_home,starts_at,status)
select s.id,v.r,v.opponent,v.home,null,'scheduled'
from public.seasons s join public.clubs c on c.id=s.club_id
cross join(values
 (6,'Esperanza Vigo',true),
 (7,'CB Baiona',false),
 (8,'CB Redondela',true),
 (9,'CB Puerto Vigo',false),
 (10,'CB Apóstol Santiago',true),
 (11,'CB Mos',false),
 (12,'Rodaballo Club',true),
 (13,'CB Eléctrica Sestelo Condado',false),
 (14,'CB Caselas Hermanos Núñez',true),
 (15,'Mar de Vigo',false)
) as v(r,opponent,home)
where c.slug='cb-redeiras' and s.label='2026/27'
on conflict(season_id,round_number) do nothing;
commit;
