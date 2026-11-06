-- Execute AFTER the migration; no permanent data changes.
begin;
do $$
declare
begin
 if private.next_price(700000,-1,true) <> 710000 then raise exception 'Iago -1'; end if;
 if private.next_price(700000,1,true) <> 805000 then raise exception 'Iago +1 15%% cap'; end if;
 if private.next_price(1200000,2,true) <> 1260000 then raise exception 'Edu +2'; end if;
 if private.next_price(1500000,3,true) <> 1550000 then raise exception 'Mario +3'; end if;
 if private.next_price(2250000,3,true) <> 2150000 then raise exception 'Juan +3'; end if;
 if private.next_price(2250000,5,true) <> 2250000 then raise exception 'Juan +5'; end if;
 if private.next_price(700000,-100,true) < 450000 then raise exception 'minimum 450k'; end if;
 if private.next_price(2250000,-100,true) < ceil(2250000 * .85 / 5000)::integer*5000 then raise exception 'maximum drop 15%%'; end if;
 if private.next_price(700000,99,false) <> 700000 then raise exception 'DNP changes price'; end if;
end $$;
rollback;
