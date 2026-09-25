begin;

-- Drop the old private functions
drop function if exists private.claim_outbox_tasks(integer);
drop function if exists private.complete_outbox_task(uuid);

-- Recreate them in the public schema so PostgREST can route to them
-- but secure them so ONLY the service_role can call them.

create function public.claim_outbox_tasks(p_limit integer default 50)
returns table(id uuid, kind text, record_id uuid)
language sql volatile security definer set search_path='' as $$
  update private.outbox
  set lock_until = now() + interval '5 minutes', attempts = attempts + 1
  where id in (
    select id from private.outbox
    where completed_at is null and due_at <= now() and (lock_until is null or lock_until <= now())
    order by due_at
    limit p_limit
    for update skip locked
  )
  returning id, kind, record_id;
$$;

create function public.complete_outbox_task(p_task_id uuid)
returns void
language sql volatile security definer set search_path='' as $$
  update private.outbox
  set completed_at = now(), lock_until = null
  where id = p_task_id;
$$;

-- Secure them: nobody can call them by default
revoke all on function public.claim_outbox_tasks(integer) from public, anon, authenticated;
revoke all on function public.complete_outbox_task(uuid) from public, anon, authenticated;

-- Only the server process with the secret Service Role Key can call them
grant execute on function public.claim_outbox_tasks(integer) to service_role;
grant execute on function public.complete_outbox_task(uuid) to service_role;

commit;
