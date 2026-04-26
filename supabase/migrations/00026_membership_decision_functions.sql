create or replace function public.approve_membership_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  caller_role text;
begin
  -- Verify caller is admin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role <> 'admin' then
    raise exception 'Only admins can approve' using errcode = 'P0001';
  end if;

  -- Lock and fetch the request
  select * into req
  from public.membership_requests
  where id = request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'Request not found or not pending' using errcode = 'P0002';
  end if;

  -- Update request and flip role atomically
  update public.membership_requests
     set status = 'approved',
         decided_at = now(),
         decided_by = auth.uid()
   where id = request_id;

  update public.profiles
     set role = 'member'
   where id = req.user_id;
end;
$$;

create or replace function public.reject_membership_request(
  request_id      uuid,
  rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role <> 'admin' then
    raise exception 'Only admins can reject' using errcode = 'P0001';
  end if;

  update public.membership_requests
     set status = 'rejected',
         decided_at = now(),
         decided_by = auth.uid(),
         reason = rejection_reason
   where id = request_id and status = 'pending';

  if not found then
    raise exception 'Request not found or not pending' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function public.approve_membership_request(uuid) to authenticated;
grant execute on function public.reject_membership_request(uuid, text) to authenticated;
