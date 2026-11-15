-- Calkie: private, per-account assistant conversation history.
create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_user_created_at_idx
  on public.assistant_messages (user_id, created_at desc);

alter table public.assistant_messages enable row level security;

drop policy if exists "Users can read their own assistant messages" on public.assistant_messages;
create policy "Users can read their own assistant messages"
  on public.assistant_messages for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own assistant messages" on public.assistant_messages;
create policy "Users can add their own assistant messages"
  on public.assistant_messages for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.assistant_messages to authenticated;
