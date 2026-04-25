create or replace function public.prevent_last_admin_demotion()
returns trigger
language plpgsql
security definer
as $$
declare
  remaining int;
begin
  if old.role = 'admin' and new.role <> 'admin' then
    select count(*) into remaining
    from public.profiles
    where role = 'admin' and id <> old.id;

    if remaining = 0 then
      raise exception 'Cannot demote the last admin in the system'
        using errcode = 'P0001',
              hint = 'Promote another user to admin first';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_last_admin_demotion on public.profiles;

create trigger profiles_prevent_last_admin_demotion
  before update of role on public.profiles
  for each row
  execute function public.prevent_last_admin_demotion();
