# NORVI — Database Cheat Sheet & Role Testing

This document contains useful SQL commands to easily manipulate your Supabase database during testing and development. You can copy and paste these commands directly into your **Supabase SQL Editor**. 

Always replace `'your.email@example.com'` with the actual email address of the account you want to modify!

---

## 1. Staff & Admin Roles

By default, any new account created on your website is a standard **Customer**. To give an account admin dashboard access, you must assign them a staff role.

### Give an account the "Owner" role
This is the highest level of access. Owners bypass all restrictions.
```sql
insert into public.staff_memberships (user_id, role, active)
values (
  (select id from auth.users where email = 'your.email@example.com'),
  'owner',
  true
);
```

### Give an account the "Support" role
This role can view customer licenses, view orders, and handle support tickets, but cannot edit products or view global financial metrics.
```sql
insert into public.staff_memberships (user_id, role, active)
values (
  (select id from auth.users where email = 'your.email@example.com'),
  'support',
  true
);
```

### Give an account the "Product Manager" role
This role is specifically for editing the catalog, writing product descriptions, and uploading releases.
```sql
insert into public.staff_memberships (user_id, role, active)
values (
  (select id from auth.users where email = 'your.email@example.com'),
  'product_manager',
  true
);
```

---

## 2. Customer Licenses (Bypass Purchasing)

Since the Razorpay webhook is paused, a customer cannot "buy" an agent right now in Live mode. If you want to test the download button or device activation from the Customer perspective, you can instantly inject a free active license into their account!

### Give a customer a free Voro license (Bypasses checkout completely)
Because your database is highly secure, it mathematically rejects licenses if there is no valid purchase order. This script safely generates a fake order and bypasses it!

```sql
do $$
declare
  v_user_id uuid;
  v_product_id uuid := '00000000-0000-4000-8000-000000000002'; -- Voro ID
  v_price_id uuid;
  v_order_id uuid;
  v_license_id uuid;
begin
  -- 1. Get the user (REPLACE THIS EMAIL!)
  select id into v_user_id from auth.users where email = 'your.email@gmail.com';
  
  if v_user_id is null then
    raise exception 'The email address does not exist in the database! Make sure you created an account on the website first.';
  end if;
  
  -- 2. Create a dummy price to satisfy the database rules (must be > 0)
  insert into public.prices (product_id, amount_minor, currency, active, billing_type)
  values (v_product_id, 1, 'INR', true, 'one_time')
  returning id into v_price_id;

  -- 3. Create a paid dummy order
  insert into public.orders (user_id, product_id, price_id, amount_minor, currency, status, idempotency_key)
  values (v_user_id, v_product_id, v_price_id, 1, 'INR', 'paid', 'gift_' || gen_random_uuid())
  returning id into v_order_id;

  -- 4. Create the active license
  insert into public.licenses (user_id, product_id, order_id, key_suffix, status)
  values (v_user_id, v_product_id, v_order_id, 'GIFT', 'active')
  returning id into v_license_id;
  
  -- 5. Generate the backend security secret so it shows up in the UI properly
  insert into private.license_secrets (license_id, key_hash, encrypted_key, encryption_key_version)
  values (v_license_id, 'test_hash_' || v_license_id, 'test_encrypted', 1);
end;
$$;
```

---

## 3. Manually Confirm an Email Address
If you registered on the website but didn't receive the confirmation email (usually because your Resend account is in "Sandbox mode" and can only send emails to yourself), you can forcefully confirm the email using this SQL:

```sql
update auth.users 
set email_confirmed_at = now() 
where email = 'gopal2nd5654@gmail.com';
```

---

## 4. Manually Create an Account (If Website Registration Fails)

If the website throws a registration error (this happens often during testing because Supabase limits signups from the same IP address), you can forcefully create a user account directly in the database! 

*Note: The password will be set to `NorviPassword123!`*

```sql
do $$
declare
  v_new_user_id uuid := gen_random_uuid();
  v_email text := 'gopal.customer@gmail.com'; -- REPLACE THIS WITH YOUR EMAIL!
begin
  -- Insert directly into Supabase's hidden auth schema
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_new_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    v_email, 
    crypt('NorviPassword123!', gen_salt('bf')), -- Creates a secure hashed password
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{"name":"Testing Account"}', 
    now(), now()
  );

  -- NOTE: Your database trigger (create_customer_profile) will automatically 
  -- create the public.profiles row when this insert happens!
end;
$$;
```

---

## 5. Account Reset & Cleanup

### Remove a staff role (Demote back to Customer)
If you want to completely remove a user's admin access so they are just a regular customer again:
```sql
delete from public.staff_memberships 
where user_id = (select id from auth.users where email = 'your.email@example.com');
```
