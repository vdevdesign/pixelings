insert into public.sessions (name, status)
select 'Teacher Lounge', 'live'
where not exists (select 1 from public.sessions where name = 'Teacher Lounge');
