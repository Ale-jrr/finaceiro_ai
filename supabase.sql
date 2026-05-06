-- Supabase SQL (prototype)
-- Cria tabela para estado do app por usuário

create table if not exists public.app_user_state (
  user_email text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_user_state enable row level security;

-- Politicas abertas para protótipo com chave anon
-- Em produção, troque por políticas baseadas em auth.uid()
drop policy if exists "app_user_state_select_all" on public.app_user_state;
create policy "app_user_state_select_all"
on public.app_user_state
for select
using (true);

drop policy if exists "app_user_state_insert_all" on public.app_user_state;
create policy "app_user_state_insert_all"
on public.app_user_state
for insert
with check (true);

drop policy if exists "app_user_state_update_all" on public.app_user_state;
create policy "app_user_state_update_all"
on public.app_user_state
for update
using (true)
with check (true);
