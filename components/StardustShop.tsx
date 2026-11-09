import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { avatarItemById, avatarItems, type AvatarItem } from './avatarItems';

type ShopItem = { id: string; name: string; description: string; category: string; theme?: string; price: number; emoji: string; active?: boolean };
// Profile pictures and backgrounds ship with the app (bundled from src/assets),
// so they are always available as individual purchasable items.
const avatarShopItems: ShopItem[] = avatarItems.map((item: AvatarItem) => ({
  id: item.id,
  name: item.name,
  description: item.kind === 'profile' ? `${item.name} profile picture for your Pixelings profile.` : `${item.name} background for your profile.`,
  category: 'Identity',
  theme: 'fun',
  price: item.price,
  emoji: item.kind === 'profile' ? '🖼' : '🌌',
}));
// Every chat theme (style) item — mirrors the list in InventoryPage.tsx.
export const CHAT_STYLE_IDS = ['cyber-style', 'style-pastel-dream', 'style-forest-grove', 'style-sunset-vibes', 'style-deep-space', 'style-candy-pop', 'style-blocky-craft', 'style-redstone-forge', 'style-kanto-league', 'style-team-rocket', 'style-green-hills', 'style-star-chili-dogs', 'style-mushroom-speedway'];
// Username color cosmetics — must match InventoryPage.tsx's USERNAME_COLORS.
const USERNAME_COLORS = [
  { id: 'name-coral', name: 'Coral Name', css: '#ff8a7a', emoji: '🪸' },
  { id: 'name-mint', name: 'Mint Name', css: '#7ef0c2', emoji: '🌿' },
  { id: 'name-lilac', name: 'Lilac Name', css: '#c9a6ff', emoji: '💜' },
  { id: 'name-honey', name: 'Honey Name', css: '#ffd06e', emoji: '🍯' },
  { id: 'name-sky', name: 'Sky Name', css: '#8fd4ff', emoji: '🌤️' },
  { id: 'name-rose', name: 'Rose Name', css: '#ff9ec4', emoji: '🌹' },
  { id: 'name-lime', name: 'Lime Name', css: '#c6f95e', emoji: '🍋' },
  { id: 'name-aqua', name: 'Aqua Name', css: '#7fe8ff', emoji: '🌊' },
];
const NAME_COLOR_PRICE = 140; // cheaper than a glow, pricier than a tag
const fallbackItems: ShopItem[] = [
  ...avatarShopItems,
  ...USERNAME_COLORS.map((color) => ({
    id: color.id,
    name: color.name,
    description: 'Tint your chat username with this color.',
    category: 'Identity',
    theme: 'fun',
    price: NAME_COLOR_PRICE,
    emoji: color.emoji,
  })),
  { id: 'neon-glow', name: 'Neon Username Glow', description: 'Give your chat name a soft electric aura.', category: 'Identity', theme: 'fun', price: 180, emoji: '◈' },
  { id: 'pixel-stickers', name: 'Pixel Sticker Set', description: 'Exclusive stickers for big reactions in chat.', category: 'Chat', theme: 'fun', price: 150, emoji: '☻' },
  { id: 'coin-vfx', name: 'Coin Collect VFX', description: 'Trigger a cheerful coin burst when you post.', category: 'Effects', theme: 'fun', price: 300, emoji: '✹' },
  { id: 'cyber-style', name: 'Cyberpunk Chat Style', description: 'A dark neon skin for your chat messages.', category: 'Chat', theme: 'fun', price: 220, emoji: '⌁' },
  { id: 'style-blocky-craft', name: 'Blocky Craft Theme', description: 'A pixelated dirt-and-grass skin straight out of a sandbox world.', category: 'Chat', theme: 'fun', price: 250, emoji: '⛏' },
  { id: 'style-redstone-forge', name: 'Redstone Forge Theme', description: 'Molten redstone energy powers this deep-slate workshop skin.', category: 'Chat', theme: 'fun', price: 250, emoji: '🔥' },
  { id: 'style-kanto-league', name: 'Kanto League Theme', description: 'An electric yellow-blue skin for champion-level trainers.', category: 'Chat', theme: 'fun', price: 250, emoji: '⚡' },
  { id: 'style-team-rocket', name: 'Team Rocket Theme', description: 'A mischievous red-and-black skin for team villains.', category: 'Chat', theme: 'fun', price: 250, emoji: '🚀' },
  { id: 'style-green-hills', name: 'Green Hills Theme', description: 'A speedy blue-green skin inspired by rolling hillside loops.', category: 'Chat', theme: 'fun', price: 250, emoji: '🌀' },
  { id: 'style-star-chili-dogs', name: 'Chili Dog Nights Theme', description: 'A golden starry night skin for fast heroes with big appetites.', category: 'Chat', theme: 'fun', price: 250, emoji: '⭐' },
  { id: 'style-mushroom-speedway', name: 'Mushroom Speedway Theme', description: 'A kart-racing red mushroom skin with rainbow-road sparkles.', category: 'Chat', theme: 'fun', price: 250, emoji: '🍄' },
  // Wearable chat titles (the old generic VIP title was retired).
  { id: 'tag-pixel-coin-collector', name: 'Pixel Coin Collector', description: 'Earned by hoarding every last pixel coin on the arcade floor.', category: 'Tags', theme: 'fun', price: 100, emoji: '🪙' },
  { id: 'tag-stardust-acquirer', name: 'Stardust Acquirer', description: 'A cosmic traveler who has gathered glowing remnants from across the server.', category: 'Tags', theme: 'fun', price: 100, emoji: '🌠' },
  { id: 'tag-chill-guy', name: 'Chill Guy', description: 'Never stressed, always vibing in the chat room no matter what happens.', category: 'Tags', theme: 'fun', price: 80, emoji: '😎' },
  { id: 'tag-chill-gal', name: 'Chill Gal', description: 'Cool, calm, and collected, floating effortlessly through the chaos.', category: 'Tags', theme: 'fun', price: 80, emoji: '✌️' },
  { id: 'tag-speed-runner', name: 'Speed Runner', description: 'Always blazing past objectives and finishing minigames in record time.', category: 'Tags', theme: 'fun', price: 120, emoji: '⚡' },
  { id: 'tag-gale-snuffer', name: 'Gale Snuffer', description: 'Master of winds who can instantly blow out competing flames.', category: 'Tags', theme: 'fun', price: 150, emoji: '🌪️' },
  { id: 'tag-flame-keeper', name: 'Flame Keeper', description: 'Wields scorching fire capable of banishing shadows into the dark.', category: 'Tags', theme: 'fun', price: 150, emoji: '🔥' },
  { id: 'tag-shadow-walker', name: 'Shadow Walker', description: 'Mysterious operative who can hollow out the hardest stone.', category: 'Tags', theme: 'fun', price: 150, emoji: '🌑' },
  { id: 'tag-stone-warden', name: 'Stone Warden', description: 'Immovable guardian whose massive weight grounds fast-moving gales.', category: 'Tags', theme: 'fun', price: 150, emoji: '🗿' },
  { id: 'tag-mesh-master', name: 'Mesh Master', description: 'A 3D wizard who bends vertices and shapes polygons like clay in Blender.', category: 'Tags', theme: 'class', price: 200, emoji: '🧊' },
  { id: 'tag-script-wizard', name: 'Script Wizard', description: 'Master of logic who writes clean code to bring games to life in Roblox Studio.', category: 'Tags', theme: 'class', price: 200, emoji: '🧙' },
  { id: 'tag-glitch-hunter', name: 'Glitch Hunter', description: 'An elite bug exterminator who tracks down code errors before they crash the server.', category: 'Tags', theme: 'class', price: 200, emoji: '🐛' },
];

export function StardustShop({
  accountId,
  demoMode,
  canManage,
  balance,
  ownedItems,
  onOwnedChange,
  onBalanceChange,
}: {
  accountId: string;
  demoMode?: boolean;
  canManage?: boolean;
  balance: number | null;
  ownedItems: string[];
  onOwnedChange: (items: string[]) => void;
  onBalanceChange: (balance: number | null) => void;
}) {
  const [items, setItems] = React.useState<ShopItem[]>(fallbackItems);
  // Ownership and balance live at the app level so they survive tab switches;
  // this component only reads them and pushes updates upward.
  const owned = ownedItems;
  const setOwned = onOwnedChange;
  const [notice, setNotice] = React.useState('');
  // Sections with more than this many items collapse behind a "View all" toggle.
  const COLLAPSED_LIMIT = 8;
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (demoMode) return;
    supabase.from('stardust_shop').select('id,name,description,category,theme,price,emoji,active').order('sort_order')
      .then(({ data }) => {
        if (!data?.length) return;
        // Merge DB rows with the bundled avatar items so profile pictures and
        // backgrounds always appear even if the DB seed is missing them.
        const dbIds = new Set(data.map((row) => row.id));
        const merged = [...(data as ShopItem[]), ...avatarShopItems.filter((item) => !dbIds.has(item.id))].map((item) => item.id.startsWith('background-')
          ? { ...item, name: item.name.replace(/ Scene$/, ''), description: item.description.replace(' background for your Pixelings profile.', ' profile background for your Pixelings profile.') }
          : item);
        setItems(merged);
      });
  }, [demoMode, accountId]);

  const buy = async (item: ShopItem) => {
    if (owned.includes(item.id)) return setNotice(`${item.name} is already in your collection.`);
    // Teachers and testing mode never spend Stardust — everything is free.
    const free = canManage || demoMode;
    if (!free && (balance ?? 0) < item.price) return setNotice('Not enough Stardust yet — play a minigame!');
    if (demoMode) {
      // Instant preview has no real account — keep the grant client-side only.
      setOwned([...owned, item.id]);
      return setNotice(`${item.name} unlocked! (Preview mode)`);
    }
    if (canManage && accountId) {
      // Teachers claim for free; the grant is recorded in stardust_inventory
      // server-side so it persists and can be equipped like any student item.
      const { data: currentBalance, error } = await supabase.rpc('claim_stardust_item', { item: item.id });
      if (error) {
        if (error.message.includes('already owned')) return setNotice(`${item.name} is already in your collection.`);
        return setNotice('Could not claim that item. Please try again.');
      }
      onBalanceChange(typeof currentBalance === 'number' ? currentBalance : (balance ?? 0));
      setOwned([...owned, item.id]);
      return setNotice(`${item.name} unlocked! (Free for teachers)`);
    }
    if (accountId) {
      const { data: remaining, error } = await supabase.rpc('buy_stardust_item', { item: item.id });
      if (error) return setNotice(error.message.includes('Not enough') ? 'Not enough Stardust yet — play a minigame!' : 'Could not complete that purchase.');
      onBalanceChange(remaining as number);
    }
    setOwned([...owned, item.id]); setNotice(`${item.name} unlocked!`);
  };
  const shopItems = items.filter((item) => canManage || (item.active ?? true));
  // Category filter — matches the actual grouping headers below so students
  // can jump straight to what they want. 'All' shows everything.
  const CATEGORY_FILTERS = ['All', 'Identity', 'Chat', 'Effects', 'Tags'] as const;
  const [categoryFilter, setCategoryFilter] = React.useState<typeof CATEGORY_FILTERS[number]>('All');
  const filteredItems = categoryFilter === 'All' ? shopItems : shopItems.filter((item) => item.category === categoryFilter);
  const categoryCounts = Object.fromEntries(CATEGORY_FILTERS.map((category) => [category, category === 'All' ? shopItems.length : shopItems.filter((item) => item.category === category).length]));
  // Claim everything still unowned. Teachers claim for free; in preview mode the
  // grants are client-side only since there is no real account.
  const [claimingAll, setClaimingAll] = React.useState(false);
  const claimableCount = shopItems.filter((item) => !owned.includes(item.id) && (item.active ?? true)).length;
  const claimAll = async () => {
    setNotice('');
    if (demoMode) {
      setOwned(items.map((item) => item.id));
      return setNotice('Everything unlocked! (Preview mode)');
    }
    setClaimingAll(true);
    const unowned = shopItems.filter((item) => (item.active ?? true) && !owned.includes(item.id)).map((item) => item.id);
    let lastBalance = balance;
    let successCount = 0;
    for (const itemId of unowned) {
      const { data: currentBalance, error } = await supabase.rpc('claim_stardust_item', { item: itemId });
      if (!error) {
        successCount += 1;
        if (typeof currentBalance === 'number') lastBalance = currentBalance;
      }
    }
    setClaimingAll(false);
    if (successCount > 0) {
      setOwned(Array.from(new Set([...owned, ...unowned])));
      onBalanceChange(lastBalance ?? null);
    }
    setNotice(successCount === unowned.length
      ? `All ${successCount} items unlocked!`
      : successCount > 0
        ? `Claimed ${successCount} of ${unowned.length} items.`
        : 'Nothing left to claim — check back soon!');
  };
  // Group the shop by item type. Avatar items get their own sections so the
  // profile pictures and backgrounds read as two distinct collections.
  const shopGroups = [
    { label: 'Profile Pictures', items: filteredItems.filter((item) => item.id.startsWith('profile-')) },
    { label: 'Profile Backgrounds', items: filteredItems.filter((item) => item.id.startsWith('background-')) },
    { label: 'Identity', items: filteredItems.filter((item) => item.category === 'Identity' && !item.id.startsWith('profile-') && !item.id.startsWith('background-')) },
    { label: 'Chat Themes', items: filteredItems.filter((item) => item.category === 'Chat' && CHAT_STYLE_IDS.includes(item.id)) },
    { label: 'Chat Extras', items: filteredItems.filter((item) => item.category === 'Chat' && !CHAT_STYLE_IDS.includes(item.id)) },
    { label: 'Effects', items: filteredItems.filter((item) => item.category === 'Effects') },
    { label: 'Tags', items: filteredItems.filter((item) => item.category === 'Tags') },
  ].filter((group) => group.items.length > 0);
  const avatarFor = (id: string): AvatarItem | undefined => avatarItemById.get(id);
  const toggleActive = async (item: ShopItem) => {
    const next = !(item.active ?? true);
    setNotice('');
    if (demoMode) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, active: next } : entry));
      return;
    }
    const { error } = await supabase.from('stardust_shop').update({ active: next }).eq('id', item.id);
    if (error) setNotice(error.message);
    else {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, active: next } : entry));
      setNotice(`${item.name} is now ${next ? 'public' : 'hidden'}.`);
    }
  };
  return <section className="shop-section">
    <div className="shop-toolbar">
      <div className="theme-filter">
        {CATEGORY_FILTERS.map((category) => (
          <button key={category} className={`theme-filter-btn ${categoryFilter === category ? 'active' : ''}`} onClick={() => setCategoryFilter(category)}>
            {category} · {categoryCounts[category]}
          </button>
        ))}
      </div>
      <div className="shop-heading-actions">{(canManage || demoMode) && claimableCount > 0 && <button className="inventory-toggle" onClick={claimAll} disabled={claimingAll}>{claimingAll ? 'Claiming…' : `Claim all · ${claimableCount}`}</button>}</div>
    </div>
    {/* Shop items are grouped by type: Profile pictures, Profile backgrounds, then the other categories. */}
      {shopGroups.map((group) => {
        const collapsed = group.items.length > COLLAPSED_LIMIT && !expandedGroups[group.label];
        const visibleItems = collapsed ? group.items.slice(0, COLLAPSED_LIMIT) : group.items;
        const hiddenCount = group.items.length - COLLAPSED_LIMIT;
        return <React.Fragment key={group.label}>
        <h3 className="shop-group-heading">{group.label}</h3>
        <div className="shop-grid">{visibleItems.map((item) => { const avatar = avatarFor(item.id); return <article className={`shop-item ${avatar ? `shop-avatar-item shop-avatar-${avatar.kind}` : ''} ${(item.active ?? true) ? '' : 'shop-item-hidden'}`} key={item.id}><div className="item-icon">{avatar ? <img className="shop-item-thumb" src={avatar.src} alt={item.name} loading="lazy" /> : item.emoji}</div><h4>{item.name}</h4>
          {item.id === 'neon-glow' && <div className="item-preview"><span className="preview-glow-name">MissV</span></div>}
          {item.id === 'coin-vfx' && <div className="item-preview"><div className="preview-coin-burst"><span>🪙</span><span>🪙</span><span>🪙</span></div></div>}
          {(CHAT_STYLE_IDS.includes(item.id) || USERNAME_COLORS.some((color) => color.id === item.id)) && (
            <div className="item-preview">
              {USERNAME_COLORS.some((color) => color.id === item.id)
                ? <span className="preview-glow-name" style={{ color: USERNAME_COLORS.find((color) => color.id === item.id)!.css }}>{USERNAME_COLORS.find((color) => color.id === item.id)!.name.replace(' Name', '')}</span>
                : <div className={`preview-theme-msg preview-${item.id}`}>hey pixelings! 👋</div>}
            </div>
          )}
        <button onClick={() => buy(item)} disabled={owned.includes(item.id)}>{owned.includes(item.id) ? 'Owned ✓' : (canManage || demoMode) ? 'Take it · Free' : `Buy · ${item.price} ✦`}</button>{canManage && <button className="item-visibility-toggle" onClick={() => toggleActive(item)}>{(item.active ?? true) ? 'Public 👁' : 'Hidden 🙈'}</button>}</article>; })}</div>
        {group.items.length > COLLAPSED_LIMIT && <button className="view-all-btn" onClick={() => setExpandedGroups((state) => ({ ...state, [group.label]: !state[group.label] }))}>{collapsed ? `View all ${hiddenCount} more · ${group.items.length}` : 'Show less'}</button>}
      </React.Fragment>;
      })}{notice && <div className="shop-notice">{notice}</div>}</section>;
}
