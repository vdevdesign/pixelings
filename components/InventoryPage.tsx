import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { avatarItems, avatarItemById } from './avatarItems';

type ChatSlot = 'glow' | 'tag' | 'stickers' | 'vfx' | 'style';
// Username colors live in the Identity category of the shop. Equipping one
// tints the student's chat name with that color.
export type UsernameColor = { id: string; name: string; css: string; emoji: string };
export const USERNAME_COLORS: UsernameColor[] = [
  { id: 'name-coral', name: 'Coral Name', css: '#ff8a7a', emoji: '🪸' },
  { id: 'name-mint', name: 'Mint Name', css: '#7ef0c2', emoji: '🌿' },
  { id: 'name-lilac', name: 'Lilac Name', css: '#c9a6ff', emoji: '💜' },
  { id: 'name-honey', name: 'Honey Name', css: '#ffd06e', emoji: '🍯' },
  { id: 'name-sky', name: 'Sky Name', css: '#8fd4ff', emoji: '🌤️' },
  { id: 'name-rose', name: 'Rose Name', css: '#ff9ec4', emoji: '🌹' },
  { id: 'name-lime', name: 'Lime Name', css: '#c6f95e', emoji: '🍋' },
  { id: 'name-aqua', name: 'Aqua Name', css: '#7fe8ff', emoji: '🌊' },
];
const usernameColorOf = (id: string): UsernameColor | undefined => USERNAME_COLORS.find((color) => color.id === id);
const chatSlots: Array<{ slot: ChatSlot; label: string }> = [
  { slot: 'glow', label: 'Username glow' }, { slot: 'tag', label: 'Chat tag' },
  { slot: 'stickers', label: 'Sticker set' }, { slot: 'vfx', label: 'Post VFX' }, { slot: 'style', label: 'Chat style' },
];
// Every chat theme (style) item maps to the 'style' slot, so newly added
// themes show up in the theme picker automatically once they are bought.
const CHAT_STYLE_IDS = ['cyber-style', 'style-pastel-dream', 'style-forest-grove', 'style-sunset-vibes', 'style-deep-space', 'style-candy-pop', 'style-blocky-craft', 'style-redstone-forge', 'style-kanto-league', 'style-team-rocket', 'style-green-hills', 'style-star-chili-dogs', 'style-mushroom-speedway'];
// Bundle the chat-theme preview CSS with the inventory so the preview card
// matches what students see in chat.
const CHAT_STYLE_PREVIEWS: Record<string, string> = {
  'cyber-style': '⚡ Neon glitch on dark grid',
  'style-pastel-dream': '☁ Soft clouds and lavender',
  'style-forest-grove': '☘ Leafy moss greens',
  'style-sunset-vibes': '☀ Warm orange-pink sky',
  'style-deep-space': '✦ Starfield on midnight',
  'style-candy-pop': '♡ Bubblegum pink pop',
  'style-blocky-craft': '⛏ Pixel dirt and grass',
  'style-redstone-forge': '🔥 Molten redstone glow',
  'style-kanto-league': '⚡ Champion yellow-blue',
  'style-team-rocket': '🚀 Villain red and black',
  'style-green-hills': '🌀 Speedy hillside loops',
  'style-star-chili-dogs': '⭐ Golden starry night',
  'style-mushroom-speedway': '🍄 Kart-racing sparkles',
};
const slotFor = (id: string): ChatSlot | null => usernameColorOf(id) ? 'glow' : id === 'neon-glow' ? 'glow' : id === 'pixel-stickers' ? 'stickers' : id === 'coin-vfx' ? 'vfx' : CHAT_STYLE_IDS.includes(id) ? 'style' : id.startsWith('tag-') ? 'tag' : null;
// Sections with more than this many items collapse behind a "View all" toggle.
const COLLAPSED_LIMIT = 8;

export function InventoryPage({ accountId, demoMode, balance, ownedItems, onOwnedChange, onBalanceChange, onProfileChange, onChatCosmeticsChange }: { accountId: string; demoMode?: boolean; balance: number | null; ownedItems: string[]; onOwnedChange: (items: string[]) => void; onBalanceChange: (balance: number | null) => void; onProfileChange?: (profileId: string, backgroundId: string) => void; onChatCosmeticsChange?: (cosmetics: Record<ChatSlot, string>) => void }) {
  const [catalog, setCatalog] = React.useState<Record<string, { name: string; emoji: string }>>({});
  const [equipped, setEquipped] = React.useState<Record<ChatSlot, string>>({ glow: '', tag: '', stickers: '', vfx: '', style: '' });
  const [profile, setProfile] = React.useState('profile-happy-slime');
  const [background, setBackground] = React.useState('background-happy-slime');
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => { if (!demoMode) supabase.from('stardust_shop').select('id,name,emoji').then(({ data }) => { if (data) setCatalog(Object.fromEntries(data.map((row: any) => [row.id, row]))); }); }, [demoMode]);
  React.useEffect(() => { if (!demoMode && accountId) supabase.from('profiles').select('avatar_url,background_url,equipped_chat_glow,equipped_chat_tag,equipped_chat_stickers,equipped_chat_vfx,equipped_chat_style').eq('id', accountId).single().then(({ data }) => { if (data) { setProfile(data.avatar_url || 'profile-happy-slime'); setBackground(data.background_url || 'background-happy-slime'); setEquipped({ glow: data.equipped_chat_glow || '', tag: data.equipped_chat_tag || '', stickers: data.equipped_chat_stickers || '', vfx: data.equipped_chat_vfx || '', style: data.equipped_chat_style || '' }); } }); }, [demoMode, accountId]);
  const save = async (nextProfile: string, nextBackground: string, next: Record<ChatSlot, string>) => { if (demoMode || !accountId) return true; const { error } = await supabase.from('profiles').update({ avatar_url: nextProfile || null, background_url: nextBackground || null, equipped_chat_glow: next.glow || null, equipped_chat_tag: next.tag || null, equipped_chat_stickers: next.stickers || null, equipped_chat_vfx: next.vfx || null, equipped_chat_style: next.style || null }).eq('id', accountId); if (error) { setNotice('Could not save that equipment change.'); return false; } return true; };
  const change = async (id: string, remove: boolean) => { setBusy(id); setNotice(''); const next = { ...equipped }; const slot = slotFor(id); if (slot) next[slot] = remove ? '' : id; const item = avatarItemById.get(id); const nextProfile = item?.kind === 'profile' ? (remove ? '' : id) : profile; const nextBackground = item?.kind === 'background' ? (remove ? '' : id) : background; if (await save(nextProfile, nextBackground, next)) { setProfile(nextProfile); setBackground(nextBackground); setEquipped(next); onProfileChange?.(nextProfile, nextBackground); onChatCosmeticsChange?.(next); setNotice(`${catalog[id]?.name || item?.name || id} ${remove ? 'unequipped' : 'equipped'}!`); } setBusy(null); };
  const isEquipped = (id: string) => profile === id || background === id || Object.values(equipped).includes(id);
  const chatStyleId = CHAT_STYLE_IDS.includes(equipped.style) ? equipped.style : '';
  const equippedColor = usernameColorOf(equipped.glow);
  const equippedGlowName = chatStyleId ? CHAT_STYLE_PREVIEWS[chatStyleId] || 'Custom chat theme' : 'Classic chat theme';
  const previewName = equippedColor ? 'Kai 🎨' : 'Preview';
  const previewItems = avatarItems.filter((item) => ownedItems.includes(item.id));
  const profileItems = previewItems.filter((item) => item.kind === 'profile');
  const backgroundItems = previewItems.filter((item) => item.kind === 'background');
  const chatItems = ownedItems.filter((id) => slotFor(id));
  const profileItem = avatarItemById.get(profile);
  const backgroundItem = avatarItemById.get(background);
  const renderInventoryItem = (item: { id: string; name: string; emoji?: string }) => {
    const avatar = avatarItemById.get(item.id);
    const color = usernameColorOf(item.id);
    return (
      <article className="shop-item inventory-card" key={item.id}>
        {avatar ? (
          avatar.kind === 'profile'
            ? <img className="inventory-avatar-thumb" src={avatar.src} alt={item.name} />
            : <span className="inventory-avatar-thumb inventory-avatar-bg" style={{ backgroundImage: `url(${avatar.src})` }} role="img" aria-label={item.name} />
        ) : color ? (
          <div className="item-icon inventory-name-color-swatch" style={{ background: color.css }} aria-hidden="true" />
        ) : (
          <div className="item-icon">{item.emoji || '✦'}</div>
        )}
        <h4>{item.name}</h4>
        <button onClick={() => change(item.id, isEquipped(item.id))} disabled={busy === item.id}>{isEquipped(item.id) ? 'Unequip' : 'Equip'}</button>
        {isEquipped(item.id) && <div className="equipped-tag">Equipped</div>}
      </article>
    );
  };
  // Sections with more than COLLAPSED_LIMIT items collapse behind a toggle,
  // matching the shop's behavior.
  const renderInventoryItems = (items: Array<{ id: string; name: string; emoji?: string }>) => {
    const key = items.map((item) => item.id).join('|');
    const collapsed = items.length > COLLAPSED_LIMIT && !expandedGroups[key];
    const visible = collapsed ? items.slice(0, COLLAPSED_LIMIT) : items;
    const hiddenCount = items.length - COLLAPSED_LIMIT;
    return <>
      {visible.map(renderInventoryItem)}
      {items.length > COLLAPSED_LIMIT && <button className="view-all-btn inventory-view-all" onClick={() => setExpandedGroups((state) => ({ ...state, [key]: !state[key] }))}>{collapsed ? `View all ${hiddenCount} more · ${items.length}` : 'Show less'}</button>}
    </>;
  };
  const renderAvatarGroup = (title: string, items: typeof previewItems) => items.length > 0 && <section className="inventory-group" aria-label={title}>
    <h3 className="inventory-group-heading">{title}</h3>
    <div className="shop-grid">{renderInventoryItems(items.map((item) => ({ id: item.id, name: item.name })))}</div>
  </section>;
  return <section className="shop-section inventory-section"><div className="inventory-preview-card">
    <div className="inventory-preview" style={backgroundItem ? { backgroundImage: `url(${backgroundItem.src})` } : undefined}>{profileItem ? <img src={profileItem.src} alt="Your equipped profile picture" /> : <span className="inventory-preview-placeholder">No profile picture</span>}</div>
    <div className="inventory-preview-copy">
      <div className="card-kicker">CURRENT LOOK</div>
      <p>{profileItem?.name || 'No profile picture equipped'}</p>
      <p>{backgroundItem?.name || 'No profile background equipped'}</p>
    </div>
    <div className="inventory-theme-preview">
      <div className="card-kicker">CHAT THEME</div>
      <div className={`inventory-theme-preview-bubble ${chatStyleId ? `theme-${chatStyleId}` : 'theme-classic'}`}>
        <span className="inventory-theme-preview-name" style={equippedColor ? { color: equippedColor.css } : undefined}>{previewName}</span>
        <span className="inventory-theme-preview-msg">hey pixelings! 👋</span>
      </div>
      <p className="inventory-theme-preview-caption">{equippedGlowName}{equippedColor ? ` · ${equippedColor.name}` : ''}{chatStyleId ? '' : ' · free default'}</p>
    </div>
  </div>
    {renderAvatarGroup('Profile Pictures', profileItems)}
    {renderAvatarGroup('Profile Backgrounds', backgroundItems)}
    {chatSlots.map(({ slot, label }) => {
      const items = chatItems.filter((id) => slotFor(id) === slot);
      if (!items.length) return null;
      return <section className="inventory-group" key={slot} aria-label={label}>
        <h3 className="inventory-group-heading">{label}</h3>
        <div className="shop-grid">{renderInventoryItems(items.map((id) => ({ id, name: catalog[id]?.name || id, emoji: catalog[id]?.emoji || '✦' })))}</div>
      </section>;
    })}
    {ownedItems.length === 0 && <p className="inventory-empty">No items yet. Visit the Stardust Shop.</p>}{notice && <div className="shop-notice">{notice}</div>}</section>;
}
