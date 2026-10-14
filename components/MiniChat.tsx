import React from 'react';
import { usePixelingsChat } from '../src/hooks/usePixelingsChat';
import { CHAT_ROOMS, ChatRoom } from './chatRooms';

export function MiniChat({ userId, username, room, onRoomChange, demoMode = false }: { userId: string; username: string; room: ChatRoom; onRoomChange: (room: ChatRoom) => void; demoMode?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const { messages, isLive, loading, sendMessage } = usePixelingsChat(room, userId, demoMode, false);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !isLive) return;
    await sendMessage(input.trim(), undefined, username);
    setInput('');
  };

  return <aside className={`mini-chat ${open ? 'open' : ''}`} aria-label="Mini chat">
    {open ? <>
      <div className="mini-chat-header"><div><strong>{room}</strong><span>{isLive ? 'LIVE' : 'LOCKED'}</span></div><button onClick={() => setOpen(false)} aria-label="Minimize chat">−</button></div>
      <label className="mini-chat-room">Room<select value={room} onChange={(event) => onRoomChange(event.target.value as ChatRoom)}>{CHAT_ROOMS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      <div className="mini-chat-messages">{loading ? <p className="empty">Loading chat...</p> : messages.slice(-8).map((message) => <div className={`mini-chat-message ${message.sender_id === userId ? 'mine' : ''}`} key={message.id}><b>{message.sender_name}</b><p>{message.content}</p></div>)}</div>
      <form className="mini-chat-form" onSubmit={handleSend}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={isLive ? 'Message the lounge...' : 'Chat is locked'} disabled={!isLive} /><button type="submit" disabled={!isLive || !input.trim()}>Send</button></form>
    </> : <button className="mini-chat-launcher" onClick={() => setOpen(true)}><span className="mini-chat-bubble">✦</span> Open chat</button>}
  </aside>;
}
