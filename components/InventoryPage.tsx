import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { avatarItems, avatarItemById, backgroundItems, profileItems, type AvatarItem } from './avatarItems';

const AVATAR_PREFIXES = ['profile-', 'background-'];

const isAvatarItem = (id: string) => AVATAR_PREFIXES.some((prefix) => id.startsWith(prefix));

function AvatarPreview({ item }: { item: AvatarItem }) {
  if (item.kind === 'profile') {
    return <img className="inventory-avatar-thumb" src={item.src} alt={item.name} loading="lazy" />;
  }
  return (
    <span
      className="inventory-avatar-thumb inventory-avatar-bg"
      style={{ backgroundImage: `url(${item.src})` }}
      role="img"
      aria-label={item.name}
    />
  );
}

function AvatarCard({
  item,
  equippedProfile,
  equippedBackground,
  owned,
  onEquip,
  onUnequip,
  busy,
}: {
  item: AvatarItem;
  equippedProfile: string;
  equippedBackground: string;
  owned: string[];
  onEquip: (item: AvatarItem) => void;
  onUnequip: (item: AvatarItem) => void;
  busy: string | null;
}) {
  const equipped = item.kind === 'profile' ? equippedProfile === item.id : equippedBackground === item.id;
  const inInventory = owned.includes(item.id);
  return (
    <article className="shop-item inventory-card" key={item.id}>
      <AvatarPreview item={item} />
      <div className="item-category">{item.kind === 'profile' ? 'Profile picture' : 'Profile background'}</div>
      <h3>{item.name}</h3>
      <div className="inventory-actions">
        {equipped ? (
          <button onClick={() => onUnequip(item)} disabled={busy === item.id}>Unequip</button>
        ) : (
          <button onClick={() => onEquip(item)} disabled={!inInventory || busy === item.id}>
            {inInventory ? 'Equip' : 'Buy in the shop'}
          </button>
        )}
      </div>
      {equipped && <div className="equipped-tag">Equipped ✓</div>}
    </article>
  );
}

export function InventoryPage({
  accountId,
  demoMode,
  canManage,
  onProfileChange,
}: {
  accountId: string;
  demoMode?: boolean;
  canManage?: boolean;
  onProfileChange?: (profile: { avatarUrl: string | null; backgroundUrl: string | null }) => void;
}) {
  const [owned, setOwned] = React.useState<string[]>([]);
  const [equippedProfile, setEquippedProfile] = React.useState('');
  const [equippedBackground, setEquippedBackground] = React.useState('');
  const [balance, setBalance] = React.useState(demoMode ? 50000 : 650);
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (demoMode) { setBalance(50000); return; }
    if (accountId) supabase.from('stardust_wallets').select('balance').eq('user_id', accountId).single()
      .then(({ data }) => { if (data) setBalance(data.balance); });
    if (accountId) supabase.from('stardust_inventory').select('item_id').eq('user_id', accountId)
      .then(({ data }) => { if (data) setOwned(data.map((entry) => entry.item_id)); });
  }, [demoMode, accountId]);

  React.useEffect(() => {
    if (demoMode || !accountId) return;
    supabase.from('profiles').select('avatar_url, background_url').eq('id', accountId).single()
      .then(({ data }) => {
        if (!data) return;
        setEquippedProfile(data.avatar_url || '');
        setEquippedBackground(data.background_url || '');
      });
  }, [demoMode, accountId]);

  const saveEquip = async (profileId: string, backgroundId: string) => {
    if (demoMode || !accountId) return true;
    const { error } = await supabase.from('profiles').update({
      avatar_url: profileId || null,
      background_url: backgroundId || null,
    }).eq('id', accountId);
    if (error) { setNotice('Could not save that change. Please try again.'); return false; }
    return true;
  };

  const equip = async (item: AvatarItem) => {
    if (!owned.includes(item.id)) { setNotice(`${item.name} isn't in your inventory yet — buy it in the Stardust Shop.`); return; }
    setBusy(item.id); setNotice('');
    const nextProfile = item.kind === 'profile' ? item.id : equippedProfile;
    const nextBackground = item.kind === 'background' ? item.id : equippedBackground;
    if (await saveEquip(nextProfile, nextBackground)) {
      setEquippedProfile(nextProfile);
      setEquippedBackground(nextBackground);
      setNotice(`${item.name} equipped!`);
      onProfileChange?.({
        avatarUrl: avatarItemById.get(nextProfile)?.src ?? null,
        backgroundUrl: avatarItemById.get(nextBackground)?.src ?? null,
      });
    }
    setBusy(null);
  };

  const unequip = async (item: AvatarItem) => {
    setBusy(item.id); setNotice('');
    const nextProfile = item.kind === 'profile' ? '' : equippedProfile;
    const nextBackground = item.kind === 'background' ? '' : equippedBackground;
    if (await saveEquip(nextProfile, nextBackground)) {
      setEquippedProfile(nextProfile);
      setEquippedBackground(nextBackground);
      setNotice(`${item.name} unequipped.`);
      onProfileChange?.({
        avatarUrl: avatarItemById.get(nextProfile)?.src ?? null,
        backgroundUrl: avatarItemById.get(nextBackground)?.src ?? null,
      });
    }
    setBusy(null);
  };

  const avatarOwned = owned.filter(isAvatarItem);
  const ownedCards = avatarItems.filter((item) => avatarOwned.includes(item.id));
  const missing = avatarItems.filter((item) => !avatarOwned.includes(item.id));

  return (
    <section className="shop-section inventory-section">
      <div className="section-heading">
        <div>
          <div className="card-kicker">YOUR INVENTORY</div>
          <h2>Wear your <em>sparkle.</em></h2>
        </div>
        <div className="shop-heading-actions">
          <div className="wallet">✦ <strong>{balance}</strong><span>STARDUST</span></div>
        </div>
      </div>
      <p className="section-copy">Profile pictures and backgrounds you own. Equip one of each to style your profile.</p>

      <div className="inventory-preview-card">
        <div
          className="inventory-preview"
          style={equippedBackground && avatarItemById.get(equippedBackground)
            ? { backgroundImage: `url(${avatarItemById.get(equippedBackground)!.src})` }
            : undefined}
        >
          {equippedProfile && avatarItemById.get(equippedProfile)
            ? <img src={avatarItemById.get(equippedProfile)!.src} alt="Your equipped profile picture" />
            : <span className="inventory-preview-placeholder">No profile picture</span>}
        </div>
        <div className="inventory-preview-copy">
          <div className="card-kicker">CURRENT LOOK</div>
          <p>{equippedProfile ? avatarItemById.get(equippedProfile)?.name : 'No profile picture equipped'}</p>
          <p>{equippedBackground ? avatarItemById.get(equippedBackground)?.name : 'No background equipped'}</p>
        </div>
      </div>

      <div className="shop-grid">
        {ownedCards.map((item) => (
          <AvatarCard
            key={item.id}
            item={item}
            equippedProfile={equippedProfile}
            equippedBackground={equippedBackground}
            owned={owned}
            onEquip={equip}
            onUnequip={unequip}
            busy={busy}
          />
        ))}
      </div>
      {ownedCards.length === 0 && (
        <p className="inventory-empty">Your inventory is waiting for its first sparkle — visit the Stardust Shop!</p>
      )}

      {(canManage || demoMode) && missing.length > 0 && (
        <>
          <div className="card-kicker inventory-missing-kicker">NOT OWNED YET {canManage ? '· free for staff' : ''}</div>
          <div className="shop-grid">
            {missing.map((item) => (
              <AvatarCard
                key={item.id}
                item={item}
                equippedProfile={equippedProfile}
                equippedBackground={equippedBackground}
                owned={owned}
                onEquip={equip}
                onUnequip={unequip}
                busy={busy}
              />
            ))}
          </div>
        </>
      )}

      {notice && <div className="shop-notice">{notice}</div>}
    </section>
  );
}

// helpers used by the shop to render avatar items
export { profileItems, backgroundItems };
