-- Migration: initial schema
-- Created: 2026-08-24
-- Tables: chess_profiles, chess_games, chess_moves. RLS on from day 1.
-- NOTE: all objects carry a chess_ prefix because this Supabase project is
-- shared with other apps (wishes, game_rooms, ...). Do not touch their tables.

-- ============================================================
-- chess_profiles: one row per auth user (guest or Google)
-- ============================================================
create table public.chess_profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	username text not null unique check (char_length(username) between 3 and 20),
	elo_rating integer not null default 1200,
	games_played integer not null default 0,
	created_at timestamptz not null default now()
);

alter table public.chess_profiles enable row level security;

create policy "chess profiles are readable by everyone"
	on public.chess_profiles for select
	using (true);

create policy "users can insert their own chess profile"
	on public.chess_profiles for insert
	with check (auth.uid() = id);

create policy "users can update their own chess profile"
	on public.chess_profiles for update
	using (auth.uid() = id);

-- ============================================================
-- chess_games: one row per game (online or vs computer)
-- ============================================================
create type public.chess_game_status as enum ('waiting', 'active', 'finished', 'aborted');
create type public.chess_game_result as enum ('white_win', 'black_win', 'draw');
create type public.chess_game_mode as enum ('online', 'computer');

create table public.chess_games (
	id uuid primary key default gen_random_uuid(),
	mode public.chess_game_mode not null default 'online',
	status public.chess_game_status not null default 'waiting',
	result public.chess_game_result,
	result_reason text, -- checkmate, resignation, timeout, draw agreement, abandonment
	white_id uuid references public.chess_profiles (id),
	black_id uuid references public.chess_profiles (id),
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

create index chess_games_white_id_idx on public.chess_games (white_id);
create index chess_games_black_id_idx on public.chess_games (black_id);
create index chess_games_status_idx on public.chess_games (status);

alter table public.chess_games enable row level security;

-- Anyone can watch any game (spectator mode is free this way)
create policy "chess games are readable by everyone"
	on public.chess_games for select
	using (true);

create policy "authenticated users can create chess games"
	on public.chess_games for insert
	with check (auth.uid() = white_id or auth.uid() = black_id);

-- Players update via edge functions (service role) in later phases;
-- direct update limited to participants for now.
create policy "players can update their own chess games"
	on public.chess_games for update
	using (auth.uid() = white_id or auth.uid() = black_id);

-- ============================================================
-- chess_moves: one row per half-move (ply). Insert triggers Realtime.
-- ============================================================
create table public.chess_moves (
	id bigint generated always as identity primary key,
	game_id uuid not null references public.chess_games (id) on delete cascade,
	ply integer not null, -- 1 = white's first move, 2 = black's reply, ...
	san text not null,    -- e.g. 'Nf3'
	fen_after text not null,
	-- clock state AFTER this move, for server-authoritative timing
	white_ms_left integer not null,
	black_ms_left integer not null,
	created_at timestamptz not null default now(),
	unique (game_id, ply)
);

create index chess_moves_game_id_idx on public.chess_moves (game_id);

alter table public.chess_moves enable row level security;

create policy "chess moves are readable by everyone"
	on public.chess_moves for select
	using (true);

create policy "players can insert moves in their chess games"
	on public.chess_moves for insert
	with check (
		exists (
			select 1 from public.chess_games g
			where g.id = game_id
			  and g.status = 'active'
			  and (g.white_id = auth.uid() or g.black_id = auth.uid())
		)
	);

-- ============================================================
-- updated_at trigger for chess_games
-- ============================================================
create or replace function public.chess_set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger chess_games_set_updated_at
	before update on public.chess_games
	for each row
	execute function public.chess_set_updated_at();

-- ============================================================
-- Realtime: broadcast inserts on chess_moves + updates on chess_games
-- ============================================================
alter publication supabase_realtime add table public.chess_moves;
alter publication supabase_realtime add table public.chess_games;
