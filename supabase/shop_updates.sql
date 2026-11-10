-- Shop updates for Pixelings. Run in the Supabase SQL Editor; safe to re-run.

-- Stardust Acquirer becomes the most expensive tag at 1000 Stardust.
update public.stardust_shop
set price = 1000
where id = 'tag-stardust-acquirer';

-- All username colors cost 100; the neon glow costs 200.
update public.stardust_shop
set price = 100
where id like 'name-%';

update public.stardust_shop
set price = 200
where id = 'neon-glow';

-- Retired avatar artwork (baby dragon, blushy ghost, chomp monster, little
-- night bat) is hidden from the shop.
update public.stardust_shop
set active = false
where id in (
  'profile-baby-dragon', 'profile-blushy-ghost', 'profile-chomp-monster', 'profile-little-night-bat',
  'background-baby-dragon', 'background-blushy-ghost', 'background-chomp-monster', 'background-little-night-bat'
);

-- Independent name color: the glow slot now only stores the glow item, and a
-- student's chosen username color lives in its own column so a color can be
-- worn with or without the glow.
alter table public.profiles add column if not exists equipped_chat_name_color text;
