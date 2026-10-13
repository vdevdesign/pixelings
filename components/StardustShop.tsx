import React from 'react';
import { supabase } from '../lib/supabaseClient';

type ShopItem = { id: string; name: string; description: string; category: string; price: number; emoji: string };
const fallbackItems: ShopItem[] = [
  { id: 'avatar-pack', name: 'Pixel Avatar Pack', description: 'Retro faces and character frames for your profile.', category: 'Identity', price: 120, emoji: '✦' },
  { id: 'neon-glow', name: 'Neon Username Glow', description: 'Give your chat name a soft electric aura.', category: 'Identity', price: 180, emoji: '◈' },
  { id: 'vip-title', name: 'VIP Chat Title', description: 'A tiny [VIP] tag to flex beside your name.', category: 'Identity', price: 250, emoji: '★' },
  { id: 'pixel-stickers', name: 'Pixel Sticker Set', description: 'Exclusive stickers for big reactions in chat.', category: 'Chat', price: 150, emoji: '☻' },
  { id: 'coin-vfx', name: 'Coin Collect VFX', description: 'Trigger a cheerful coin burst when you post.', category: 'Effects', price: 300, emoji: '✹' },
  { id: 'cyber-style', name: 'Cyberpunk Chat Style', description: 'A dark neon skin for your chat messages.', category: 'Chat', price: 220, emoji: '⌁' },
];

export function StardustShop({ userId, demoMode }: { userId: string; demoMode?: boolean }) {
  const [items, setItems] = React.useState<ShopItem[]>(fallbackItems);
  const [owned, setOwned] = React.useState<string[]>([]);
  const [balance, setBalance] = React.useState(650);
  const [notice, setNotice] = React.useState('');
  const [inventoryOpen, setInventoryOpen] = React.useState(false);

  React.useEffect(() => {
    if (demoMode) return;
    supabase.from('stardust_shop').select('id,name,description,category,price,emoji').eq('active', true).order('sort_order')
      .then(({ data }) => { if (data?.length) setItems(data as ShopItem[]); });
    if (userId) supabase.from('stardust_wallets').select('balance').eq('user_id', userId).single().then(({ data }) => { if (data) setBalance(data.balance); });
    if (userId) supabase.from('stardust_inventory').select('item_id').eq('user_id', userId).then(({ data }) => { if (data) setOwned(data.map((entry) => entry.item_id)); });
  }, [demoMode, userId]);

  const buy = async (item: ShopItem) => {
    if (owned.includes(item.id)) return setNotice(`${item.name} is already in your collection.`);
    if (balance < item.price) return setNotice('Not enough Stardust yet — play a minigame!');
    if (!demoMode && userId) {
      const { data: remaining, error } = await supabase.rpc('buy_stardust_item', { item: item.id });
      if (error) return setNotice(error.message.includes('Not enough') ? 'Not enough Stardust yet — play a minigame!' : 'Could not complete that purchase.');
      setBalance(remaining as number);
    } else setBalance((value) => value - item.price);
    setOwned((value) => [...value, item.id]); setNotice(`${item.name} unlocked!`);
  };
  const ownedItems = items.filter((item) => owned.includes(item.id));
  return <section className="shop-section"><div className="section-heading"><div><div className="card-kicker">THE STARDUST SHOP</div><h2>Flex your <em>wealth.</em></h2></div><div className="shop-heading-actions"><button className="inventory-toggle" onClick={() => setInventoryOpen((value) => !value)}>Inventory · {owned.length}</button><div className="wallet">✦ <strong>{balance}</strong><span>STARDUST</span></div></div></div><p className="section-copy">Spend your sparkle on chat upgrades, identity flexes, and tiny bits of delightful chaos.</p>{inventoryOpen && <div className="inventory-panel"><div className="card-kicker">YOUR COLLECTION</div>{ownedItems.length ? ownedItems.map((item) => <span className="inventory-item" key={item.id}>{item.emoji} {item.name}</span>) : <span className="inventory-empty">Your inventory is waiting for its first sparkle.</span>}</div>}<div className="shop-grid">{items.map((item) => <article className="shop-item" key={item.id}><div className="item-icon">{item.emoji}</div><div className="item-category">{item.category}</div><h3>{item.name}</h3><p>{item.description}</p><button onClick={() => buy(item)} disabled={owned.includes(item.id)}>{owned.includes(item.id) ? 'Owned ✓' : `Buy · ${item.price} ✦`}</button></article>)}</div>{notice && <div className="shop-notice">{notice}</div>}</section>;
}
