-- Fix: kids could not send chat messages.
--
-- Kids authenticate through the shared classroom account (auth.uid() = the
-- classroom user), but send messages with sender_id set to their individual
-- child profile id. The old policy required sender_id = auth.uid(), so every
-- kid insert was rejected by RLS.
--
-- The new policy additionally accepts sender ids that belong to a
-- computer-role (student) profile. Run in the Supabase SQL Editor; safe to
-- re-run. Mirrors the same policy in schema.sql.
drop policy if exists "Authenticated users can send messages" on public.messages;
create policy "Authenticated users can send messages" on public.messages for insert
  to authenticated with check (
    (
      sender_id = auth.uid()
      or exists (
        select 1 from public.profiles
        where profiles.id = sender_id
          and profiles.role = 'computer'
      )
    )
    and exists (
      select 1 from public.sessions
      where sessions.id = session_id
        and (sessions.status = 'live' or public.is_moderator())
    )
  );
