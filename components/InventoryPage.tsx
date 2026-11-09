import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { avatarItems, avatarItemById } from './avatarItems';

type ChatSlot = 'glow' | 'tag' | 'stickers' | 'vfx' | 'style';
const chatSlots: Array<{ slot: ChatSlot; label: string }> = [
  { slot: 'glow', label: 'Username glow' }, { slot: 'tag', label: 'Chat tag' },
  { slot: 'stickers', label: 'Sticker set' }, { slot: 'vfx', label: 'Post VFX' }, { slot: 'style', label: 'Chat style' },
];
// Every chat theme (style) item maps to the 'style' slot, so newly added
// themes show up in the theme picker automatically once they are bought.
const CHAT_STYLE_IDS = ['cyber-style', 'style-pastel-dream', 'style-forest-grove', 'style-sunset-vibes', 'style-deep-space', 'style-candy-pop', 'style-blocky-craft', 'style-redstone-forge', 'style-kanto-league', 'style-team-rocket', 'style-green-hills', 'style-star-chili-dogs', 'style-mushroom-speedway'];
const slotFor = (id: string): ChatSlot | null => id === 'neon-glow' ? 'glow' : id === 'pixel-stickers' ? 'stickers' : id === 'coin-vfx' ? 'vfx' : CHAT_STYLE_IDS.includes(id) ? 'style' : id.startsWith('tag-') ? 'tag' : null;

export function InventoryPage({ accountId, demoMode, balance, ownedItems, onOwnedChange, onBalanceChange, onProfileChange, onChatCosmeticsChange }: { accountId: string; demoMode?: boolean; balance: number | null; ownedItems: string[]; onOwnedChange: (items: string[]) => void; onBalanceChange: (balance: number | null) => void; onProfileChange?: (profileId: string, backgroundId: string) => void; onChatCosmeticsChange?: (cosmetics: Record<ChatSlot, string>) => void }) {
  const [catalog, setCatalog] = React.useState<Record<string, { name: string; emoji: string }>>({});
  const [equipped, setEquipped] = React.useState<Record<ChatSlot, string>>({ glow: '', tag: '', stickers: '', vfx: '', style: '' });
  const [profile, setProfile] = React.useState('profile-happy-slime');
  const [background, setBackground] = React.useState('background-happy-slime');
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  React.useEffect(() => { if (!demoMode) supabase.from('stardust_shop').select('id,name,emoji').then(({ data }) => { if (data) setCatalog(Object.fromEntries(data.map((row: any) => [row.id, row]))); }); }, [demoMode]);
  React.useEffect(() => { if (!demoMode && accountId) supabase.from('profiles').select('avatar_url,background_url,equipped_chat_glow,equipped_chat_tag,equipped_chat_stickers,equipped_chat_vfx,equipped_chat_style').eq('id', accountId).single().then(({ data }) => { if (data) { setProfile(data.avatar_url || 'profile-happy-slime'); setBackground(data.background_url || 'background-happy-slime'); setEquipped({ glow: data.equipped_chat_glow || '', tag: data.equipped_chat_tag || '', stickers: data.equipped_chat_stickers || '', vfx: data.equipped_chat_vfx || '', style: data.equipped_chat_style || '' }); } }); }, [demoMode, accountId]);
  const save = async (nextProfile: string, nextBackground: string, next: Record<ChatSlot, string>) => { if (demoMode || !accountId) return true; const { error } = await supabase.from('profiles').update({ avatar_url: nextProfile || null, background_url: nextBackground || null, equipped_chat_glow: next.glow || null, equipped_chat_tag: next.tag || null, equipped_chat_stickers: next.stickers || null, equipped_chat_vfx: next.vfx || null, equipped_chat_style: next.style || null }).eq('id', accountId); if (error) { setNotice('Could not save that equipment change.'); return false; } return true; };
  const change = async (id: string, remove: boolean) => { setBusy(id); setNotice(''); const next = { ...equipped }; const slot = slotFor(id); if (slot) next[slot] = remove ? '' : id; const item = avatarItemById.get(id); const nextProfile = item?.kind === 'profile' ? (remove ? '' : id) : profile; const nextBackground = item?.kind === 'background' ? (remove ? '' : id) : background; if (await save(nextProfile, nextBackground, next)) { setProfile(nextProfile); setBackground(nextBackground); setEquipped(next); onProfileChange?.(nextProfile, nextBackground); onChatCosmeticsChange?.(next); setNotice(`${catalog[id]?.name || item?.name || id} ${remove ? 'unequipped' : 'equipped'}!`); } setBusy(null); };
  const isEquipped = (id: string) => profile === id || background === id || Object.values(equipped).includes(id);
  const avatars = avatarItems.filter((item) => ownedItems.includes(item.id));
  const chatItems = ownedItems.filter((id) => slotFor(id));
  const profileItems = avatars.filter((item) => item.kind === 'profile');
  const backgroundItems = avatars.filter((item) => item.kind === 'background');
  const profileItem = avatarItemById.get(profile);
  const backgroundItem = avatarItemById.get(background);
  const renderAvatarGroup = (title: string, items: typeof avatars) => items.length > 0 && <section className="inventory-group" aria-label={title}>
    <h3 className="inventory-group-heading">{title}</h3>
    <div className="shop-grid">{items.map((item) => <article className="shop-item inventory-card" key={item.id}>
      {item.kind === 'profile' ? <img className="inventory-avatar-thumb" src={item.src} alt={item.name} /> : <span className="inventory-avatar-thumb inventory-avatar-bg" style={{ backgroundImage: `url(${item.src})` }} role="img" aria-label={item.name} />}
      <h4>{item.name}</h4>
      <button onClick={() => change(item.id, isEquipped(item.id))} disabled={busy === item.id}>{isEquipped(item.id) ? 'Unequip' : 'Equip'}</button>
      {isEquipped(item.id) && <div className="equipped-tag">Equipped</div>}
    </article>)}</div>
  </section>;
  return <section className="shop-section inventory-section"><div className="inventory-wallet wallet">✦ <strong>{balance ?? 0}</strong><span>STARDUST</span></div><div className="inventory-preview-card"><div className="inventory-preview" style={backgroundItem ? { backgroundImage: `url(${backgroundItem.src})` } : undefined}>{profileItem ? <img src={profileItem.src} alt="Your equipped profile picture" /> : <span className="inventory-preview-placeholder">No profile picture</span>}</div><div className="inventory-preview-copy"><div className="card-kicker">CURRENT LOOK</div><p>{profileItem?.name || 'No profile picture equipped'}</p><p>{backgroundItem?.name || 'No profile background equipped'}</p></div></div>
    {renderAvatarGroup('Profile Pictures', profileItems)}
    {renderAvatarGroup('Profile Backgrounds', backgroundItems)}
    {chatSlots.map(({ slot, label }) => {
      const items = chatItems.filter((id) => slotFor(id) === slot);
      if (!items.length) return null;
      return <section className="inventory-group" key={slot} aria-label={label}>
        <h3 className="inventory-group-heading">{label}</h3>
        <div className="shop-grid">{items.map((id) => { const item = catalog[id]; return <article className="shop-item inventory-card" key={id}>
          <div className="item-icon">{item?.emoji || '✦'}</div>
          <h4>{item?.name || id}</h4>
          <button onClick={() => change(id, isEquipped(id))} disabled={busy === id}>{isEquipped(id) ? 'Unequip' : 'Equip'}</button>
          {isEquipped(id) && <div className="equipped-tag">Equipped</div>}
        </article>; })}</div>
      </section>;
    })}
    {ownedItems.length === 0 && <p className="inventory-empty">No items yet. Visit the Stardust Shop.</p>}{notice && <div className="shop-notice">{notice}</div>}</section>;
}
