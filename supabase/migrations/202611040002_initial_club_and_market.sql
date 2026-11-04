-- Fantasy CB Redeiras | migration 002 | starter season and market
-- Requires migration 001. All prices are launch PROPOSALS and may be edited
-- through authorized administrative workflows before first market lock.
begin;

insert into public.clubs(slug,name,legal_name,nif,address,contact_email,timezone)
values ('cb-redeiras','CB Redeiras','Club Baloncesto Redeiras','G10917821',
'Rúa Calvar, 11-B, 1ºD, 36957 Moaña','cbaloncestoredeiras@gmail.com','Europe/Madrid')
on conflict (slug) do nothing;

insert into public.seasons(club_id,label,start_round,starting_budget,max_transfers,active)
select id,'2026/27',5,6000000,3,false from public.clubs where slug='cb-redeiras'
on conflict(club_id,label) do nothing;

insert into public.players(club_id,name,category)
select c.id, x.name, x.category
from public.clubs c cross join (values
('Juan','senior'),('Yoel','senior'),('Adri','senior'),('Mario','senior'),('Edu','senior'),
('Diego','senior'),('Brais','senior'),('Luca','senior'),('Álvaro','senior'),('Adán','senior'),
('Manuel','senior'),('Sergio','senior'),('Iván','senior'),('Álex','senior'),('Iago','senior'),
('Mateo','junior'),('Gil','junior'),('Yosue','junior')
) as x(name,category)
where c.slug='cb-redeiras'
on conflict(club_id,name) do nothing;

insert into public.player_positions(player_id,position)
select p.id, x.position
from (values
('Juan','BA'),('Juan','ES'),('Yoel','BA'),('Yoel','ES'),
('Adri','P'),('Adri','AP'),('Mario','AP'),('Mario','P'),('Edu','AP'),('Edu','P'),
('Diego','ES'),('Diego','BA'),('Brais','AL'),('Brais','ES'),('Luca','AL'),('Luca','ES'),
('Álvaro','BA'),('Álvaro','ES'),('Adán','AL'),('Adán','AP'),
('Manuel','AP'),('Manuel','AL'),('Sergio','ES'),('Sergio','AL'),('Iván','BA'),('Iván','ES'),
('Álex','AL'),('Álex','AP'),('Iago','AL'),('Iago','AP'),
('Mateo','BA'),('Mateo','ES'),('Gil','ES'),('Gil','BA'),('Yosue','AL'),('Yosue','AP')
) as x(name,position)
join public.clubs c on c.slug='cb-redeiras'
join public.players p on p.club_id=c.id and p.name=x.name
on conflict(player_id,position) do nothing;

insert into public.market_prices(season_id,player_id,price)
select s.id,p.id,x.price
from (values
('Juan',2300000),('Yoel',2150000),('Adri',1800000),('Mario',1650000),('Edu',1350000),
('Diego',1300000),('Brais',1200000),('Luca',1200000),('Álvaro',1200000),('Adán',1100000),
('Manuel',1100000),('Sergio',900000),('Iván',850000),('Álex',800000),('Iago',800000),
('Mateo',1000000),('Gil',1050000),('Yosue',850000)
) as x(name,price)
join public.clubs c on c.slug='cb-redeiras'
join public.seasons s on s.club_id=c.id and s.label='2026/27'
join public.players p on p.club_id=c.id and p.name=x.name
on conflict(season_id,player_id) do nothing;

insert into public.price_history(season_id,player_id,round_number,price_before,price_after,change_reason)
select m.season_id,m.player_id,0,m.price,m.price,'opening_price_provisional'
from public.market_prices m
join public.seasons s on s.id=m.season_id
join public.clubs c on c.id=s.club_id
where c.slug='cb-redeiras' and s.label='2026/27'
on conflict(season_id,player_id,round_number) do nothing;

insert into public.fixtures(season_id,round_number,opponent,is_home,starts_at,status)
select s.id,5,'Baloncesto Nigrán',false,'2026-11-07 20:00:00+01','scheduled'
from public.seasons s join public.clubs c on c.id=s.club_id
where c.slug='cb-redeiras' and s.label='2026/27'
on conflict(season_id,round_number) do nothing;

commit;
