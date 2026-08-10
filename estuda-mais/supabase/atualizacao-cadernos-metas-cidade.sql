-- Atualização do banco do Estuda+ para as novas funções: Cadernos, Metas/Calendário e Foco (cidade).
-- Rode isto UMA VEZ no SQL Editor do seu projeto Supabase (painel do projeto → SQL Editor → New query → cole tudo → Run).
-- É seguro rodar de novo, mesmo que já tenha rodado antes.

-- Cadernos: coluna nova na tabela de pastas já existente
alter table folders add column if not exists kind text not null default 'pasta';

-- Metas / Calendário: nova tabela de checklists (dia, semana e mês)
create table if not exists checklists (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  period text not null,
  period_key text not null,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, period, period_key)
);

-- Foco: nova tabela da cidade (1 casa por sessão de estudo concluída)
create table if not exists city_buildings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null default 'casa1',
  minutes int not null default 0,
  built_at timestamptz not null default now()
);

alter table checklists enable row level security;
alter table city_buildings enable row level security;

drop policy if exists "own checklists" on checklists;
create policy "own checklists" on checklists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own city_buildings" on city_buildings;
create policy "own city_buildings" on city_buildings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
