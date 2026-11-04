-- Fantasy CB Redeiras | migration 001 | draft schema (NO deployment yet)
-- Run only in a NEW Supabase project after review.
-- Deliberately offers authenticated SELECT only; all mutations are blocked by RLS
-- until audited SECURITY DEFINER functions or secured server routes are implemented.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  legal_name text not null,
  nif text not null,
  address text not null,
  contact_email text not null,
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  created_at timestamptz not null default now()
);

create table public.club_memberships (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','participant')),
  joined_at timestamptz not null default now(),
  primary key (club_id,user_id)
);

create function private.is_member(p_club_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.club_memberships m
    where m.club_id = p_club_id and m.user_id = (select auth.uid())
  );
$$;

create function private.is_admin(p_club_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.club_memberships m
    where m.club_id = p_club_id and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

revoke all on function private.is_member(uuid), private.is_admin(uuid) from public, anon;
grant execute on function private.is_member(uuid), private.is_admin(uuid) to authenticated;

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  label text not null,
  start_round smallint not null default 5 check (start_round > 0),
  starting_budget integer not null default 6000000 check (starting_budget > 0),
  max_transfers smallint not null default 3 check (max_transfers >= 0),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(club_id,label),
  unique(id,club_id)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  category text not null default 'senior' check (category in ('senior','junior')),
  active boolean not null default true,
  jersey_number smallint check (jersey_number between 0 and 99),
  photo_path text,
  created_at timestamptz not null default now(),
  unique(club_id,name),
  unique(id,club_id)
);

create table public.player_positions (
  player_id uuid not null references public.players(id) on delete cascade,
  position text not null check (position in ('BA','ES','AL','AP','P')),
  primary key(player_id,position)
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  round_number smallint not null check (round_number > 0),
  opponent text not null,
  is_home boolean not null default true,
  starts_at timestamptz,
  ended_at timestamptz,
  status text not null default 'scheduled'
    check(status in ('scheduled','in_progress','awaiting_stats','awaiting_votes','finalized','postponed','cancelled')),
  stats_finalized_at timestamptz,
  votes_finalized_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or starts_at is null or ended_at >= starts_at),
  unique(season_id,round_number)
);

create table public.market_prices (
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  price integer not null check(price >= 0),
  updated_at timestamptz not null default now(),
  primary key(season_id,player_id)
);

create table public.price_history (
  id bigint generated always as identity primary key,
  season_id uuid not null references public.seasons(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  round_number smallint not null check(round_number >= 0),
  price_before integer not null check(price_before >= 0),
  price_after integer not null check(price_after >= 0),
  change_reason text not null,
  recorded_at timestamptz not null default now(),
  unique(season_id,player_id,round_number)
);

create table public.fantasy_teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(name) between 2 and 40),
  cash integer not null check(cash >= 0),
  created_at timestamptz not null default now(),
  unique(season_id,user_id)
);

create table public.team_rosters (
  team_id uuid not null references public.fantasy_teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  purchase_price integer not null check (purchase_price >= 0),
  acquired_at timestamptz not null default now(),
  primary key(team_id,player_id)
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.fantasy_teams(id) on delete cascade,
  round_number smallint not null check(round_number > 0),
  sold_player_id uuid not null references public.players(id),
  bought_player_id uuid not null references public.players(id),
  sale_price integer not null check(sale_price >= 0),
  purchase_price integer not null check(purchase_price >= 0),
  executed_at timestamptz not null default now(),
  check(sold_player_id <> bought_player_id)
);

create table public.game_stats (
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  minutes numeric(5,2) check(minutes >= 0),
  points integer not null default 0,
  rebounds integer not null default 0,
  assists integer not null default 0,
  steals integer not null default 0,
  blocks integer not null default 0,
  turnovers integer not null default 0,
  pir numeric(8,2),
  fantasy_points numeric(9,2),
  source_format text check (source_format in ('csv','xlsx','pdf','manual')),
  revised_at timestamptz not null default now(),
  primary key(fixture_id,player_id)
);

-- A player-to-auth mapping is deliberately private to avoid exposing athletes' login identities.
create table public.player_accounts (
  player_id uuid primary key references public.players(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade
);

create table public.eligible_voters (
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key(fixture_id,user_id)
);

create table public.locker_votes (
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_player_id uuid not null references public.players(id),
  points smallint not null check(points in (1,2,3)),
  cast_at timestamptz not null default now(),
  primary key(fixture_id,voter_user_id,points),
  unique(fixture_id,voter_user_id,recipient_player_id),
  foreign key(fixture_id,voter_user_id)
    references public.eligible_voters(fixture_id,user_id) on delete cascade
);

create table public.team_round_scores (
  team_id uuid not null references public.fantasy_teams(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  fantasy_points numeric(10,2) not null,
  finalized_at timestamptz not null default now(),
  primary key(team_id,fixture_id)
);

create index on public.club_memberships(user_id);
create index on public.seasons(club_id);
create index on public.players(club_id);
create index on public.fixtures(season_id,starts_at);
create index on public.market_prices(player_id);
create index on public.price_history(player_id,recorded_at);
create index on public.fantasy_teams(user_id);
create index on public.transfers(team_id,round_number);
create index on public.game_stats(player_id);
create index on public.team_round_scores(fixture_id);

-- No guest access; real participants need authentication and membership.
alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.club_memberships enable row level security;
alter table public.seasons enable row level security;
alter table public.players enable row level security;
alter table public.player_positions enable row level security;
alter table public.fixtures enable row level security;
alter table public.market_prices enable row level security;
alter table public.price_history enable row level security;
alter table public.fantasy_teams enable row level security;
alter table public.team_rosters enable row level security;
alter table public.transfers enable row level security;
alter table public.game_stats enable row level security;
alter table public.player_accounts enable row level security;
alter table public.eligible_voters enable row level security;
alter table public.locker_votes enable row level security;
alter table public.team_round_scores enable row level security;

create policy clubs_read on public.clubs for select to authenticated using (private.is_member(id));
create policy profile_self_read on public.profiles for select to authenticated using(id = (select auth.uid()));
create policy membership_self_or_admin_read on public.club_memberships for select to authenticated
 using (user_id = (select auth.uid()) or private.is_admin(club_id));
create policy seasons_read on public.seasons for select to authenticated using(private.is_member(club_id));
create policy players_read on public.players for select to authenticated using(private.is_member(club_id));
create policy player_positions_read on public.player_positions for select to authenticated
 using(exists(select 1 from public.players p where p.id = player_id and private.is_member(p.club_id)));
create policy fixtures_read on public.fixtures for select to authenticated
 using(exists(select 1 from public.seasons s where s.id = season_id and private.is_member(s.club_id)));
create policy prices_read on public.market_prices for select to authenticated
 using(exists(select 1 from public.seasons s where s.id = season_id and private.is_member(s.club_id)));
create policy price_history_read on public.price_history for select to authenticated
 using(exists(select 1 from public.seasons s where s.id = season_id and private.is_member(s.club_id)));
create policy teams_owner_read on public.fantasy_teams for select to authenticated using(user_id = (select auth.uid()));
create policy rosters_owner_read on public.team_rosters for select to authenticated
 using(exists(select 1 from public.fantasy_teams t where t.id = team_id and t.user_id = (select auth.uid())));
create policy transfers_owner_read on public.transfers for select to authenticated
 using(exists(select 1 from public.fantasy_teams t where t.id = team_id and t.user_id = (select auth.uid())));
create policy stats_members_read on public.game_stats for select to authenticated
 using(exists(select 1 from public.fixtures f join public.seasons s on s.id = f.season_id
 where f.id = fixture_id and private.is_member(s.club_id)));
create policy player_account_self_read on public.player_accounts for select to authenticated using(user_id = (select auth.uid()));
create policy voters_self_read on public.eligible_voters for select to authenticated using(user_id = (select auth.uid()));
create policy locker_votes_self_read on public.locker_votes for select to authenticated using(voter_user_id = (select auth.uid()));
create policy round_scores_owner_read on public.team_round_scores for select to authenticated
 using(exists(select 1 from public.fantasy_teams t where t.id = team_id and t.user_id = (select auth.uid())));

-- Intentionally no INSERT, UPDATE or DELETE policy: client-side mutations are denied.
-- Future transactions should happen through audited RPCs with membership and clock checks.
commit;
