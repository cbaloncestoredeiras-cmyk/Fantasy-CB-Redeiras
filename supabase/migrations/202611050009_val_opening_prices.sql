-- One-off opening price reconciliation. No historical Fantasy round scored.
BEGIN;
CREATE TEMP TABLE price_adjust (player text, old_price int, new_price int) ON COMMIT DROP;
INSERT INTO price_adjust VALUES ('Juan', 2300000, 2250000),
('Yoel', 2150000, 2050000),
('Adri', 1800000, 1700000),
('Mario', 1650000, 1500000),
('Edu', 1350000, 1200000),
('Brais', 1200000, 1100000),
('Álvaro', 1200000, 1050000),
('Adán', 1100000, 1300000),
('Mateo', 1000000, 900000),
('Gil', 1050000, 1350000),
('Yosue', 850000, 1150000),
('Iago', 800000, 700000);

DO $$
DECLARE sid uuid; cid uuid; matched integer;
BEGIN
 SELECT s.id,s.club_id INTO sid,cid
 FROM public.seasons s JOIN public.clubs c ON c.id=s.club_id
 WHERE c.slug='cb-redeiras' AND s.label='2026/27' FOR UPDATE OF s;
 IF sid IS NULL OR (SELECT active FROM public.seasons WHERE id=sid) THEN
   RAISE EXCEPTION 'Season must exist and be inactive';
 END IF;
 IF EXISTS(SELECT 1 FROM public.fantasy_teams WHERE season_id=sid)
 OR EXISTS(SELECT 1 FROM public.fixtures WHERE season_id=sid AND status='finalized')
 OR EXISTS(SELECT 1 FROM public.game_stats g JOIN public.fixtures f ON f.id=g.fixture_id WHERE f.season_id=sid)
 THEN RAISE EXCEPTION 'Cannot change opening market after play'; END IF;

 SELECT count(*) INTO matched
 FROM price_adjust a
 JOIN public.players p ON p.club_id=cid AND p.name=a.player
 JOIN public.market_prices m ON m.season_id=sid AND m.player_id=p.id
 JOIN public.price_history h ON h.season_id=sid AND h.player_id=p.id AND h.round_number=0
 WHERE m.price=a.old_price AND h.price_before=a.old_price AND h.price_after=a.old_price;
 IF matched<>12 THEN RAISE EXCEPTION 'Expected 12 unchanged baseline records: found %',matched; END IF;

 UPDATE public.market_prices m SET price=a.new_price,updated_at=now()
 FROM price_adjust a JOIN public.players p ON p.name=a.player AND p.club_id=cid
 WHERE m.season_id=sid AND m.player_id=p.id;

 UPDATE public.price_history h SET price_before=a.new_price,price_after=a.new_price,
 change_reason='opening_review_pir_round4'
 FROM price_adjust a JOIN public.players p ON p.name=a.player AND p.club_id=cid
 WHERE h.season_id=sid AND h.player_id=p.id AND h.round_number=0;
END $$;
COMMIT;
