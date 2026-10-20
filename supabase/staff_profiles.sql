-- Provision teacher and moderator profiles from staff_directory.
-- Run this once in the Supabase SQL Editor for existing staff accounts.

insert into public.profiles (id, username, role)
select u.id, sd.display_name, sd.role
from auth.users u
join public.staff_directory sd on lower(sd.email) = lower(u.email)
where not exists (
  select 1 from public.profiles p where p.id = u.id
)
and not exists (
  select 1 from public.profiles p where p.username = sd.display_name
);

create or replace function public.provision_staff_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  staff public.staff_directory%rowtype;
begin
  select * into staff
  from public.staff_directory
  where lower(email) = lower(new.email);

  if found and not exists (select 1 from public.profiles where id = new.id)
     and not exists (select 1 from public.profiles where username = staff.display_name) then
    insert into public.profiles (id, username, role)
    values (new.id, staff.display_name, staff.role);
  end if;

  return new;
end;
$$;

drop trigger if exists provision_staff_profile_after_signup on auth.users;
create trigger provision_staff_profile_after_signup
  after insert on auth.users
  for each row execute function public.provision_staff_profile();
