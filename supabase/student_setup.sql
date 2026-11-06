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
-- Also remove stale overloads left behind by earlier versions of this script
-- (e.g. the 3-arg classroom_user_id/plain_access_code variant, which used
-- unqualified crypt/gen_salt and never created the auth stub).
drop function if exists public.create_student_profile(text, text);
drop function if exists public.create_student_profile(uuid, text, text);
drop function if exists public.create_student_profile(text, text, uuid);
drop function if exists public.reset_student_code(uuid, text);
drop function if exists public.reset_student_code(uuid, text, text);
drop function if exists public.delete_student(uuid);
-- The output columns are named student_id/student_name on purpose: naming
-- them id/username would shadow the profiles columns of the same name inside
-- the body and make "on conflict (id)" raise 'column reference "id" is
-- ambiguous'.
-- The access code is kept both as a bcrypt hash (for login verification) and
-- pgp-encrypted (so staff can reveal it later). The encryption key comes from
-- the security-definer code_encryption_key RPC below; the where-clause filter
-- keeps every staff helper scoped to student profiles only.
create or replace function public.create_student_profile(first_name text, access_code text)
returns table (student_id uuid, student_name text)
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

  if exists (select 1 from public.profiles p where lower(p.username) = lower(clean_name)) then
    raise exception 'A profile with that name already exists';
  end if;

  stub_email := lower(replace(clean_name, ' ', '-')) || '.student@pixelstechlab.local';

  -- Reuse an orphaned auth stub left behind by a previously failed attempt
  -- instead of erroring; only refuse when a usable profile already exists.
  select au.id into stub_id
  from auth.users au
  where lower(au.email) = stub_email;

  if stub_id is not null and exists (
    select 1 from public.profiles p where p.id = stub_id
  ) then
    raise exception 'A profile with that name already exists';
  end if;

  if stub_id is null then
    stub_id := gen_random_uuid();

    -- Password-less child account: the access code is the credential, not this
    -- hash. The student is never given this email or password.
    insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    values (
      stub_id,
      stub_email,
      extensions.crypt(md5(random()::text) || md5(clock_timestamp()::text), extensions.gen_salt('bf')),
      now(), now(), now()
    );
  end if;

  begin
    -- Upsert: a database-level on_auth_user_created trigger may have already
    -- provisioned a profile row for the new auth stub. Fill in the rest.
    insert into public.profiles (id, username, role, access_code_hash, access_code_encrypted)
    values (stub_id, clean_name, 'computer',
            extensions.crypt(access_code, extensions.gen_salt('bf')),
            extensions.pgp_sym_encrypt(access_code, public.code_encryption_key()))
    on conflict (id) do update
      set username = excluded.username,
          role = excluded.role,
          access_code_hash = excluded.access_code_hash,
          access_code_encrypted = excluded.access_code_encrypted;
  exception
    when unique_violation then
      raise exception 'A profile with that name already exists';
    when others then
      delete from auth.users au where au.id = stub_id;
      raise;
  end;

  return query select stub_id, clean_name;
end;
$$;

-- 2) Reset a student's access code.
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
  set access_code_hash = extensions.crypt(new_code, extensions.gen_salt('bf')),
      access_code_encrypted = extensions.pgp_sym_encrypt(new_code, public.code_encryption_key())
  where id = student_id and role = 'computer';
end;
$$;

-- 3) Remove a student. Deleting the auth.users stub cascades to the profile,
--    wallet, inventory and purchases. Only the auto-generated stub email is
--    touched, so accounts claimed by a real student login are never deleted.
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

-- 4) Shared encryption key for the reversible copy of access codes. Defined as
--    a function instead of a table/column so it never appears in any SELECT *,
--    dump of the profiles table or RLS-visible row. Edit the literal once per
--    deployment (any long random string). Changing it later invalidates every
--    stored encrypted code until each one is reset with reset_student_code.
create or replace function public.code_encryption_key()
returns text
language sql
security definer
set search_path = public
as $$
  select 'CHANGE-ME-pixelings-code-key-9f2b7c4e';
$$;
revoke all on function public.code_encryption_key() from anon, authenticated;

-- Ensure pgcrypto (pgp_sym_encrypt / pgp_sym_decrypt) is available.
create extension if not exists pgcrypto with schema extensions;

-- 5) Reveal a student's login code. Staff-only: returns the decrypted access
--    code, or null when the profile predates the encrypted column (reset the
--    code once to store a revealable copy).
create or replace function public.get_student_code(student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  decrypted text;
begin
  if not public.is_moderator() then
    raise exception 'Only teachers can view access codes';
  end if;

  select extensions.pgp_sym_decrypt(access_code_encrypted, public.code_encryption_key())
    into decrypted
  from public.profiles
  where id = student_id and role = 'computer';

  return decrypted;
end;
$$;

-- 6) Reset the shared classroom password. The classroom email is the "front
--    door" every kid signs in through, so when it is compromised the teacher
--    needs a staff-only way to set a new one. Only a caller who is already
--    authenticated as that classroom account (or a staff member) can change a
--    password, because Supabase auth.users passwords are bcrypt-hashed and
--    cannot be updated through plain SQL by design. Instead of trying to write
--    to auth.users directly, this helper returns the classroom email so the
--    staff UI can trigger Supabase Auth's password update for the session.
create or replace function public.get_classroom_email()
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from auth.users
  where id = auth.uid();
$$;
