# Supabase Manual Tasks Guide

This guide provides the direct SQL commands you can run in your Supabase SQL Editor to manage your platform manually without using the admin UI.

## 1. Manage Team Members

### Invite a new Team Member
*Note: The user must first register an account on the website.*
```sql
-- Replace the email and role ('support', 'product_manager', or 'administrator')
insert into public.staff_memberships (user_id, role, active)
select id, 'support', true 
from public.profiles 
where email = 'teammate@example.com';
```

### Promote a Team Member's Rank
```sql
-- Change the role to 'administrator' or 'owner'
update public.staff_memberships 
set role = 'administrator' 
where user_id = (select id from public.profiles where email = 'teammate@example.com');
```

### Suspend or Remove a Team Member
```sql
-- Temporarily suspend access
update public.staff_memberships 
set active = false 
where user_id = (select id from public.profiles where email = 'teammate@example.com');

-- Or permanently delete the staff role
delete from public.staff_memberships 
where user_id = (select id from public.profiles where email = 'teammate@example.com');
```

## 2. Manage Customer Access (Licenses & Orders)

### Manually Give a Customer a License (Bypassing Payment)
*Note: The user must already have registered an account.*
```sql
begin;
do $$
declare
  v_user_id uuid;
  v_product_id uuid;
  v_order_id uuid;
  v_license_id uuid;
begin
  -- 1. Find the User
  select id into v_user_id from public.profiles where email = 'customer@example.com';
  
  -- 2. Find the Product (Change 'omnix' to your product slug)
  select id into v_product_id from public.products where slug = 'omnix';

  -- 3. Create a zero-dollar manual order
  insert into public.orders (user_id, product_id, status, amount, currency, external_id)
  values (v_user_id, v_product_id, 'completed', 0, 'USD', 'manual_grant')
  returning id into v_order_id;

  -- 4. Generate the License (the key will be generated securely by the database)
  insert into public.licenses (user_id, product_id, order_id, status)
  values (v_user_id, v_product_id, v_order_id, 'active')
  returning id into v_license_id;

  -- 5. Issue the Key
  perform private.issue_license_key(v_license_id);
end;
$$;
commit;
```

### Revoke a Customer's License
```sql
update public.licenses 
set status = 'revoked' 
where user_id = (select id from public.profiles where email = 'customer@example.com')
  and product_id = (select id from public.products where slug = 'omnix');

-- Clear their active devices so their software stops working immediately
delete from public.devices 
where license_id in (
  select id from public.licenses 
  where user_id = (select id from public.profiles where email = 'customer@example.com')
);
```

### Rotate a Customer's Key (Generate a new one)
```sql
-- This calls the secure internal function to cycle the key
select private.issue_license_key(id) 
from public.licenses 
where user_id = (select id from public.profiles where email = 'customer@example.com')
  and product_id = (select id from public.products where slug = 'omnix');
```

## 3. Manage Customer Accounts

### Permanently Delete a Customer Account
*Note: If the customer has active orders, this will delete all their data, including licenses.*
```sql
delete from auth.users 
where email = 'customer@example.com';
-- Due to foreign key cascading, this will automatically wipe their profile, orders, and licenses.
```

### Suspend a Customer Account (Ban)
```sql
update public.profiles 
set suspended = true 
where email = 'customer@example.com';
```

## 4. How to View and Search Logs in Supabase

Supabase stores internal logs in a secure table. Here is how you can read and search through them using the SQL Editor.

### View the Latest 50 Logs
```sql
select a.created_at, p.email as actor, a.action, a.target_id 
from private.audit_log a
left join public.profiles p on p.id = a.actor_id
order by a.created_at desc
limit 50;
```

### Search Logs by a Specific Action (e.g., finding revoked licenses)
```sql
select a.created_at, p.email as actor, a.action, a.target_id 
from private.audit_log a
left join public.profiles p on p.id = a.actor_id
where a.action like '%revoked%'
order by a.created_at desc;
```

### Search Logs by a Specific Admin's Email
```sql
select a.created_at, p.email as actor, a.action, a.target_id 
from private.audit_log a
left join public.profiles p on p.id = a.actor_id
where p.email = 'your-admin@example.com'
order by a.created_at desc;
```
