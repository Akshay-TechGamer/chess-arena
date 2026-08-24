-- Migration: initial schema
-- Created: 2026-08-24
-- Tables: profiles, games, moves. RLS on from day 1.

-- ============================================================
-- profiles: one row per auth user (guest or Google)
-- ============================================================
create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	username text not null unique check (char_length(username) between 3 and 20),
	elo_rating integer not null default 1200,
	games_played integer not null default 0,
	created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by everyone"
	on public.profiles for select
	using (true);

create policy "users can insert their own profile"
	on public.profiles for insert
	with check (auth.uid() = id);

create policy "users can update their own profile"
	on public.profiles for update
	using (auth.uid() = id);

-- ============================================================
-- games: one row per game (online or vs computer)
-- ============================================================
create type public.game_status as enum ('waiting', 'active', 'finished', 'aborted');
create type public.game_result as enum ('white_win', 'black_win', 'draw');
create type public.game_mode as enum ('online', 'computer');

create table public.games (
	id uuid primary key default gen_random_uuid(),
	mode public.game_mode not null default 'online',
	status public.game_status not null default 'waiting',
	result public.game_result,
	result_reason text, -- checkmate, resignation, timeout, draw agreement, abandonment
	white_id uuid references public.profiles (id),
	black_id uuid references public.profiles (id),
	-- invite_code: short code friends use to join (null once game starts)
	invite_code text unique,
	-- time control in seconds + increment per move in seconds
	time_control_secs integer not null default 600,
	increment_secs integer not null default 0,
	-- current position; source of truth for resume
	fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
	pgn text not null default '',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index games_white_id_idx on public.games (white_id);
create index games_black_id_idx on public.games (black_id);
create index games_status_idx on public.games (status);

alter table public.games enable row level security;

-- Anyone can watch any game (spectator mode is free this way)
create policy "games are readable by everyone"
	on public.games for select
	using (true);

create policy "authenticated users can create games"
	on public.games for insert
	with check (auth.uid() = white_id or auth.uid() = black_id);

-- Players update via edge functions (service role) in later phases;
-- direct update limited to participants for now.
create policy "players can update their own games"
	on public.games for update
	using (auth.uid() = white_id or auth.uid() = black_id);

-- ============================================================
-- moves: one row per half-move (ply). Insert triggers Realtime.
-- ============================================================
create table public.moves (
	id bigint generated always as identity primary key,
	game_id uuid not null references public.games (id) on delete cascade,
	ply integer not null, -- 1 = white's first move, 2 = black's reply, ...
	san text not null,    -- e.g. 'Nf3'
	fen_after text not null,
	-- clock state AFTER this move, for server-authoritative timing
	white_ms_left integer not null,
	black_ms_left integer not null,
	created_at timestamptz not null default now(),
	unique (game_id, ply)
);

create index moves_game_id_idx on public.moves (game_id);

alter table public.moves enable row level security;

create policy "moves are readable by everyone"
	on public.moves for select
	using (true);

create policy "players can insert moves in their games"
	on public.moves for insert
	with check (
		exists (
			select 1 from public.games g
			where g.id = game_id
			  and g.status = 'active'
			  and (g.white_id = auth.uid() or g.black_id = auth.uid())
		)
	);

-- ============================================================
-- updated_at trigger for games
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger games_set_updated_at
	before update on public.games
	for each row
	execute function public.set_updated_at();

-- ============================================================
-- Realtime: broadcast inserts on moves + updates on games
-- ============================================================
alter publication supabase_realtime add table public.moves;
alter publication supabase_realtime add table public.games;
