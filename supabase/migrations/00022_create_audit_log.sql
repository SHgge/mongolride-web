create table public.audit_log (
  id           bigserial primary key,
  actor_id     uuid references auth.users(id) on delete set null,
  action       text not null,
  target_id    uuid,
  details      jsonb not null default '{}'::jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index audit_log_actor_idx   on public.audit_log(actor_id);
create index audit_log_target_idx  on public.audit_log(target_id);
create index audit_log_action_idx  on public.audit_log(action);
create index audit_log_created_idx on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

-- Admins can read; clients cannot insert/update/delete directly
create policy "audit_log read for admins"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
-- No insert/update/delete policies for client role — service role only
