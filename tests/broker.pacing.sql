-- Redeiras V3: test sen modificación persistente de datos.
begin;
do $$
begin
 if private.next_price(700000,-1,true) <> 805000 then raise exception 'Iago -1 +15%%'; end if;
 if private.next_price(700000,-5,true) <> 595000 then raise exception 'Iago -5 -15%%'; end if;
 if private.next_price(1100000,-1,true) <> 955000 then raise exception 'Brais -1'; end if;
 if private.next_price(1200000,1,true) <> 1205000 then raise exception 'Edu +1'; end if;
 if private.next_price(1500000,3,true) <> 1455000 then raise exception 'Mario +3'; end if;
 if private.next_price(2250000,3,true) <> 1915000 then raise exception 'Juan +3 -15%%'; end if;
 if private.next_price(2250000,13,true) <> 2585000 then raise exception 'Juan +13 +15%%'; end if;
 if private.next_price(805000,4,true) <> 925000 then raise exception 'Average +4 on 805k reaches +15%%'; end if;
 if private.next_price(450000,-100,true) <> 450000 then raise exception 'Floor'; end if;
 if private.next_price(700000,-1,false) <> 700000 then raise exception 'Absent Iago'; end if;
 if private.next_price(2250000,-100,true) < ceil(2250000 * .85 / 5000)::integer*5000 then raise exception 'Maximum drop 15%%'; end if;
end $$;
rollback;
