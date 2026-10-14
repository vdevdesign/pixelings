-- Pixelings chat schema. Paste this entire file into Supabase SQL Editor and run it.
create extension if not exists "pgcrypto";

-- Stardust economy and cosmetic shop.
create table if not exists public.stardust_shop (
  id text primary key,
  name text not null,
  description text not null,
  category text not null check (category in ('Identity', 'Chat', 'Effects')),
  price integer not null check (price > 0),
  emoji text not null default '✦',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.stardust_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 650 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.stardust_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.stardust_shop(id),
  price_paid integer not null check (price_paid > 0),
  purchased_at timestamptz not null default now(),
  unique (user_id, item_id)
);
-- Inventory is the player's durable collection. Purchases are kept separately as an audit trail.
create table if not exists public.stardust_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.stardust_shop(id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
insert into public.stardust_shop (id, name, description, category, price, emoji, sort_order) values
 ('avatar-pack', 'Pixel Avatar Pack', 'Retro faces and character frames for your profile.', 'Identity', 120, '✦', 1),
 ('neon-glow', 'Neon Username Glow', 'Give your chat name a soft electric aura.', 'Identity', 180, '◈', 2),
 ('vip-title', 'VIP Chat Title', 'A tiny [VIP] tag to flex beside your name.', 'Identity', 250, '★', 3),
 ('pixel-stickers', 'Pixel Sticker Set', 'Exclusive stickers for big reactions in chat.', 'Chat', 150, '☻', 4),
 ('coin-vfx', 'Coin Collect VFX', 'Trigger a cheerful coin burst when you post.', 'Effects', 300, '✹', 5),
 ('cyber-style', 'Cyberpunk Chat Style', 'A dark neon skin for your chat messages.', 'Chat', 220, '⌁', 6)
on conflict (id) do update set name = excluded.name, description = excluded.description, category = excluded.category, price = excluded.price, emoji = excluded.emoji, sort_order = excluded.sort_order;

alter table public.stardust_shop enable row level security;
alter table public.stardust_wallets enable row level security;
alter table public.stardust_purchases enable row level security;
alter table public.stardust_inventory enable row level security;
drop policy if exists "Anyone can view active shop items" on public.stardust_shop;
create policy "Anyone can view active shop items" on public.stardust_shop for select using (active = true);
drop policy if exists "Users can view their wallet" on public.stardust_wallets;
create policy "Users can view their wallet" on public.stardust_wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users can view their purchases" on public.stardust_purchases;
create policy "Users can view their purchases" on public.stardust_purchases for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users can view their inventory" on public.stardust_inventory;
create policy "Users can view their inventory" on public.stardust_inventory for select to authenticated using (user_id = auth.uid());

create or replace function public.buy_stardust_item(item text)
returns integer language plpgsql security definer set search_path = public
as $$
declare item_price integer; remaining integer;
begin
  select price into item_price from public.stardust_shop where id = item and active;
  if item_price is null then raise exception 'Shop item is unavailable'; end if;
  if exists (select 1 from public.stardust_inventory where user_id = auth.uid() and item_id = item) then
    raise exception 'Item already owned';
  end if;
  insert into public.stardust_wallets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.stardust_wallets set balance = balance - item_price, updated_at = now()
    where user_id = auth.uid() and balance >= item_price returning balance into remaining;
  if remaining is null then raise exception 'Not enough Stardust'; end if;
  insert into public.stardust_inventory (user_id, item_id) values (auth.uid(), item);
  insert into public.stardust_purchases (user_id, item_id, price_paid) values (auth.uid(), item, item_price);
  return remaining;
end;
$$;

-- Trivia rewards use the existing wallet and are applied atomically server-side.
create or replace function public.award_trivia_stardust(reward_amount integer)
returns integer language plpgsql security definer set search_path = public
as $$
declare new_balance integer;
begin
  if auth.uid() is null or reward_amount not in (50, 75, 100) then
    raise exception 'Invalid trivia reward';
  end if;
  insert into public.stardust_wallets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.stardust_wallets
    set balance = balance + reward_amount, updated_at = now()
    where user_id = auth.uid()
    returning balance into new_balance;
  return new_balance;
end;
$$;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Pixelings Lounge',
  status text not null default 'locked' check (status in ('live', 'locked')),
  lock_reason text,
  locked_at timestamptz,
  locked_by uuid,
  created_at timestamptz not null default now()
);
alter table public.sessions add column if not exists lock_reason text;
alter table public.sessions add column if not exists locked_at timestamptz;
alter table public.sessions add column if not exists locked_by uuid;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'computer' check (role in ('computer', 'teacher', 'moderator')),
  access_code_hash text,
  approved_nickname text check (approved_nickname is null or char_length(approved_nickname) between 1 and 24),
  pending_nickname text check (pending_nickname is null or char_length(pending_nickname) between 1 and 24),
  nickname_status text not null default 'none' check (nickname_status in ('none', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- Staff identities are created in Supabase Authentication separately.
-- Passwords intentionally do not live in SQL or source code.
create table if not exists public.staff_directory (
  email text primary key,
  display_name text not null,
  role text not null check (role in ('teacher', 'moderator'))
);
insert into public.staff_directory (email, display_name, role) values
  ('miss.v@pixelstechlab.local', 'Miss V', 'teacher'),
  ('earl@pixelstechlab.local', 'Earl', 'teacher'),
  ('bryce@pixelstechlab.local', 'Bryce', 'teacher'),
  ('cameron@pixelstechlab.local', 'Cameron', 'teacher')
on conflict (email) do update set display_name = excluded.display_name, role = excluded.role;

create table if not exists public.moderation_terms (
  term text primary key,
  severity text not null default 'review' check (severity in ('review', 'block')),
  active boolean not null default true
);

-- Compatibility additions for projects that already have a public.profiles table.
-- CREATE TABLE IF NOT EXISTS does not add missing columns to an existing table.
alter table public.profiles add column if not exists role text not null default 'computer';
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists approved_nickname text;
alter table public.profiles add column if not exists pending_nickname text;
alter table public.profiles add column if not exists nickname_status text not null default 'none';
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists access_code_hash text;
alter table public.profiles drop constraint if exists profiles_username_check;

-- Child accounts use a first-name username and a teacher-issued code. Store only
-- a bcrypt hash; the shared classroom email is the front door, not a password.
create or replace function public.verify_child_login(child_name text, child_code text)
returns table (id uuid, username text, approved_nickname text)
language plpgsql security definer set search_path = public
as $$
begin
  return query
    select p.id, p.username, p.approved_nickname
    from public.profiles p
    where p.role = 'computer'
      and lower(p.username) = lower(trim(child_name))
      and p.access_code_hash is not null
      and crypt(child_code, p.access_code_hash) = p.access_code_hash;
end;
$$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  sender_id uuid not null,
  sender_name text not null check (char_length(sender_name) between 1 and 40),
  sender_username text,
  content text not null check (char_length(content) between 1 and 1000),
  is_whisper boolean not null default false,
  recipient_id uuid,
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderation_reason text,
  reply_to_id uuid references public.messages(id) on delete set null,
  constraint whisper_has_recipient check (is_whisper = (recipient_id is not null))
);

create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'Inappropriate message',
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);
alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists sender_username text;

alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.profiles enable row level security;
alter table public.moderation_terms enable row level security;
alter table public.message_reports enable row level security;

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'moderator')); $$;

drop policy if exists "Anyone can view sessions" on public.sessions;
create policy "Anyone can view sessions" on public.sessions for select using (true);
drop policy if exists "Moderators can change session status" on public.sessions;
create policy "Moderators can change session status" on public.sessions for update
  to authenticated using (public.is_moderator()) with check (public.is_moderator());
drop policy if exists "Users can view approved messages" on public.messages;
create policy "Users can view approved messages" on public.messages for select using (
  status = 'approved' and (not is_whisper or sender_id = auth.uid() or recipient_id = auth.uid())
  or sender_id = auth.uid() or public.is_moderator()
);
drop policy if exists "Authenticated users can send messages" on public.messages;
create policy "Authenticated users can send messages" on public.messages for insert
  to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.sessions where id = session_id and status = 'live'));
drop policy if exists "Moderators can review messages" on public.messages;
create policy "Moderators can review messages" on public.messages for update
  to authenticated using (public.is_moderator()) with check (public.is_moderator());
drop policy if exists "Moderators can delete messages" on public.messages;
create policy "Moderators can delete messages" on public.messages for delete
  to authenticated using (public.is_moderator());
drop policy if exists "Authenticated users can report messages" on public.message_reports;
create policy "Authenticated users can report messages" on public.message_reports for insert
  to authenticated with check (reporter_id = auth.uid());
drop policy if exists "Users can view own reports" on public.message_reports;
create policy "Users can view own reports" on public.message_reports for select
  to authenticated using (reporter_id = auth.uid() or public.is_moderator());
drop policy if exists "Moderators can review reports" on public.message_reports;
create policy "Moderators can review reports" on public.message_reports for update
  to authenticated using (public.is_moderator()) with check (public.is_moderator());
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_moderator());
drop policy if exists "Authenticated users can view participant nicknames" on public.profiles;
create policy "Authenticated users can view participant nicknames" on public.profiles for select to authenticated using (true);
drop policy if exists "Teachers can manage profiles" on public.profiles;
create policy "Teachers can manage profiles" on public.profiles for update to authenticated using (public.is_moderator());
drop policy if exists "Users can request their own nickname" on public.profiles;
create policy "Users can request their own nickname" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "Anyone can read active moderation terms" on public.moderation_terms;
create policy "Anyone can read active moderation terms" on public.moderation_terms for select using (active = true);

create or replace function public.moderate_message()
returns trigger language plpgsql security definer set search_path = public
as $$
declare matched_term text;
begin
  select term into matched_term from public.moderation_terms
    where active and lower(new.content) like '%' || lower(term) || '%' limit 1;
  if matched_term is not null then
    new.status := 'pending';
    new.moderation_reason := 'Possible unsafe language: ' || matched_term;
  else
    new.status := 'approved';
  end if;
  return new;
end;
$$;
drop trigger if exists moderate_message_before_insert on public.messages;
create trigger moderate_message_before_insert before insert on public.messages
for each row execute function public.moderate_message();

create or replace function public.apply_approved_nickname()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  select coalesce(approved_nickname, username, new.sender_name), username
    into new.sender_name, new.sender_username
  from public.profiles where id = new.sender_id;
  return new;
end;
$$;
drop trigger if exists apply_approved_nickname_before_insert on public.messages;
create trigger apply_approved_nickname_before_insert before insert on public.messages
for each row execute function public.apply_approved_nickname();

create or replace function public.request_nickname(requested text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if requested is null or char_length(trim(requested)) not between 1 and 24 then
    raise exception 'Nickname must be 1-24 characters';
  end if;
  update public.profiles set pending_nickname = trim(requested), nickname_status = 'pending' where id = auth.uid();
end;
$$;

create index if not exists messages_session_created_idx on public.messages(session_id, created_at);

-- Required for the Realtime subscriptions used by usePixelingsChat.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions') then
    alter publication supabase_realtime add table public.sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

insert into public.sessions (name, status)
select 'Pixelings Lounge', 'live'
where not exists (select 1 from public.sessions where name = 'Pixelings Lounge');

-- One live room per class. Messages remain isolated by session_id.
insert into public.sessions (name, status)
select room.name, 'live'
from (values
  ('Blender'), ('Tinkercad'), ('E-Sports'),
  ('Minecraft Command Science'), ('Roblox Game Design')
) as room(name)
where not exists (select 1 from public.sessions existing where existing.name = room.name);

insert into public.moderation_terms (term) values
  ('stupid'), ('idiot'), ('hate'), ('kill'), ('shut up'), ('crap'),
  ('fah'), ('fuck'), ('shit'), ('shid'), ('dumb'), ('asshole'),
  ('bastard'), ('bitch'), ('bullshit'), ('damn'), ('jerk'), ('loser'),
  ('moron'), ('sucks'), ('piss off'), ('go to hell'), ('shut your mouth'),
  ('freaking'), ('frigging'), ('porn'), ('sexy'), ('naked')
on conflict (term) do nothing;

-- Child setup example (run with a real auth UUID):
-- insert into public.profiles (id, username, role, access_code_hash)
-- values ('AUTH-USER-UUID', 'Maya', 'computer', crypt('4829', gen_salt('bf')));
-- Staff members sign in with their work email and are assigned teacher/moderator
-- roles by their matching profiles/staff_directory record.
