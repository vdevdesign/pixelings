-- Chat moderation (timeouts & bans), account claiming, and online presence.
-- Run this in the Supabase SQL Editor. Safe to run multiple times.

-- 1) Moderation: time outs and bans --------------------------------------
create table if not exists public.chat_penalties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('timeout', 'ban')),
  reason text not null default '',
  until_at timestamptz,               -- null = permanent (bans)
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id) on delete set null
);
create index if not exists chat_penalties_user_active_idx
  on public.chat_penalties(user_id, kind, until_at);

alter table public.chat_penalties enable row level security;
drop policy if exists "Anyone can view penalties" on public.chat_penalties;
create policy "Anyone can view penalties" on public.chat_penalties for select to authenticated using (true);
drop policy if exists "Moderators can add penalties" on public.chat_penalties;
create policy "Moderators can add penalties" on public.chat_penalties for insert to authenticated
  with check (public.is_moderator() and created_by = auth.uid());
drop policy if exists "Moderators can lift penalties" on public.chat_penalties;
create policy "Moderators can lift penalties" on public.chat_penalties for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());

create or replace function public.active_chat_penalty(target uuid)
returns text language sql stable security definer set search_path = public
as $$
  select kind from public.chat_penalties
  where user_id = target and lifted_at is null
    and (kind = 'ban' or (kind = 'timeout' and until_at > now()))
  order by case kind when 'ban' then 0 else 1 end, until_at desc nulls first
  limit 1;
$$;

create or replace function public.enforce_chat_penalty_on_send()
returns trigger language plpgsql security definer set search_path = public
as $$
declare penalty text;
begin
  if new.sender_id = auth.uid() and not public.is_moderator() then
    penalty := public.active_chat_penalty(new.sender_id);
    if penalty is not null then
      raise exception 'Your chat access is currently restricted (%).', penalty;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_chat_penalty_before_insert on public.messages;
create trigger enforce_chat_penalty_before_insert before insert on public.messages
for each row execute function public.enforce_chat_penalty_on_send();

create or replace function public.set_chat_penalty(
  target uuid, penalty_kind text, minutes integer, reason text default ''
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_moderator() then raise exception 'Only staff can moderate chat access'; end if;
  if penalty_kind not in ('timeout', 'ban', 'unban') then raise exception 'Unknown penalty kind'; end if;

  if penalty_kind = 'unban' then
    update public.chat_penalties
      set lifted_at = now(), lifted_by = auth.uid()
      where user_id = target and lifted_at is null;
    return;
  end if;

  insert into public.chat_penalties (user_id, kind, reason, until_at, created_by)
  values (
    target, penalty_kind, coalesce(reason, ''),
    case when penalty_kind = 'timeout' then now() + make_interval(mins => greatest(coalesce(minutes, 5), 1)) else null end,
    auth.uid()
  );
end;
$$;

-- 2) Account claiming: students move a kid profile onto their own email ---
create table if not exists public.account_claims (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.account_claims enable row level security;
drop policy if exists "Users can view their own claims" on public.account_claims;
create policy "Users can view their own claims" on public.account_claims for select to authenticated
  using (requested_by = auth.uid() or public.is_teacher());
drop policy if exists "Users can request a claim" on public.account_claims;
create policy "Users can request a claim" on public.account_claims for insert to authenticated
  with check (requested_by = auth.uid());
drop policy if exists "Teachers review claims" on public.account_claims;
create policy "Teachers review claims" on public.account_claims for update to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- Student enters their first name + access code while signed in with their own
-- email account. The claim sits pending until a teacher approves it.
create or replace function public.request_account_claim(child_name text, child_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare child_id uuid; existing uuid;
begin
  if auth.uid() is null then raise exception 'Sign in with your own email first'; end if;

  select p.id into child_id
  from public.profiles p
  where p.role = 'computer'
    and p.access_code_hash is not null
    and lower(p.username) = lower(trim(child_name))
    and extensions.crypt(child_code, p.access_code_hash) = p.access_code_hash
  limit 1;

  if child_id is null then raise exception 'That first name and code were not recognized'; end if;

  select c.id into existing from public.account_claims c
  where c.student_profile_id = child_id and c.status = 'pending';
  if existing is not null then return existing; end if;

  insert into public.account_claims (student_profile_id, requested_by)
  values (child_id, auth.uid())
  returning id into existing;
  return existing;
end;
$$;

-- Teacher approves: migrate wallet/inventory/purchases/messages from the kid
-- profile's old auth id (the classroom account) to the student's new account,
-- then link the profile to that account.
create or replace function public.approve_account_claim(claim_id uuid, approve boolean)
returns text language plpgsql security definer set search_path = public
as $$
declare
  claim record; new_user uuid; old_id uuid;
begin
  if not public.is_teacher() then raise exception 'Only teachers can review account claims'; end if;

  select * into claim from public.account_claims where id = claim_id and status = 'pending';
  if claim is null then raise exception 'Claim not found or already reviewed'; end if;
  new_user := claim.requested_by;
  old_id := (select id from public.profiles where id = claim.student_profile_id);

  update public.account_claims
    set status = case when approve then 'approved' else 'rejected' end,
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = claim_id;

  if not approve then return 'rejected'; end if;

  update public.stardust_wallets set user_id = new_user where user_id = old_id;
  update public.stardust_inventory set user_id = new_user where user_id = old_id;
  update public.stardust_purchases set user_id = new_user where user_id = old_id;
  update public.messages set sender_id = new_user where sender_id = old_id;
  update public.message_reports set reporter_id = new_user where reporter_id = old_id;

  update public.profiles
    set id = new_user, access_code_hash = null
    where id = claim.student_profile_id;

  return 'approved';
end;
$$;

-- 3) Online presence ------------------------------------------------------
create table if not exists public.presence_heartbeats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  room text,
  last_seen timestamptz not null default now()
);
alter table public.presence_heartbeats enable row level security;
drop policy if exists "Anyone can view presence" on public.presence_heartbeats;
create policy "Anyone can view presence" on public.presence_heartbeats for select to authenticated using (true);
drop policy if exists "Users update own heartbeat" on public.presence_heartbeats;
create policy "Users update own heartbeat" on public.presence_heartbeats for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "Users update own heartbeat row" on public.presence_heartbeats;
create policy "Users update own heartbeat row" on public.presence_heartbeats for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.heartbeat(room_name text default null)
returns void language sql security definer set search_path = public
as $$
  insert into public.presence_heartbeats (user_id, room, last_seen)
  values (auth.uid(), room_name, now())
  on conflict (user_id) do update set room = excluded.room, last_seen = now();
$$;

-- Quick needs: auto-mark 'archived' so students never see them in the feed,
-- but they stay in the table for the teacher's Priority Alerts panel.
alter table public.messages drop constraint if exists messages_status_check;
alter table public.messages add constraint messages_status_check
  check (status in ('pending', 'approved', 'rejected', 'archived'));

create or replace function public.archive_quick_need()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.is_priority then new.status := 'archived'; end if;
  return new;
end;
$$;
drop trigger if exists archive_quick_need_before_insert on public.messages;
create trigger archive_quick_need_before_insert before insert on public.messages
for each row execute function public.archive_quick_need();

-- Archived quick-need messages are only visible to moderators.
drop policy if exists "Users can view approved messages" on public.messages;
create policy "Users can view approved messages" on public.messages for select using (
  status = 'approved' and (not is_whisper or sender_id = auth.uid() or recipient_id = auth.uid())
  or sender_id = auth.uid() or public.is_moderator()
);

-- Everyone online in the last 2 minutes, with the room they are chatting in.
create or replace view public.online_now as
  select h.user_id, h.room, h.last_seen,
    coalesce(p.approved_nickname, p.username) as display_name
  from public.presence_heartbeats h
  join public.profiles p on p.id = h.user_id
  where h.last_seen > now() - interval '2 minutes';
grant select on public.online_now to authenticated;

-- 4) Daily game earnings cap ---------------------------------------------
-- Students can keep playing as long as they like, but each game pays at most
-- 500 Stardust per calendar day. The RPC clamps the reward server-side so the
-- cap cannot be bypassed from the client.
create or replace function public.award_game_stardust(game text, requested integer)
returns table (granted integer, daily_total integer, cap integer)
language plpgsql security definer set search_path = public
as $$
declare
  new_balance integer;
  cap_value integer := 500;
  awarded_today integer;
  grant_amount integer;
begin
  if auth.uid() is null then raise exception 'Sign in to earn Stardust'; end if;
  if requested < 0 then raise exception 'Invalid reward'; end if;

  -- Safety clamp per request so a tampered client can't request huge amounts.
  if game = 'trivia' then
    grant_amount := least(requested, 150);
  elsif game = 'elemental' then
    grant_amount := least(requested, 50);
  else
    raise exception 'Unknown game';
  end if;

  select coalesce(sum(amount), 0) into awarded_today
  from public.game_rewards_log
  where user_id = auth.uid() and game = award_game_stardust.game
    and earned_at >= date_trunc('day', now());

  grant_amount := least(grant_amount, cap_value - awarded_today);
  if grant_amount <= 0 then
    return query select 0::integer, awarded_today::integer, cap_value;
  end if;

  insert into public.stardust_wallets (user_id) values (auth.uid())
    on conflict (user_id) do nothing;
  update public.stardust_wallets
    set balance = balance + grant_amount, updated_at = now()
    where user_id = auth.uid()
    returning balance into new_balance;

  insert into public.game_rewards_log (user_id, game, amount)
  values (auth.uid(), game, grant_amount);

  return query select grant_amount, (awarded_today + grant_amount)::integer, cap_value;
end;
$$;

create table if not exists public.game_rewards_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('trivia', 'elemental')),
  amount integer not null check (amount > 0),
  earned_at timestamptz not null default now()
);
create index if not exists game_rewards_log_user_day_idx
  on public.game_rewards_log(user_id, game, earned_at desc);
alter table public.game_rewards_log enable row level security;
drop policy if exists "Users can view own game rewards" on public.game_rewards_log;
create policy "Users can view own game rewards" on public.game_rewards_log for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());

-- Legacy path: keep the old trivia RPC working but route it through the cap.
create or replace function public.award_trivia_stardust(reward_amount integer)
returns integer language plpgsql security definer set search_path = public
as $$
declare row record;
begin
  select granted into row from public.award_game_stardust('trivia', reward_amount);
  return (select balance from public.stardust_wallets where user_id = auth.uid());
end;
$$;
