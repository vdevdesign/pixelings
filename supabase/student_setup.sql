-- Student setup for Pixelings.
-- Run this in the Supabase SQL Editor after schema.sql.
--
-- Adds the teacher-side RPCs the Student Manager UI expects:
--   * create_student_profile(first_name, access_code)  -> creates a child profile
--   * reset_student_code(student_id, new_code)         -> re-hash an access code
--   * delete_student(student_id)                       -> remove a child profile
--
-- All three are security definer and restricted to teachers/moderators via
-- public.is_moderator(), so students can never create or tamper with accounts.

-- 1) Create a student (child account).
--    Each student needs a matching auth.users row because profiles.id,
--    stardust_wallets.user_id and stardust_inventory.user_id all reference it.
--    The teacher logs in the child with the shared classroom email + access
--    code, so the auth stub gets a random password the student never sees.
-- Drop first so a re-run can safely change a function's return type.
drop function if exists public.create_student_profile(text, text);
create or replace function public.create_student_profile(first_name text, access_code text)
returns table (id uuid, username text)
language plpgsql security definer set search_path = public
as $$
declare
  clean_name text;
  stub_email text;
  stub_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'Only teachers can add students';
  end if;

  clean_name := trim(first_name);
  if clean_name is null or char_length(clean_name) not between 1 and 24
     or clean_name !~ '^[A-Za-z][A-Za-z0-9 _-]*$' then
    raise exception 'Name must be 1-24 letters/numbers and start with a letter';
  end if;

  if access_code is null or char_length(access_code) not between 4 and 12
     or access_code !~ '^[0-9]+$' then
    raise exception 'Access code must be 4-12 digits';
  end if;

  if exists (select 1 from public.profiles where lower(username) = lower(clean_name)) then
    raise exception 'A profile with that name already exists';
  end if;

  stub_email := lower(replace(clean_name, ' ', '-')) || '.student@pixelstechlab.local';

  if exists (select 1 from auth.users where lower(email) = stub_email) then
    raise exception 'An auth account for that student already exists';
  end if;

  stub_id := gen_random_uuid();

  -- Password-less child account: the access code is the credential, not this
  -- hash. The student is never given this email or password.
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (
    stub_id,
    stub_email,
    crypt(md5(random()::text) || md5(clock_timestamp()::text), gen_salt('bf')),
    now(), now(), now()
  );

  begin
    insert into public.profiles (id, username, role, access_code_hash)
    values (stub_id, clean_name, 'computer', crypt(access_code, gen_salt('bf')));
  exception when others then
    delete from auth.users where id = stub_id;
    raise;
  end;

  return query select stub_id, clean_name;
end;
$$;

-- 2) Reset a student's access code.
drop function if exists public.reset_student_code(uuid, text);
create or replace function public.reset_student_code(student_id uuid, new_code text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Only teachers can reset access codes';
  end if;

  if new_code is null or char_length(new_code) not between 4 and 12
     or new_code !~ '^[0-9]+$' then
    raise exception 'Access code must be 4-12 digits';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = student_id and role = 'computer'
  ) then
    raise exception 'Student not found';
  end if;

  update public.profiles
  set access_code_hash = crypt(new_code, gen_salt('bf'))
  where id = student_id and role = 'computer';
end;
$$;

-- 3) Remove a student. Deleting the auth.users stub cascades to the profile,
--    wallet, inventory and purchases. Only the auto-generated stub email is
--    touched, so accounts claimed by a real student login are never deleted.
drop function if exists public.delete_student(uuid);
create or replace function public.delete_student(student_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  stub_email text;
begin
  if not public.is_moderator() then
    raise exception 'Only teachers can remove students';
  end if;

  select lower(email) into stub_email
  from auth.users
  where id = student_id
    and lower(email) like '%.student@pixelstechlab.local';

  if not exists (
    select 1 from public.profiles
    where id = student_id and role = 'computer'
  ) then
    raise exception 'Student not found';
  end if;

  if stub_email is not null then
    delete from auth.users where id = student_id and lower(email) = stub_email;
  else
    -- No stub behind this profile (e.g. legacy child account): remove the
    -- profile row directly; the cascade handles wallet/inventory.
    delete from public.profiles where id = student_id and role = 'computer';
  end if;
end;
$$;
