begin;

-- Create the private storage bucket for software releases
insert into storage.buckets (id, name, public) 
values ('releases', 'releases', false)
on conflict (id) do nothing;

-- RLS is automatically enabled by Supabase on storage.objects

-- Policy 1: Verified customers can ONLY download files they have an active license for.
-- We match the requested filename (e.g., 'omnix.zip') to the product's slug in their licenses.
create policy "Customers can download owned agents"
on storage.objects for select to authenticated
using (
  bucket_id = 'releases' and
  exists (
    select 1 from public.licenses l
    join public.products p on p.id = l.product_id
    where l.user_id = auth.uid()
    and l.status = 'active'
    and storage.objects.name = (p.slug || '.zip')
  )
);

-- Policy 2: Staff members (Owner, Admin) can download any release for testing
create policy "Staff can download any release"
on storage.objects for select to authenticated
using (
  bucket_id = 'releases' and
  exists (
    select 1 from public.staff_memberships s 
    where s.user_id = auth.uid() and s.active = true
  )
);

commit;
