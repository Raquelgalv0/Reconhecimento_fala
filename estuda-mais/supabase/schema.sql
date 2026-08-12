-- Esquema do Estuda+ — rode isto UMA VEZ no SQL Editor do seu projeto Supabase
-- (painel do projeto → SQL Editor → New query → cole tudo → Run).
-- É seguro rodar de novo (usa "if not exists" e recria as políticas).

-- ---------- profiles (1 linha por usuário: perfil + onboarding) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  modes text[] not null default '{}',
  name text not null default '',
  study_area text not null default '',
  level text not null default '',
  daily_time_minutes int,
  onboarded boolean not null default false,
  daily_goal int not null default 10
);

-- ---------- folders ----------
create table if not exists folders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  parent_id text references folders(id) on delete cascade,
  kind text not null default 'pasta',
  mode text
);
-- Garante as colunas em bancos que já tinham a tabela criada antes desta versão.
alter table folders add column if not exists kind text not null default 'pasta';
alter table folders add column if not exists mode text;

-- ---------- summaries ----------
create table if not exists summaries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  folder_id text references folders(id) on delete cascade,
  title text not null default 'Sem título',
  content_html text not null default '',
  page_style text not null default 'minimal',
  font_family text not null default 'padrao',
  line_spacing text not null default 'media',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Garante as colunas em bancos que já tinham a tabela criada antes desta versão.
alter table summaries add column if not exists font_family text not null default 'padrao';
alter table summaries add column if not exists line_spacing text not null default 'media';

-- ---------- flashcards ----------
create table if not exists flashcards (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  folder_id text references folders(id) on delete cascade,
  front text not null,
  back text not null,
  hint text not null default '',
  summary_id text references summaries(id) on delete set null,
  created_at timestamptz not null default now(),
  srs jsonb not null default '{}'::jsonb
);

-- ---------- questions ----------
create table if not exists questions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  folder_id text references folders(id) on delete cascade,
  statement text not null,
  alternatives jsonb not null default '[]'::jsonb,
  correct_id text not null,
  institution text not null default '',
  year int,
  difficulty text not null default 'medio',
  favorite boolean not null default false,
  comment text,
  created_at timestamptz not null default now()
);

-- ---------- question_attempts ----------
create table if not exists question_attempts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  question_id text references questions(id) on delete cascade,
  chosen_id text not null,
  correct boolean not null,
  at timestamptz not null default now()
);

-- ---------- daily_log (1 linha por usuário por dia) ----------
create table if not exists daily_log (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  day date not null,
  total int not null default 0,
  correct int not null default 0,
  minutes int not null default 0,
  primary key (user_id, day)
);

-- ---------- checklists (calendário do painel + metas do dia/semana/mês) ----------
-- period: 'day' | 'week' | 'month'. period_key: '2026-08-09' | '2026-W32' | '2026-08'.
create table if not exists checklists (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  period text not null,
  period_key text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, period, period_key)
);

-- ---------- city_buildings (cidade de foco: 1 casa por sessão concluída) ----------
create table if not exists city_buildings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null default 'casa1',
  minutes int not null default 0,
  built_at timestamptz not null default now()
);

-- ---------- RLS: cada usuário só acessa suas próprias linhas ----------
alter table profiles enable row level security;
alter table folders enable row level security;
alter table summaries enable row level security;
alter table flashcards enable row level security;
alter table questions enable row level security;
alter table question_attempts enable row level security;
alter table daily_log enable row level security;
alter table checklists enable row level security;
alter table city_buildings enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own folders" on folders;
create policy "own folders" on folders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own summaries" on summaries;
create policy "own summaries" on summaries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own flashcards" on flashcards;
create policy "own flashcards" on flashcards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own questions" on questions;
create policy "own questions" on questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own question_attempts" on question_attempts;
create policy "own question_attempts" on question_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own daily_log" on daily_log;
create policy "own daily_log" on daily_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own checklists" on checklists;
create policy "own checklists" on checklists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own city_buildings" on city_buildings;
create policy "own city_buildings" on city_buildings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
