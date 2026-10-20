import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { avatarItemById, avatarItems, type AvatarItem } from './avatarItems';

type ShopItem = { id: string; name: string; description: string; category: string; price: number; emoji: string; active?: boolean };
// Profile pictures & backgrounds ship with the app (bundled from src/assets),
// so they are always available as individual purchasable items.
const avatarShopItems: ShopItem[] = avatarItems.map((item: AvatarItem) => ({
  id: item.id,
  name: item.name,
  description: item.kind === 'profile'
    ? `${item.name} profile picture for your Pixelings profile.`
    : `${item.name} background for your Pixelings profile.`,
  category: 'Identity',
  price: item.price,
  emoji: item.kind === 'profile' ? '🖼' : '🌌',
}));
const fallbackItems: ShopItem[] = [
  ...avatarShopItems,
  { id: 'neon-glow', name: 'Neon Username Glow', description: 'Give your chat name a soft electric aura.', category: 'Identity', price: 180, emoji: '◈' },
  { id: 'vip-title', name: 'VIP Chat Title', description: 'A tiny [VIP] tag to flex beside your name.', category: 'Identity', price: 250, emoji: '★' },
  { id: 'pixel-stickers', name: 'Pixel Sticker Set', description: 'Exclusive stickers for big reactions in chat.', category: 'Chat', price: 150, emoji: '☻' },
  { id: 'coin-vfx', name: 'Coin Collect VFX', description: 'Trigger a cheerful coin burst when you post.', category: 'Effects', price: 300, emoji: '✹' },
  { id: 'cyber-style', name: 'Cyberpunk Chat Style', description: 'A dark neon skin for your chat messages.', category: 'Chat', price: 220, emoji: '⌁' },
];

export function StardustShop({ accountId, demoMode, canManage }: { accountId: string; demoMode?: boolean; canManage?: boolean }) {
  const [items, setItems] = React.useState<ShopItem[]>(fallbackItems);
  const [owned, setOwned] = React.useState<string[]>([]);
  // Testing/preview mode gets a big sandbox balance; real balances load from the wallet.
  const [balance, setBalance] = React.useState(demoMode ? 50000 : 650);
  const [notice, setNotice] = React.useState('');
  const [inventoryOpen, setInventoryOpen] = React.useState(false);

  React.useEffect(() => {
    if (demoMode) { setBalance(50000); return; }
    supabase.from('stardust_shop').select('id,name,description,category,price,emoji,active').order('sort_order')
      .then(({ data }) => {
        if (!data?.length) return;
        // Merge DB rows with the bundled avatar items so profile pictures and
        // backgrounds always appear even if the DB seed is missing them.
        const dbIds = new Set(data.map((row) => row.id));
        const merged = [...(data as ShopItem[]), ...avatarShopItems.filter((item) => !dbIds.has(item.id))];
        setItems(merged);
      });
    // Inventory belongs to the authenticated account, not the selected child
    // profile (which is only a chat identity).
    if (accountId) supabase.from('stardust_wallets').select('balance').eq('user_id', accountId).single().then(({ data }) => { if (data) setBalance(data.balance); });
    if (accountId) supabase.from('stardust_inventory').select('item_id').eq('user_id', accountId).then(({ data }) => { if (data) setOwned(data.map((entry) => entry.item_id)); });
  }, [demoMode, accountId]);

  const buy = async (item: ShopItem) => {
    if (owned.includes(item.id)) return setNotice(`${item.name} is already in your collection.`);
    // Teachers and testing mode never spend Stardust — everything is free.
    const free = canManage || demoMode;
    if (!free && balance < item.price) return setNotice('Not enough Stardust yet — play a minigame!');
    if (!free && accountId) {
      const { data: remaining, error } = await supabase.rpc('buy_stardust_item', { item: item.id });
      if (error) return setNotice(error.message.includes('Not enough') ? 'Not enough Stardust yet — play a minigame!' : 'Could not complete that purchase.');
      setBalance(remaining as number);
    }
    setOwned((value) => [...value, item.id]); setNotice(`${item.name} unlocked!${free ? ' (Free for teachers)' : ''}`);
  };
  const shopItems = items.filter((item) => canManage || (item.active ?? true));
  const ownedItems = shopItems.filter((item) => owned.includes(item.id));
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
  return <section className="shop-section"><div className="section-heading"><div><div className="card-kicker">THE STARDUST SHOP</div><h2>Flex your <em>wealth.</em></h2></div><div className="shop-heading-actions"><button className="inventory-toggle" onClick={() => setInventoryOpen((value) => !value)}>Inventory · {owned.length}</button><div className="wallet">✦ <strong>{balance}</strong><span>STARDUST</span></div></div></div><p className="section-copy">Spend your sparkle on chat upgrades, identity flexes, and tiny bits of delightful chaos.</p>{inventoryOpen && <div className="inventory-panel"><div className="card-kicker">YOUR COLLECTION</div>{ownedItems.length ? ownedItems.map((item) => { const avatar = avatarFor(item.id); return <span className="inventory-item" key={item.id}>{avatar ? <img className="inventory-item-thumb" src={avatar.src} alt={item.name} loading="lazy" /> : item.emoji} {item.name}</span>; }) : <span className="inventory-empty">Your inventory is waiting for its first sparkle.</span>}</div>}<div className="shop-grid">{shopItems.map((item) => <article className={`shop-item ${(item.active ?? true) ? '' : 'shop-item-hidden'}`} key={item.id}><div className="item-icon">{avatarFor(item.id) ? <img className="shop-item-thumb" src={avatarFor(item.id)!.src} alt={item.name} loading="lazy" /> : item.emoji}</div><div className="item-category">{item.category}</div><h3>{item.name}</h3><p>{item.description}</p><button onClick={() => buy(item)} disabled={owned.includes(item.id)}>{owned.includes(item.id) ? 'Owned ✓' : (canManage || demoMode) ? 'Take it · Free' : `Buy · ${item.price} ✦`}</button>{canManage && <button className="item-visibility-toggle" onClick={() => toggleActive(item)}>{(item.active ?? true) ? 'Public 👁' : 'Hidden 🙈'}</button>}</article>)}</div>{notice && <div className="shop-notice">{notice}</div>}</section>;
}
