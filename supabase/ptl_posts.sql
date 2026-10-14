-- PTL News and Tales posts.
-- Run this in the Supabase SQL Editor after the main schema.sql.

create table if not exists public.ptl_posts (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('news', 'tales')),
  title text not null check (char_length(trim(title)) between 1 and 140),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  image_path text,
  image_alt text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists ptl_posts_section_published_idx
  on public.ptl_posts(section, published_at desc);

create or replace function public.touch_ptl_post()
returns trigger language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_ptl_post_before_update on public.ptl_posts;
create trigger touch_ptl_post_before_update
  before update on public.ptl_posts
  for each row execute function public.touch_ptl_post();

alter table public.ptl_posts enable row level security;

create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

drop policy if exists "Authenticated users can view PTL posts" on public.ptl_posts;
create policy "Authenticated users can view PTL posts"
  on public.ptl_posts for select to authenticated using (true);

drop policy if exists "Teachers can create PTL posts" on public.ptl_posts;
create policy "Teachers can create PTL posts"
  on public.ptl_posts for insert to authenticated
  with check (public.is_teacher() and created_by = auth.uid());

drop policy if exists "Teachers can update PTL posts" on public.ptl_posts;
create policy "Teachers can update PTL posts"
  on public.ptl_posts for update to authenticated
  using (public.is_teacher())
  with check (public.is_teacher() and updated_by = auth.uid());

drop policy if exists "Teachers can delete PTL posts" on public.ptl_posts;
create policy "Teachers can delete PTL posts"
  on public.ptl_posts for delete to authenticated using (public.is_teacher());

-- A public bucket lets visitors load images through their public URLs, while
-- writes and removals remain teacher-only through the policies below.
insert into storage.buckets (id, name, public)
values ('ptl-post-images', 'ptl-post-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Anyone can view PTL post images" on storage.objects;
create policy "Anyone can view PTL post images"
  on storage.objects for select using (bucket_id = 'ptl-post-images');

drop policy if exists "Teachers can upload PTL post images" on storage.objects;
create policy "Teachers can upload PTL post images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'ptl-post-images' and public.is_teacher());

drop policy if exists "Teachers can replace PTL post images" on storage.objects;
create policy "Teachers can replace PTL post images"
  on storage.objects for update to authenticated
  using (bucket_id = 'ptl-post-images' and public.is_teacher())
  with check (bucket_id = 'ptl-post-images' and public.is_teacher());

drop policy if exists "Teachers can remove PTL post images" on storage.objects;
create policy "Teachers can remove PTL post images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'ptl-post-images' and public.is_teacher());

-- Starter posts. Remove these two inserts if you want the sections to start empty.
insert into public.ptl_posts (section, title, body, image_alt)
select 'news', 'Welcome to the new Pixelings lounge',
  'Chat, share what you are building, and keep an eye on this space for new lab updates.',
  'Pixelings lounge'
where not exists (select 1 from public.ptl_posts where section = 'news');

insert into public.ptl_posts (section, title, body, image_alt)
select 'tales', 'Show the messy, clever, human side of making things.',
  'Tales can feature a Pixelings project, a quick lesson learned, an interview, or a peek at how something in the lab came together.',
  'Tech Lab story spotlight'
where not exists (select 1 from public.ptl_posts where section = 'tales');
