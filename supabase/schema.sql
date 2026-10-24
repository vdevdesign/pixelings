-- Pixelings chat schema. Paste this entire file into Supabase SQL Editor and run it.
create extension if not exists "pgcrypto";

-- Stardust economy and cosmetic shop.
create table if not exists public.stardust_shop (
  id text primary key,
  name text not null,
  description text not null,
  category text not null check (category in ('Identity', 'Chat', 'Effects', 'Tags')),
  theme text not null default 'fun' check (theme in ('class', 'fun')),
  price integer not null check (price > 0),
  emoji text not null default '✦',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
-- Older databases may have the two-value category check and no theme column.
alter table public.stardust_shop drop constraint if exists stardust_shop_category_check;
alter table public.stardust_shop add constraint stardust_shop_category_check
  check (category in ('Identity', 'Chat', 'Effects', 'Tags'));
alter table public.stardust_shop add column if not exists theme text not null default 'fun';
alter table public.stardust_shop drop constraint if exists stardust_shop_theme_check;
alter table public.stardust_shop add constraint stardust_shop_theme_check check (theme in ('class', 'fun'));

-- Class vs. fun theming for every existing item. Class items tie to the
-- workshops (Blender, Roblox, etc.); everything else is just-for-fun.
update public.stardust_shop set theme = 'fun';

-- Retire the generic VIP title (kept as an inactive row: inventory rows
-- reference it via foreign key, so the shop row cannot be hard-deleted).
update public.stardust_shop set active = false where id = 'vip-title';
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
  ('neon-glow', 'Neon Username Glow', 'Give your chat name a soft electric aura.', 'Identity', 180, '◈', 2),
 ('vip-title', 'VIP Chat Title', 'A tiny [VIP] tag to flex beside your name.', 'Identity', 250, '★', 3),

 -- Wearable chat titles. Each is its own item so players can collect and show them off.
 ('tag-pixel-coin-collector', 'Pixel Coin Collector', 'Earned by hoarding every last pixel coin on the arcade floor.', 'Tags', 100, '🪙', 60),
 ('tag-stardust-acquirer', 'Stardust Acquirer', 'A cosmic traveler who has gathered glowing remnants from across the server.', 'Tags', 100, '🌠', 61),
 ('tag-chill-guy', 'Chill Guy', 'Never stressed, always vibing in the chat room no matter what happens.', 'Tags', 80, '😎', 62),
 ('tag-chill-gal', 'Chill Gal', 'Cool, calm, and collected, floating effortlessly through the chaos.', 'Tags', 80, '✌️', 63),
 ('tag-speed-runner', 'Speed Runner', 'Always blazing past objectives and finishing minigames in record time.', 'Tags', 120, '⚡', 64),
 ('tag-gale-snuffer', 'Gale Snuffer', 'Master of winds who can instantly blow out competing flames.', 'Tags', 150, '🌪️', 65),
 ('tag-flame-keeper', 'Flame Keeper', 'Wields scorching fire capable of banishing shadows into the dark.', 'Tags', 150, '🔥', 66),
 ('tag-shadow-walker', 'Shadow Walker', 'Mysterious operative who can hollow out the hardest stone.', 'Tags', 150, '🌑', 67),
 ('tag-stone-warden', 'Stone Warden', 'Immovable guardian whose massive weight grounds fast-moving gales.', 'Tags', 150, '🗿', 68),
 ('tag-mesh-master', 'Mesh Master', 'A 3D wizard who bends vertices and shapes polygons like clay in Blender.', 'Tags', 200, '🧊', 69),
 ('tag-script-wizard', 'Script Wizard', 'Master of logic who writes clean code to bring games to life in Roblox Studio.', 'Tags', 200, '🧙', 70),
 ('tag-glitch-hunter', 'Glitch Hunter', 'An elite bug exterminator who tracks down code errors before they crash the server.', 'Tags', 200, '🐛', 71),
 ('pixel-stickers', 'Pixel Sticker Set', 'Exclusive stickers for big reactions in chat.', 'Chat', 150, '☻', 4),
 ('coin-vfx', 'Coin Collect VFX', 'Trigger a cheerful coin burst when you post.', 'Effects', 300, '✹', 5),
 ('cyber-style', 'Cyberpunk Chat Style', 'A dark neon skin for your chat messages.', 'Chat', 220, '⌁', 6),
 -- Profile pictures (16) — each one is its own purchasable shop item.
 ('profile-baby-dragon', 'Baby Dragon', 'A baby dragon profile picture for your Pixelings profile.', 'Identity', 120, '🐲', 10),
 ('profile-bamboo-panda', 'Bamboo Panda', 'A bamboo panda profile picture for your Pixelings profile.', 'Identity', 120, '🐼', 11),
 ('profile-blushy-ghost', 'Blushy Ghost', 'A blushy ghost profile picture for your Pixelings profile.', 'Identity', 120, '👻', 12),
 ('profile-chomp-monster', 'Chomp Monster', 'A chomp monster profile picture for your Pixelings profile.', 'Identity', 120, '👾', 13),
 ('profile-cotton-bunny', 'Cotton Bunny', 'A cotton bunny profile picture for your Pixelings profile.', 'Identity', 120, '🐰', 14),
 ('profile-cyclops-jelly', 'Cyclops Jelly', 'A cyclops jelly profile picture for your Pixelings profile.', 'Identity', 120, '🪼', 15),
 ('profile-deep-sea-octo', 'Deep Sea Octo', 'A deep sea octo profile picture for your Pixelings profile.', 'Identity', 120, '🐙', 16),
 ('profile-fuzzy-horn-monster', 'Fuzzy Horn Monster', 'A fuzzy horn monster profile picture for your Pixelings profile.', 'Identity', 120, '🦕', 17),
 ('profile-happy-slime', 'Happy Slime', 'A happy slime profile picture for your Pixelings profile.', 'Identity', 120, '🟢', 18),
 ('profile-honey-bear', 'Honey Bear', 'A honey bear profile picture for your Pixelings profile.', 'Identity', 120, '🐻', 19),
 ('profile-lily-pad-frog', 'Lily Pad Frog', 'A lily pad frog profile picture for your Pixelings profile.', 'Identity', 120, '🐸', 20),
 ('profile-little-night-bat', 'Little Night Bat', 'A little night bat profile picture for your Pixelings profile.', 'Identity', 120, '🦇', 21),
 ('profile-midnight-cat', 'Midnight Cat', 'A midnight cat profile picture for your Pixelings profile.', 'Identity', 120, '🐱', 22),
 ('profile-moon-owl', 'Moon Owl', 'A moon owl profile picture for your Pixelings profile.', 'Identity', 120, '🦉', 23),
 ('profile-moonlit-wolf', 'Moonlit Wolf', 'A moonlit wolf profile picture for your Pixelings profile.', 'Identity', 120, '🐺', 24),
 ('profile-quiet-alien', 'Quiet Alien', 'A quiet alien profile picture for your Pixelings profile.', 'Identity', 120, '👽', 25),
 ('profile-scarf-penguin', 'Scarf Penguin', 'A scarf penguin profile picture for your Pixelings profile.', 'Identity', 120, '🐧', 26),
 ('profile-sleepy-fox', 'Sleepy Fox', 'A sleepy fox profile picture for your Pixelings profile.', 'Identity', 120, '🦊', 27),
 ('profile-smiley-axolotl', 'Smiley Axolotl', 'A smiley axolotl profile picture for your Pixelings profile.', 'Identity', 120, '🐠', 28),
 ('profile-toadstool-sprite', 'Toadstool Sprite', 'A toadstool sprite profile picture for your Pixelings profile.', 'Identity', 120, '🍄', 29),
 -- Profile backgrounds (16) — each one is its own purchasable shop item.
 ('background-baby-dragon', 'Baby Dragon Scene', 'A baby dragon background for your Pixelings profile.', 'Identity', 150, '🐲', 30),
 ('background-bamboo-panda', 'Bamboo Panda Scene', 'A bamboo panda background for your Pixelings profile.', 'Identity', 150, '🐼', 31),
 ('background-blushy-ghost', 'Blushy Ghost Scene', 'A blushy ghost background for your Pixelings profile.', 'Identity', 150, '👻', 32),
 ('background-chomp-monster', 'Chomp Monster Scene', 'A chomp monster background for your Pixelings profile.', 'Identity', 150, '👾', 33),
 ('background-cotton-bunny', 'Cotton Bunny Scene', 'A cotton bunny background for your Pixelings profile.', 'Identity', 150, '🐰', 34),
 ('background-cyclops-jelly', 'Cyclops Jelly Scene', 'A cyclops jelly background for your Pixelings profile.', 'Identity', 150, '🪼', 35),
 ('background-deep-sea-octo', 'Deep Sea Octo Scene', 'A deep sea octo background for your Pixelings profile.', 'Identity', 150, '🐙', 36),
 ('background-fuzzy-horn-monster', 'Fuzzy Horn Monster Scene', 'A fuzzy horn monster background for your Pixelings profile.', 'Identity', 150, '🦕', 37),
 ('background-happy-slime', 'Happy Slime Scene', 'A happy slime background for your Pixelings profile.', 'Identity', 150, '🟢', 38),
 ('background-honey-bear', 'Honey Bear Scene', 'A honey bear background for your Pixelings profile.', 'Identity', 150, '🐻', 39),
 ('background-lily-pad-frog', 'Lily Pad Frog Scene', 'A lily pad frog background for your Pixelings profile.', 'Identity', 150, '🐸', 40),
 ('background-little-night-bat', 'Little Night Bat Scene', 'A little night bat background for your Pixelings profile.', 'Identity', 150, '🦇', 41),
 ('background-midnight-cat', 'Midnight Cat Scene', 'A midnight cat background for your Pixelings profile.', 'Identity', 150, '🐱', 42),
 ('background-moon-owl', 'Moon Owl Scene', 'A moon owl background for your Pixelings profile.', 'Identity', 150, '🦉', 43),
 ('background-moonlit-wolf', 'Moonlit Wolf Scene', 'A moonlit wolf background for your Pixelings profile.', 'Identity', 150, '🐺', 44),
 ('background-quiet-alien', 'Quiet Alien Scene', 'A quiet alien background for your Pixelings profile.', 'Identity', 150, '👽', 45),
 ('background-scarf-penguin', 'Scarf Penguin Scene', 'A scarf penguin background for your Pixelings profile.', 'Identity', 150, '🐧', 46),
 ('background-sleepy-fox', 'Sleepy Fox Scene', 'A sleepy fox background for your Pixelings profile.', 'Identity', 150, '🦊', 47),
 ('background-smiley-axolotl', 'Smiley Axolotl Scene', 'A smiley axolotl background for your Pixelings profile.', 'Identity', 150, '🐠', 48),
 ('background-toadstool-sprite', 'Toadstool Sprite Scene', 'A toadstool sprite background for your Pixelings profile.', 'Identity', 150, '🍄', 49)
on conflict (id) do update set name = excluded.name, description = excluded.description, category = excluded.category, price = excluded.price, emoji = excluded.emoji, sort_order = excluded.sort_order;

-- Theme assignments: workshop-skills and duel-creator tags are 'class',
-- everything else stays 'fun'.
update public.stardust_shop set theme = 'class' where id in (
  'tag-mesh-master', 'tag-script-wizard', 'tag-glitch-hunter'
);

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

-- Staff claim items for free: same inventory record as a paid purchase, but the
-- wallet is never charged. Only teachers/moderators may call it.
create or replace function public.claim_stardust_item(item text)
returns integer language plpgsql security definer set search_path = public
as $$
declare item_price integer;
begin
  if not public.is_moderator() then
    raise exception 'Only staff can claim items for free';
  end if;
  select price into item_price from public.stardust_shop where id = item and active;
  if item_price is null then raise exception 'Shop item is unavailable'; end if;
  if exists (select 1 from public.stardust_inventory where user_id = auth.uid() and item_id = item) then
    raise exception 'Item already owned';
  end if;
  insert into public.stardust_inventory (user_id, item_id) values (auth.uid(), item);
  insert into public.stardust_purchases (user_id, item_id, price_paid) values (auth.uid(), item, item_price);
  return coalesce((select balance from public.stardust_wallets where user_id = auth.uid()), 0);
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
  -- Equipped cosmetics: ids from the user's stardust_inventory.
  avatar_url text,
  background_url text,
  equipped_chat_glow text,
  equipped_chat_tag text,
  equipped_chat_stickers text,
  equipped_chat_vfx text,
  equipped_chat_style text,
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
alter table public.profiles add column if not exists equipped_chat_glow text;
alter table public.profiles add column if not exists equipped_chat_tag text;
alter table public.profiles add column if not exists equipped_chat_stickers text;
alter table public.profiles add column if not exists equipped_chat_vfx text;
alter table public.profiles add column if not exists equipped_chat_style text;
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

-- Shop visibility management: staff see hidden items and can toggle public/hidden.
drop policy if exists "Anyone can view shop items" on public.stardust_shop;
create policy "Anyone can view shop items" on public.stardust_shop for select
  using (active = true or public.is_moderator());
drop policy if exists "Moderators can manage shop items" on public.stardust_shop;
create policy "Moderators can manage shop items" on public.stardust_shop for update
  to authenticated using (public.is_moderator()) with check (public.is_moderator());

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
  to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.sessions where id = session_id and (status = 'live' or public.is_moderator())));
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

-- Coin VFX is intentionally rate-limited server-side as well as in the UI.
create or replace function public.enforce_coin_message_limit()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if position(chr(129689) in new.content) > 0 and (
    select count(*) from public.messages
    where sender_id = new.sender_id
      and position(chr(129689) in content) > 0
      and created_at > now() - interval '5 minutes'
  ) >= 3 then
    raise exception 'Coin VFX is limited to 3 coin messages every 5 minutes.';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_coin_message_limit_before_insert on public.messages;
create trigger enforce_coin_message_limit_before_insert before insert on public.messages
for each row execute function public.enforce_coin_message_limit();

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
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
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
  ('Minecraft Command Science'), ('Roblox Game Design'), ('Game Art & Animation')
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

-- ============================================================
-- Profile avatar cosmetics (profile pictures & backgrounds)
-- Run the statements below in the Supabase SQL Editor.
-- ============================================================

-- 0) Retire the old bundle item. Existing owners keep it in their inventory,
--    but it disappears from the shop.
update public.stardust_shop set active = false where id = 'avatar-pack';
delete from public.stardust_shop where id = 'avatar-pack';

-- 1) Add equip columns to profiles (skip if re-running schema.sql which now includes them).
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists background_url text;

-- 2) Register every profile picture / background as its own shop item.
--    The schema.sql insert above already contains them; this upsert is a
--    safety net for databases created before this feature.
insert into public.stardust_shop (id, name, description, category, price, emoji, sort_order)
select
  'profile-' || critter,
  replace(initcap(replace(critter, '-', ' ')), '_', ' '),
  'A ' || replace(critter, '-', ' ') || ' profile picture for your Pixelings profile.',
  'Identity', 120, '✦', 100 + row_number() over ()
from unnest(array[
  'baby-dragon','bamboo-panda','blushy-ghost','chomp-monster','cotton-bunny','cyclops-jelly',
  'deep-sea-octo','fuzzy-horn-monster','happy-slime','honey-bear','lily-pad-frog',
  'little-night-bat','midnight-cat','moon-owl','moonlit-wolf','quiet-alien','scarf-penguin',
  'sleepy-fox','smiley-axolotl','toadstool-sprite'
]) as critter
on conflict (id) do nothing;

insert into public.stardust_shop (id, name, description, category, price, emoji, sort_order)
select
  'background-' || critter,
  replace(initcap(replace(critter, '-', ' ')), '_', ' ') || ' Scene',
  'A ' || replace(critter, '-', ' ') || ' background for your Pixelings profile.',
  'Identity', 150, '✦', 200 + row_number() over ()
from unnest(array[
  'baby-dragon','bamboo-panda','blushy-ghost','chomp-monster','cotton-bunny','cyclops-jelly',
  'deep-sea-octo','fuzzy-horn-monster','happy-slime','honey-bear','lily-pad-frog',
  'little-night-bat','midnight-cat','moon-owl','moonlit-wolf','quiet-alien','scarf-penguin',
  'sleepy-fox','smiley-axolotl','toadstool-sprite'
]) as critter
on conflict (id) do nothing;

-- Backgrounds remain profile cosmetics; only the old "Scene" label is retired.
update public.stardust_shop
set name = regexp_replace(name, ' Scene$', ''),
    description = replace(description, ' background for your Pixelings profile.', ' profile background for your Pixelings profile.')
where id like 'background-%';

-- Happy Slime is the free starter profile look. Backfill existing profiles and
-- make the grant idempotent so re-running this schema is safe.
insert into public.stardust_inventory (user_id, item_id)
select p.id, starter.item_id
from public.profiles p
cross join (values ('profile-happy-slime'), ('background-happy-slime')) as starter(item_id)
where not exists (
  select 1 from public.stardust_inventory i
  where i.user_id = p.id and i.item_id = starter.item_id
)
on conflict (user_id, item_id) do nothing;

update public.profiles
set avatar_url = coalesce(avatar_url, 'profile-happy-slime'),
    background_url = coalesce(background_url, 'background-happy-slime')
where avatar_url is null or background_url is null;

-- 3) Allow users to equip cosmetics they own. Profile pictures, backgrounds,
-- and chat cosmetics must all be present in the user's inventory.
--    ids from the user's own stardust_inventory may be written to those columns.
create or replace function public.can_equip_cosmetic(target text)
returns boolean language sql stable security definer set search_path = public
as $$
  select target is null
    or exists (
         select 1 from public.stardust_inventory
         where user_id = auth.uid() and item_id = target
       );
$$;

drop policy if exists "Users can equip their own cosmetics" on public.profiles;
create policy "Users can equip their own cosmetics" on public.profiles for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and public.can_equip_cosmetic(avatar_url)
  and public.can_equip_cosmetic(background_url)
  and public.can_equip_cosmetic(equipped_chat_glow)
  and public.can_equip_cosmetic(equipped_chat_tag)
  and public.can_equip_cosmetic(equipped_chat_stickers)
  and public.can_equip_cosmetic(equipped_chat_vfx)
  and public.can_equip_cosmetic(equipped_chat_style)
);

-- Automatically grant the same starter look to profiles created later.
create or replace function public.grant_starter_profile_cosmetics()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.stardust_inventory (user_id, item_id)
  values (new.id, 'profile-happy-slime'), (new.id, 'background-happy-slime')
  on conflict (user_id, item_id) do nothing;
  new.avatar_url := coalesce(new.avatar_url, 'profile-happy-slime');
  new.background_url := coalesce(new.background_url, 'background-happy-slime');
  return new;
end;
$$;
drop trigger if exists grant_starter_profile_cosmetics_before_insert on public.profiles;
create trigger grant_starter_profile_cosmetics_before_insert
before insert on public.profiles
for each row execute function public.grant_starter_profile_cosmetics();
