import React from 'react';
import { usePixelingsChat } from '../src/hooks/usePixelingsChat';
import { CHAT_ROOMS, ChatRoom } from './chatRooms';

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

export function MiniChat({ userId, username, room, onRoomChange, demoMode = false, chatCosmetics = { glow: '', tag: '', stickers: '', vfx: '', style: '' }, externalState }: { userId: string; username: string; room: ChatRoom; onRoomChange: (room: ChatRoom) => void; demoMode?: boolean; chatCosmetics?: { glow: string; tag: string; stickers: string; vfx: string; style: string }; externalState?: any }) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [showVfxMenu, setShowVfxMenu] = React.useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = React.useState(false);
  const vfxMenuRef = React.useRef<HTMLDivElement>(null);
  const emojiMenuRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const { messages, isLive, loading, sendMessage } = usePixelingsChat(room, userId, demoMode, false, externalState);

  React.useEffect(() => {
    if (messagesContainerRef.current && open) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, open]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (vfxMenuRef.current && !vfxMenuRef.current.contains(event.target as Node)) {
        setShowVfxMenu(false);
      }
      if (emojiMenuRef.current && !emojiMenuRef.current.contains(event.target as Node)) {
        setShowEmojiMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !isLive) return;
    await sendMessage(input.trim(), undefined, username);
    setInput('');
  };

  const insertEmoji = async (emoji: string) => {
    const nextInput = input + emoji;
    setInput(nextInput);
    setShowEmojiMenu(false);
    if (emoji === COIN_EMOJI) {
      await sendMessage(nextInput, undefined, username);
      setInput('');
    }
  };

  const handleVfxSelect = async (emoji: string) => {
    setShowVfxMenu(false);
    setShowEmojiMenu(false);
    await sendMessage(emoji, undefined, username);
  };

  return <aside className={`mini-chat ${open ? 'open' : ''}`} aria-label="Mini chat">
    {open ? <>
      <div className="mini-chat-header"><div><strong>{room}</strong><span>{isLive ? 'LIVE' : 'LOCKED'}</span></div><button onClick={() => setOpen(false)} aria-label="Minimize chat">−</button></div>
      <label className="mini-chat-room">Room<select value={room} onChange={(event) => onRoomChange(event.target.value as ChatRoom)}>{CHAT_ROOMS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      <div className="mini-chat-messages" ref={messagesContainerRef}>{loading ? <p className="empty">Loading chat...</p> : messages.slice(-8).map((message) => { 
        const isMine = message.sender_id === userId; 
        return (
          <div className={`mini-chat-message ${isMine ? 'mine' : ''}`} key={message.id}>
            <b className={isMine && chatCosmetics.glow ? 'chat-name-glow' : ''}>{message.sender_name}</b>
            {isMine && chatCosmetics.tag && <span className="equipped-chat-tag">{chatCosmetics.tag.replace(/^tag-/, '').replace(/-/g, ' ')}</span>}
            <p className={isMine && chatCosmetics.style === 'cyber-style' ? 'cyber-bubble' : ''}>
              {message.content}
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
      <form className="mini-chat-form" onSubmit={handleSend}>
        <button type="button" className="mini-chat-vfx-btn" onClick={() => { setShowVfxMenu(!showVfxMenu); setShowEmojiMenu(false); }} disabled={!isLive}>✹</button>
        <button type="button" className="mini-chat-emoji-btn" onClick={() => { setShowEmojiMenu(!showEmojiMenu); setShowVfxMenu(false); }} disabled={!isLive}>✨</button>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={isLive ? 'Message the lounge...' : 'Chat is locked'} disabled={!isLive} />
        <button type="submit" disabled={!isLive || !input.trim()}>Send</button>
      </form>
    </> : <button className="mini-chat-launcher" onClick={() => setOpen(true)}><span className="mini-chat-bubble">✦</span> Open chat</button>}
  </aside>;
}
