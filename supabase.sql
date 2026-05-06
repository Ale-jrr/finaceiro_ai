-- Supabase SQL (prototype)
-- Estado do app por usuário

create table if not exists public.app_user_state (
  user_email text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Usuários de login da aplicação
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password text not null,
  is_admin boolean not null default false,`r`n  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.app_user_state enable row level security;
alter table public.app_users enable row level security;

-- Políticas abertas para protótipo (anon)
drop policy if exists "app_user_state_select_all" on public.app_user_state;
create policy "app_user_state_select_all" on public.app_user_state for select using (true);

drop policy if exists "app_user_state_insert_all" on public.app_user_state;
create policy "app_user_state_insert_all" on public.app_user_state for insert with check (true);

drop policy if exists "app_user_state_update_all" on public.app_user_state;
create policy "app_user_state_update_all" on public.app_user_state for update using (true) with check (true);

drop policy if exists "app_users_select_all" on public.app_users;
create policy "app_users_select_all" on public.app_users for select using (true);

drop policy if exists "app_users_insert_all" on public.app_users;
create policy "app_users_insert_all" on public.app_users for insert with check (true);

drop policy if exists "app_users_update_all" on public.app_users;
create policy "app_users_update_all" on public.app_users for update using (true) with check (true);

drop policy if exists "app_users_delete_all" on public.app_users;
create policy "app_users_delete_all" on public.app_users for delete using (true);


alter table public.app_users add column if not exists is_blocked boolean not null default false;

