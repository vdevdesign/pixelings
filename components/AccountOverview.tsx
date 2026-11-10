import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { avatarItemById } from './avatarItems';

interface AccountCard {
  id: string;
  username: string;
  approved_nickname: string | null;
  avatar_url: string | null;
  background_url: string | null;
  equipped_chat_tag: string | null;
  equipped_chat_glow: string | null;
  equipped_chat_name_color: string | null;
  equipped_chat_style: string | null;
  equipped_chat_stickers: string | null;
  equipped_chat_vfx: string | null;
}

const NAME_COLORS: Record<string, string> = {
  'name-coral': '#ff8a7a',
  'name-mint': '#7ef0c2',
  'name-lilac': '#c9a6ff',
  'name-honey': '#ffd06e',
  'name-sky': '#8fd4ff',
  'name-rose': '#ff9ec4',
  'name-lime': '#c6f95e',
  'name-aqua': '#7fe8ff',
};

const tagLabel = (id: string | null) => id ? id.replace(/^tag-/, '').replace(/-/g, ' ') : '';

// Teacher-facing account overview: every student as a 4-column card showing
// their avatar, name, nickname, Stardust balance, inventory size and equipped
// cosmetics (tags as bubbles inside the profile box).
export const AccountOverview: React.FC = () => {
  const [accounts, setAccounts] = React.useState<AccountCard[]>([]);
  const [balances, setBalances] = React.useState<Record<string, number>>({});
  const [inventoryCounts, setInventoryCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, approved_nickname, avatar_url, background_url, equipped_chat_tag, equipped_chat_glow, equipped_chat_name_color, equipped_chat_style, equipped_chat_stickers, equipped_chat_vfx')
        .eq('role', 'computer')
        .order('username');
      if (cancelled) return;
      if (error) setError(error.message);
      else if (data) {
        const rows = data as AccountCard[];
        setAccounts(rows);
        const ids = rows.map((row) => row.id);
        const [{ data: walletRows }, { data: invRows }] = await Promise.all([
          supabase.from('stardust_wallets').select('user_id, balance').in('user_id', ids),
          supabase.from('stardust_inventory').select('user_id, item_id').in('user_id', ids),
        ]);
        if (cancelled) return;
        const walletMap: Record<string, number> = {};
        ((walletRows || []) as { user_id: string; balance: number }[]).forEach((row) => { walletMap[row.user_id] = row.balance; });
        const invMap: Record<string, number> = {};
        ((invRows || []) as { user_id: string }[]).forEach((row) => { invMap[row.user_id] = (invMap[row.user_id] || 0) + 1; });
        setBalances(walletMap);
        setInventoryCounts(invMap);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="accounts-loading">Loading accounts…</p>;
  if (error) return <p className="student-error" role="alert">{error}</p>;

  return <section className="accounts-overview">
    <p className="accounts-summary">{accounts.length} student account{accounts.length === 1 ? '' : 's'}</p>
    <div className="accounts-grid">
      {accounts.map((account) => {
        const profile = avatarItemById.get(account.avatar_url || '');
        const background = avatarItemById.get(account.background_url || '');
        const displayName = account.approved_nickname || account.username;
        const colorCss = account.equipped_chat_name_color ? NAME_COLORS[account.equipped_chat_name_color] : undefined;
        const tag = tagLabel(account.equipped_chat_tag);
        const styleName = account.equipped_chat_style
          ? account.equipped_chat_style.replace(/^style-|^cyber-/, '').replace(/-/g, ' ')
          : '';
        return <article className="account-card" key={account.id}>
          <div className="account-card-portrait" style={background ? { backgroundImage: `url(${background.src})` } : undefined}>
            {profile
              ? <img className={`account-avatar ${account.equipped_chat_glow ? 'chat-name-glow' : ''}`} src={profile.src} alt={displayName} />
              : <span className="account-avatar account-avatar-placeholder">✦</span>}
          </div>
          <h4 className="account-name" style={colorCss ? { color: colorCss } : undefined}>{displayName}</h4>
          {account.approved_nickname && account.approved_nickname !== account.username && <p className="account-realname">school name: {account.username}</p>}
          <div className="account-stats">
            <span className="account-stat" title="Stardust balance">✦ {balances[account.id] ?? 0}</span>
            <span className="account-stat" title="Items owned">🎒 {inventoryCounts[account.id] ?? 0}</span>
          </div>
          <div className="account-tags">
            {tag && <span className="account-bubble account-bubble-tag">🏷 {tag}</span>}
            {account.equipped_chat_glow && <span className="account-bubble">◈ glow</span>}
            {colorCss && <span className="account-bubble" style={{ borderColor: colorCss }}>🎨 {(account.equipped_chat_name_color || '').replace('name-', '')}</span>}
            {styleName && <span className="account-bubble">🎭 {styleName}</span>}
            {account.equipped_chat_stickers && <span className="account-bubble">☻ stickers</span>}
            {account.equipped_chat_vfx && <span className="account-bubble">✹ vfx</span>}
          </div>
        </article>;
      })}
    </div>
  </section>;
};
