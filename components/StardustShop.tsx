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
const fallbackItems: ShopItem[] = [
  ...avatarShopItems,
  { id: 'neon-glow', name: 'Neon Username Glow', description: 'Give your chat name a soft electric aura.', category: 'Identity', theme: 'fun', price: 180, emoji: '◈' },
  { id: 'pixel-stickers', name: 'Pixel Sticker Set', description: 'Exclusive stickers for big reactions in chat.', category: 'Chat', theme: 'fun', price: 150, emoji: '☻' },
  { id: 'coin-vfx', name: 'Coin Collect VFX', description: 'Trigger a cheerful coin burst when you post.', category: 'Effects', theme: 'fun', price: 300, emoji: '✹' },
  { id: 'cyber-style', name: 'Cyberpunk Chat Style', description: 'A dark neon skin for your chat messages.', category: 'Chat', theme: 'fun', price: 220, emoji: '⌁' },
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
  const [inventoryOpen, setInventoryOpen] = React.useState(false);

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
  // Theme filter: 'class' items tie to the workshops (Blender, Roblox, …),
  // 'fun' items are just-for-fun. 'All' shows everything.
  const [themeFilter, setThemeFilter] = React.useState<'all' | 'class' | 'fun'>('all');
  const themeOf = (item: ShopItem): string => item.theme || 'fun';
  const filteredItems = themeFilter === 'all' ? shopItems : shopItems.filter((item) => themeOf(item) === themeFilter);
  const themeCounts = {
    all: shopItems.length,
    class: shopItems.filter((item) => themeOf(item) === 'class').length,
    fun: shopItems.filter((item) => themeOf(item) === 'fun').length,
  };
  const ownedShopItems = shopItems.filter((item) => owned.includes(item.id));
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
    { label: 'PROFILE PICTURES', items: filteredItems.filter((item) => item.id.startsWith('profile-')) },
    { label: 'PROFILE BACKGROUNDS', items: filteredItems.filter((item) => item.id.startsWith('background-')) },
    { label: 'IDENTITY', items: filteredItems.filter((item) => item.category === 'Identity' && !item.id.startsWith('profile-') && !item.id.startsWith('background-')) },
    { label: 'CHAT', items: filteredItems.filter((item) => item.category === 'Chat') },
    { label: 'EFFECTS', items: filteredItems.filter((item) => item.category === 'Effects') },
    { label: 'TAGS', items: filteredItems.filter((item) => item.category === 'Tags') },
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
  return <section className="shop-section"><div className="section-heading"><div><div className="card-kicker">THE STARDUST SHOP</div><h2>Flex your <em>wealth.</em></h2></div><div className="shop-heading-actions">{(canManage || demoMode) && claimableCount > 0 && <button className="inventory-toggle" onClick={claimAll} disabled={claimingAll}>{claimingAll ? 'Claiming…' : `Claim all · ${claimableCount}`}</button>}<button className="inventory-toggle" onClick={() => setInventoryOpen((value) => !value)}>Inventory · {owned.length}</button><div className="wallet">✦ <strong>{balance ?? 0}</strong><span>STARDUST</span></div></div></div><p className="section-copy">Spend your sparkle on chat upgrades, identity flexes, and tiny bits of delightful chaos.</p>
<div className="theme-filter">
  <button className={`theme-filter-btn ${themeFilter === 'all' ? 'active' : ''}`} onClick={() => setThemeFilter('all')}>All · {themeCounts.all}</button>
  <button className={`theme-filter-btn ${themeFilter === 'class' ? 'active' : ''}`} onClick={() => setThemeFilter('class')}>🎓 Class · {themeCounts.class}</button>
  <button className={`theme-filter-btn ${themeFilter === 'fun' ? 'active' : ''}`} onClick={() => setThemeFilter('fun')}>✨ Fun · {themeCounts.fun}</button>
</div>
{inventoryOpen && <div className="inventory-panel"><div className="card-kicker">YOUR COLLECTION</div>{ownedShopItems.length ? ownedShopItems.map((item) => { const avatar = avatarFor(item.id); return <span className="inventory-item" key={item.id}>{avatar ? <img className="inventory-item-thumb" src={avatar.src} alt={item.name} loading="lazy" /> : item.emoji} {item.name}</span>; }) : <span className="inventory-empty">Your inventory is waiting for its first sparkle.</span>}</div>}{/* Shop items are grouped by type: Profile pictures, Profile backgrounds, then the other categories. */}
      {shopGroups.map((group) => <React.Fragment key={group.label}>
        <div className="card-kicker shop-group-kicker">{group.label}</div>
        <div className="shop-grid">{group.items.map((item) => <article className={`shop-item ${(item.active ?? true) ? '' : 'shop-item-hidden'}`} key={item.id}><div className="item-icon">{avatarFor(item.id) ? <img className="shop-item-thumb" src={avatarFor(item.id)!.src} alt={item.name} loading="lazy" /> : item.emoji}</div><div className="item-category">{item.category}</div><h3>{item.name}</h3><p>{item.description}</p>
          {item.id === 'neon-glow' && <div className="item-preview"><span className="preview-glow-name">MissV</span></div>}
          {item.id === 'cyber-style' && <div className="item-preview"><div className="preview-cyber-msg">&gt; hello world_</div></div>}
          {item.id === 'coin-vfx' && <div className="item-preview"><div className="preview-coin-burst"><span>🪙</span><span>🪙</span><span>🪙</span></div></div>}
        <button onClick={() => buy(item)} disabled={owned.includes(item.id)}>{owned.includes(item.id) ? 'Owned ✓' : (canManage || demoMode) ? 'Take it · Free' : `Buy · ${item.price} ✦`}</button>{canManage && <button className="item-visibility-toggle" onClick={() => toggleActive(item)}>{(item.active ?? true) ? 'Public 👁' : 'Hidden 🙈'}</button>}</article>)}</div>
      </React.Fragment>)}{notice && <div className="shop-notice">{notice}</div>}</section>;
}
