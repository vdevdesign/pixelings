import React from 'react';
import { usePixelingsChat } from '../src/hooks/usePixelingsChat';
import { CHAT_ROOMS, ChatRoom } from './chatRooms';
import { APPROVED_GIFS, GIF_MESSAGE_PREFIX } from './approvedGifs';

// Username color cosmetics mirror PixelingsChat's mapping.
const USERNAME_NAME_COLORS: Record<string, string> = {
  'name-coral': '#ff8a7a',
  'name-mint': '#7ef0c2',
  'name-lilac': '#c9a6ff',
  'name-honey': '#ffd06e',
  'name-sky': '#8fd4ff',
  'name-rose': '#ff9ec4',
  'name-lime': '#c6f95e',
  'name-aqua': '#7fe8ff',
};
const isNameColor = (id: string) => id.startsWith('name-');
const COIN_EMOJI = '\u{1FA99}';
const VFX_OPTIONS = [{ emoji: COIN_EMOJI, label: 'Coin burst' }];
const KID_FRIENDLY_EMOJIS = [
  '😀', '😂', '😊', '😇', '😎', '🤩', '🥳', '🥺', '😭', '😱',
  '❤️', '✨', '🌟', '🔥', '🌈', '☀️', '🌙', '☁️', '⚡', '❄️',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦄',
  '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
  '🍕', '🍔', '🍟', '🌭', '🍿', '🍦', '🍩', '🍪', '🍰', '🍬',
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🎯', '🎮',
  '🚀', '🛸', '🚁', '🏎️', '🚲', '⛵', '🛶', '🎡', '🎠', '🎢',
  '🎈', '🎁', '🎊', '🎉', '🎏', '🎇', '🎆', '🧸', '🎨', '🎬'
];

export function MiniChat({ userId, username, room, onRoomChange, demoMode = false, isModerator = false, chatCosmetics = { glow: '', tag: '', stickers: '', vfx: '', style: '' } }: { userId: string; username: string; room: ChatRoom; onRoomChange: (room: ChatRoom) => void; demoMode?: boolean; isModerator?: boolean; chatCosmetics?: { glow: string; tag: string; stickers: string; vfx: string; style: string; nameColor?: string } }) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [sendError, setSendError] = React.useState('');
  const [showVfxMenu, setShowVfxMenu] = React.useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = React.useState(false);
  const [showGifMenu, setShowGifMenu] = React.useState(false);
  const [gifSearch, setGifSearch] = React.useState('');
  const vfxMenuRef = React.useRef<HTMLDivElement>(null);
  const emojiMenuRef = React.useRef<HTMLDivElement>(null);
  const gifMenuRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const pendingScrollHeight = React.useRef<number | null>(null);
  const shouldFollowMessages = React.useRef(true);
  const { messages, isLive, loading, chatLoadError, historyError, hasMoreMessages, loadingOlderMessages, loadOlderMessages, sendMessage } = usePixelingsChat(room, userId, demoMode, isModerator);
  const roomIsLive = room === 'Teacher Lounge' && isModerator ? true : isLive;
  const canPost = roomIsLive || isModerator;
  const visibleRooms = CHAT_ROOMS.filter((option) => option !== 'Teacher Lounge' || isModerator);

  React.useEffect(() => {
    if (room === 'Teacher Lounge' && !isModerator) onRoomChange('Blender');
  }, [room, isModerator, onRoomChange]);

  React.useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !open) return;
    if (pendingScrollHeight.current !== null) {
      container.scrollTop += container.scrollHeight - pendingScrollHeight.current;
      pendingScrollHeight.current = null;
    } else if (shouldFollowMessages.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, open]);

  const handleMessagesScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    shouldFollowMessages.current = container.scrollHeight - container.scrollTop <= container.clientHeight + 40;
    if (container.scrollTop <= 24 && hasMoreMessages && !loadingOlderMessages) {
      pendingScrollHeight.current = container.scrollHeight;
      void loadOlderMessages();
    }
  };

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (vfxMenuRef.current && !vfxMenuRef.current.contains(event.target as Node)) {
        setShowVfxMenu(false);
      }
      if (emojiMenuRef.current && !emojiMenuRef.current.contains(event.target as Node)) {
        setShowEmojiMenu(false);
      }
      if (gifMenuRef.current && !gifMenuRef.current.contains(event.target as Node)) {
        setShowGifMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !canPost || chatLoadError) return;
    try {
      await sendMessage(input.trim(), undefined, username);
      setInput('');
      setSendError('');
    } catch (error) {
      console.error('Failed to send mini chat message:', error);
      setSendError(error instanceof Error ? error.message : 'Could not send that message.');
    }
  };

  const insertEmoji = async (emoji: string) => {
    const nextInput = input + emoji;
    setInput(nextInput);
    setShowEmojiMenu(false);
    if (emoji === COIN_EMOJI) {
      try {
        await sendMessage(nextInput, undefined, username);
        setInput('');
        setSendError('');
      } catch (error) {
        console.error('Failed to send mini chat effect:', error);
        setSendError(error instanceof Error ? error.message : 'Could not send that effect.');
      }
    }
  };

  const handleVfxSelect = async (emoji: string) => {
    setShowVfxMenu(false);
    setShowEmojiMenu(false);
    try {
      await sendMessage(emoji, undefined, username);
      setSendError('');
    } catch (error) {
      console.error('Failed to send mini chat effect:', error);
      setSendError(error instanceof Error ? error.message : 'Could not send that effect.');
    }
  };

  return <aside className={`mini-chat chat-card theme-${chatCosmetics.style || 'classic'} ${open ? 'open' : ''}`} aria-label="Mini chat">
    {open ? <>
      <div className="mini-chat-header chat-header"><div className="chat-title"><h3>{room}</h3><span className={`status-label ${roomIsLive ? 'live' : 'locked'}`}>{roomIsLive ? 'LIVE' : 'LOCKED'}</span></div><button onClick={() => setOpen(false)} aria-label="Minimize chat">−</button></div>
      <label className="mini-chat-room">Room<select className="whisper-select message-input" value={room} onChange={(event) => onRoomChange(event.target.value as ChatRoom)}>{visibleRooms.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      {chatLoadError && <p className="chat-load-error" role="alert">{chatLoadError}</p>}
      {sendError && <p className="chat-load-error" role="alert">{sendError}</p>}
      <div className="mini-chat-messages messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
        {loadingOlderMessages && <p className="history-loading">Loading earlier messages…</p>}
        {historyError && <p className="history-error" role="alert">{historyError}</p>}
        {loading ? <p className="empty">Loading chat...</p> : messages.map((message) => { 
        const isMine = message.sender_id === userId; 
        return (
          <div className={`mini-chat-message message ${isMine ? 'mine' : ''}`} key={message.id}>
            <b className={isMine && chatCosmetics.glow ? 'chat-name-glow' : ''} style={isMine && chatCosmetics.nameColor && isNameColor(chatCosmetics.nameColor) ? { color: USERNAME_NAME_COLORS[chatCosmetics.nameColor] } : undefined}>{message.sender_name}</b>
            {isMine && chatCosmetics.tag && <span className="equipped-chat-tag">{chatCosmetics.tag.replace(/^tag-/, '').replace(/-/g, ' ')}</span>}
            <p className={`bubble ${isMine ? 'mine' : ''} ${isMine && chatCosmetics.style === 'cyber-style' ? 'cyber-bubble' : ''}`}>
              {message.content.startsWith(GIF_MESSAGE_PREFIX)
                ? <img className="chat-gif-message" src={message.content.slice(GIF_MESSAGE_PREFIX.length)} alt="Shared GIF" loading="lazy" />
                : message.content}
              {message.content.includes('\u{1FA99}') && <span className="coin-burst" aria-label="coin effect"><span>🪙</span><span>🪙</span><span>🪙</span><span>🪙</span><span>🪙</span><span>🪙</span><span>🪙</span></span>}
            </p>
          </div>
        ); 
      })}</div>
      {showVfxMenu && <div className="mini-chat-menu" ref={vfxMenuRef} style={{ right: 'auto', left: '10px' }}>
        <div className="menu-section">
          <div className="menu-label">VFX</div>
          <div className="menu-grid">
            {VFX_OPTIONS.map((vfx) => <button key={vfx.label} title={vfx.label} onClick={() => handleVfxSelect(vfx.emoji)}>{vfx.emoji}</button>)}
          </div>
        </div>
      </div>}
      {showEmojiMenu && <div className="mini-chat-menu" ref={emojiMenuRef} style={{ right: 'auto', left: '40px' }}>
        <div className="menu-section">
          <div className="menu-label">Emojis</div>
          <div className="menu-grid">
            {KID_FRIENDLY_EMOJIS.map((emoji) => <button key={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}
          </div>
        </div>
      </div>}
      <form className="mini-chat-form composer" onSubmit={handleSend}>
        <button type="button" className="mini-chat-vfx-btn" onClick={() => { setShowVfxMenu(!showVfxMenu); setShowEmojiMenu(false); }} disabled={!canPost || Boolean(chatLoadError)}>✹</button>
        <button type="button" className="mini-chat-emoji-btn" onClick={() => { setShowEmojiMenu(!showEmojiMenu); setShowVfxMenu(false); }} disabled={!canPost || Boolean(chatLoadError)}>✨</button>
        <div className="picker-container">
          <button type="button" className="vfx-menu-toggle chat-gif-btn" onClick={() => {
            setShowGifMenu((value) => !value);
            setShowEmojiMenu(false);
            setShowVfxMenu(false);
          }} aria-label="Send a GIF" aria-expanded={showGifMenu} title="Send a GIF"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg></button>
          {showGifMenu && <div className="vfx-menu chat-gif-panel" ref={gifMenuRef} role="menu">
            <input type="search" className="gif-search" placeholder="Search GIFs…" value={gifSearch} onChange={(event) => setGifSearch(event.target.value)} aria-label="Search GIFs" />
            {APPROVED_GIFS.length === 0 ? <p className="gif-empty">No GIFs available yet.</p> : APPROVED_GIFS.filter((gif) => gif.name.toLowerCase().includes(gifSearch.trim().toLowerCase())).map((gif) => (
              <button key={gif.url} type="button" className="chat-gif-item" role="menuitem" title={gif.name} disabled={!canPost || Boolean(chatLoadError)} onClick={async () => {
                setShowGifMenu(false);
                setGifSearch('');
                try {
                  await sendMessage(GIF_MESSAGE_PREFIX + gif.url, undefined, username);
                  setSendError('');
                } catch (error) {
                  console.error('Failed to send mini chat GIF:', error);
                  setSendError(error instanceof Error ? error.message : 'Could not send that GIF.');
                }
              }}><img src={gif.url} alt={gif.name} loading="lazy" /></button>
            ))}
          </div>}
        </div>
        <input className="message-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={canPost ? 'Message the lounge...' : 'Chat is locked'} disabled={!canPost || Boolean(chatLoadError)} />
        <button className="send-button" type="submit" disabled={!canPost || Boolean(chatLoadError) || !input.trim()}>Send</button>
      </form>
    </> : <button className="mini-chat-launcher" onClick={() => setOpen(true)}><span className="mini-chat-bubble">✦</span> Open chat</button>}
  </aside>;
}
