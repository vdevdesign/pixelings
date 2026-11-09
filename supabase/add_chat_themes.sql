-- Add the seven game-inspired chat themes to the Stardust Shop.
-- Run this in the Supabase SQL Editor. Safe to run multiple times.

insert into public.stardust_shop (id, name, description, category, theme, price, emoji, sort_order, active) values
  ('style-blocky-craft', 'Blocky Craft Theme', 'A pixelated dirt-and-grass skin straight out of a sandbox world.', 'Chat', 'fun', 250, '⛏', 12, true),
  ('style-redstone-forge', 'Redstone Forge Theme', 'Molten redstone energy powers this deep-slate workshop skin.', 'Chat', 'fun', 250, '🔥', 13, true),
  ('style-kanto-league', 'Kanto League Theme', 'An electric yellow-blue skin for champion-level trainers.', 'Chat', 'fun', 250, '⚡', 14, true),
  ('style-team-rocket', 'Team Rocket Theme', 'A mischievous red-and-black skin for team villains.', 'Chat', 'fun', 250, '🚀', 15, true),
  ('style-green-hills', 'Green Hills Theme', 'A speedy blue-green skin inspired by rolling hillside loops.', 'Chat', 'fun', 250, '🌀', 16, true),
  ('style-star-chili-dogs', 'Chili Dog Nights Theme', 'A golden starry night skin for fast heroes with big appetites.', 'Chat', 'fun', 250, '⭐', 17, true),
  ('style-mushroom-speedway', 'Mushroom Speedway Theme', 'A kart-racing red mushroom skin with rainbow-road sparkles.', 'Chat', 'fun', 250, '🍄', 18, true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  theme = excluded.theme,
  price = excluded.price,
  emoji = excluded.emoji,
  sort_order = excluded.sort_order,
  active = true;

-- Make sure every chat theme item is visible and correctly categorized.
update public.stardust_shop
set category = 'Chat', theme = 'fun', active = true
where id in (
  'cyber-style', 'style-pastel-dream', 'style-forest-grove', 'style-sunset-vibes',
  'style-deep-space', 'style-candy-pop', 'style-blocky-craft', 'style-redstone-forge',
  'style-kanto-league', 'style-team-rocket', 'style-green-hills',
  'style-star-chili-dogs', 'style-mushroom-speedway'
);

-- Hide profile pictures whose bundled artwork does not exist (kept inactive
-- rather than deleted because inventory rows reference them by foreign key).
update public.stardust_shop set active = false where id in (
  'profile-baby-dragon', 'profile-blushy-ghost', 'profile-chomp-monster',
  'profile-little-night-bat'
);

-- Verify: you should see 13 rows.
select id, name, category, price, active from public.stardust_shop
where category = 'Chat' order by sort_order;
