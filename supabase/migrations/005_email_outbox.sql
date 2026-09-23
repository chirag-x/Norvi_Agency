begin;

create function private.claim_outbox_tasks(p_limit integer default 50)
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

create function private.complete_outbox_task(p_task_id uuid)
returns void
language sql volatile security definer set search_path='' as $$
  update private.outbox
  set completed_at = now(), lock_until = null
  where id = p_task_id;
$$;

revoke all on function private.claim_outbox_tasks(integer) from public, anon, authenticated;
revoke all on function private.complete_outbox_task(uuid) from public, anon, authenticated;
-- These are intended to be called by a secure background worker using the Service Role Key
grant execute on function private.claim_outbox_tasks(integer) to service_role;
grant execute on function private.complete_outbox_task(uuid) to service_role;

commit;
