import React, { useEffect, useState } from 'react';
import { usePixelingsChat } from '../src/hooks/usePixelingsChat';
import { moderationReason } from '../lib/moderation';
import { CHAT_ROOMS, ChatRoom } from './chatRooms';
import { avatarItemById, profileItems } from './avatarItems';

const PIXEL_STICKERS = ['✨', '🎉', '🧪', '🔥'];
const COIN_EMOJI = '\u{1FA99}';
const VFX_EMOJIS = [{ emoji: COIN_EMOJI, label: 'Coin burst' }];
const QUICK_NEEDS = [
  { label: 'Bathroom', emoji: '🚽', message: 'I need to use the restroom' },
  { label: 'Water/Snack', emoji: '🍎', message: 'I am hungry or thirsty' },
  { label: 'Help', emoji: '🆘', message: 'I need help' },
  { label: 'Break', emoji: '🎧', message: 'I need a sensory break' },
];
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

const getSendErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;

  if (typeof error === 'object' && error !== null) {
    const details = error as { message?: unknown; details?: unknown; hint?: unknown };
    if (typeof details.message === 'string' && details.message) return details.message;
    if (typeof details.details === 'string' && details.details) return details.details;
    if (typeof details.hint === 'string' && details.hint) return details.hint;
  }

  return fallback;
};

interface ChatProps {
  room: ChatRoom;
  onRoomChange: (room: ChatRoom) => void;
  currentUserId: string;
  currentUsername: string;
  currentUsernameHandle?: string;
  isAdmin?: boolean;
  demoMode?: boolean;
  isModerator?: boolean;
  allChatsLocked?: boolean;
  manualChatOverride?: boolean;
  onManualStatusChange?: (isLive: boolean) => void;
  chatCosmetics?: { glow: string; tag: string; stickers: string; vfx: string; style: string };
  currentProfile?: { avatarUrl: string; backgroundUrl: string };
  externalState?: any;
}

export const PixelingsChat: React.FC<ChatProps> = ({
  room,
  onRoomChange,
  currentUserId,
  currentUsername,
  currentUsernameHandle = currentUsername,
  isAdmin = false,
  demoMode = false,
  isModerator = false,
  allChatsLocked = false,
  manualChatOverride,
  onManualStatusChange,
  chatCosmetics = { glow: '', tag: '', stickers: '', vfx: '', style: '' },
  currentProfile = { avatarUrl: 'profile-happy-slime', backgroundUrl: 'background-happy-slime' },
  externalState,
}) => {
  // Block non-teachers from the Teacher Lounge
  if (room === 'Teacher Lounge' && !isModerator && !isAdmin) {
    return (
      <div className="chat-error-screen">
        <div className="error-card">
          <h2>🚫 Access Denied</h2>
          <p>The Teacher Lounge is for staff only.</p>
          <button onClick={() => onRoomChange('Blender')}>Return to Class</button>
        </div>
        <style>{`
          .chat-error-screen { 
            display: flex; align-items: center; justify-content: center; 
            height: 100%; background: #f8f9fa; color: #333; 
          }
          .error-card { 
            text-align: center; padding: 3rem; background: white; 
            border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
          }
          .error-card h2 { color: #d32f2f; margin-bottom: 1rem; }
          .error-card p { margin-bottom: 2rem; color: #666; }
          .error-card button { 
            padding: 0.8rem 1.5rem; background: #4CAF50; color: white; 
            border: none; border-radius: 8px; cursor: pointer; font-weight: bold;
          }
        `}</style>
      </div>
    );
  }

  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const vfxMenuRef = React.useRef<HTMLDivElement>(null);
  const emojiMenuRef = React.useRef<HTMLDivElement>(null);
  const [activeVfxId, setActiveVfxId] = React.useState<string | null>(null);
  const vfxCooldowns = React.useRef<Map<string, number>>(new Map());
  const { messages, reviewQueue, participants, isLive, lockState, loading, sendMessage, requestNickname: requestNicknameToServer, purgeChat, deleteMessage, approveMessage, rejectMessage, toggleLive } = usePixelingsChat(
    room,
    currentUserId,
    demoMode,
    isModerator,
    externalState
  );

  const [input, setInput] = React.useState('');
  const [whisperTarget, setWhisperTarget] = React.useState<string>('');
  const [nickname, setNickname] = React.useState(currentUsername);
  const [nicknameDraft, setNicknameDraft] = React.useState(currentUsername);
  const [nicknameNotice, setNicknameNotice] = React.useState('');
  const [showModeration, setShowModeration] = React.useState(false);
  const [showQuickNeeds, setShowQuickNeeds] = React.useState(false);
  const [lockReasonDraft, setLockReasonDraft] = React.useState('Class chat is paused while we reset the room.');
  const [statusNotice, setStatusNotice] = React.useState('');
  const [openUsername, setOpenUsername] = React.useState<string | null>(null);
  const [showVfxMenu, setShowVfxMenu] = React.useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = React.useState(false);
  const [nicknameQueue, setNicknameQueue] = React.useState<Array<{ id: string; user: string; nickname: string; reason: string }>>(
    isModerator ? [{ id: 'nickname-1', user: 'Pixels7', nickname: 'CodeWizard', reason: 'All nicknames require approval' }] : []
  );
  const liveUsername = participants.find((participant) => participant.id === currentUserId)?.name || currentUsername;

  React.useEffect(() => {
    setNickname(liveUsername);
    setNicknameDraft(liveUsername);
  }, [liveUsername]);

  React.useEffect(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 50;
      if (isAtBottom) {
        messagesContainerRef.current.scrollTo({
          top: scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [messages]);

  useEffect(() => {
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

  const handleSend = async (e: React.FormEvent, options: { isBroadcast?: boolean; isPriority?: boolean } = {}) => {
    if (e) e.preventDefault();
    const text = options.isBroadcast ? `📢 BROADCAST: ${input}` : input;
    if (!text?.trim() || (!chatIsLive && !isModerator)) return;

    try {
      // Note: The sendMessage hook needs to be updated to accept these new flags
      await sendMessage(
        text, 
        whisperTarget.trim() ? whisperTarget : undefined, 
        liveUsername,
        options.isBroadcast,
        options.isPriority
      );
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
      setStatusNotice(err instanceof Error ? err.message : 'Could not send that message.');
    }
  };

  const handleQuickNeed = async (need: typeof QUICK_NEEDS[0]) => {
    setShowQuickNeeds(false);
    try {
      await sendMessage(
        `🆘 ${need.emoji} ${need.message}`, 
        undefined, 
        liveUsername,
        false,
        true // isPriority = true
      );
    } catch (err) {
      setStatusNotice('Could not send the request.');
    }
  };

  const handleSendVfx = async (emoji: string) => {
    if (!chatIsLive && !isModerator) return;
    setShowVfxMenu(false);
    setShowEmojiMenu(false);
    setStatusNotice('');
    try {
      await sendMessage(emoji, undefined, liveUsername);
    } catch (err) {
      console.error('Failed to send VFX:', err);
      setStatusNotice(getSendErrorMessage(err, 'Could not send that effect.'));
    }
  };

  const requestNickname = async () => {
    const requested = nicknameDraft.trim();
    if (!requested || requested === nickname) return;
    try {
      await requestNicknameToServer(requested);
      const reason = moderationReason(requested);
      setNicknameQueue((prev) => [...prev, { id: crypto.randomUUID(), user: currentUsername, nickname: requested, reason: reason || 'Nickname requires teacher approval' }]);
      setNicknameNotice('Nickname submitted for teacher approval.');
    } catch (error) {
      console.error('Failed to request nickname:', error);
      setNicknameNotice('Could not submit nickname request. Please try again.');
    }
  };

  const approveNickname = (id: string, requested: string, user: string) => {
    if (user === currentUsername) setNickname(requested);
    setNicknameQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleStatusChange = async () => {
    const wasLive = chatIsLive;
    try {
      await toggleLive(wasLive ? lockReasonDraft : '', !wasLive);
      onManualStatusChange?.(!wasLive);
      setStatusNotice(wasLive ? 'Chat locked for this room.' : 'Chat unlocked. Everyone can post again.');
    } catch (error) {
      console.error('Failed to update chat status:', error);
      setStatusNotice('Could not update the room status. Please try again.');
    }
  };

  const handlePurge = async () => {
    if (!window.confirm(`Delete every message in ${room}?`)) return;
    try {
      await purgeChat();
      setStatusNotice('Chat purged.');
    } catch (error) {
      console.error('Failed to purge chat:', error);
      setStatusNotice('Could not purge this chat. Check moderator permissions.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
      setStatusNotice('Message deleted.');
    } catch (error) {
      console.error('Failed to delete message:', error);
      setStatusNotice('Could not delete that message. Check moderator permissions.');
    }
  };

  const chatIsLive = allChatsLocked ? manualChatOverride === true : manualChatOverride ?? isLive;
  const canPost = chatIsLive || isModerator;

  if (loading) {
    return <div className="chat-card"><div className="composer">Loading Pixelings Chat...</div></div>;
  }

  const queueCount = reviewQueue.length + nicknameQueue.length;

  return (
    <>
      {isModerator && <div className="page-notification">
        <button className="notification-button" onClick={() => setShowModeration((open) => !open)} aria-label="Open moderation notifications">
          <span className="notification-icon">♢</span>{queueCount > 0 && <b>{queueCount}</b>}
        </button>
        {showModeration && <aside className="review-panel notification-box">
          <div className="review-heading"><span>MODERATION QUEUE</span><b>{queueCount}</b></div>
          {queueCount === 0 && <p className="empty">No items to review.</p>}
          {reviewQueue.map((item) => <div className="review-item" key={item.id}>
            <div><strong>{item.sender_name}</strong><p>{item.content}</p><small>{item.moderation_reason}</small></div>
            <div className="review-actions"><button onClick={() => approveMessage(item)} className="approve-button">Approve</button><button onClick={() => rejectMessage(item)} className="reject-button">Reject</button></div>
          </div>)}
          {nicknameQueue.map((item) => <div className="review-item" key={item.id}>
            <div><strong>{item.user} · nickname</strong><p>{item.nickname}</p><small>{item.reason}</small></div>
            <div className="review-actions"><button onClick={() => approveNickname(item.id, item.nickname, item.user)} className="approve-button">Approve</button><button onClick={() => setNicknameQueue((prev) => prev.filter((entry) => entry.id !== item.id))} className="reject-button">Reject</button></div>
          </div>)}
        </aside>}
      </div>}
      <div className="chat-workspace">
      <aside className="room-menu" aria-label="Chat rooms">
        <div className="room-menu-header">CLASSROOMS</div>
        <div className="room-options">
          {CHAT_ROOMS.map((option) => <button key={option} type="button" className={`room-option ${room === option ? 'active' : ''}`} onClick={() => onRoomChange(option)} aria-current={room === option ? 'page' : undefined}>{option}<span className="room-option-sparkles" aria-hidden="true">✦</span></button>)}
        </div>
      </aside>
      <div className={`chat-card ${chatIsLive ? 'chat-live' : 'chat-locked'}`}>
      
      {/* 1. Header & Live Indicator */}
      <div className="chat-header">
        <div className="chat-title">
          <span className={`status-dot ${chatIsLive ? '' : 'locked'}`} />
          <h3>{room}</h3>
          <span className={`status-label ${chatIsLive ? 'live' : 'locked'}`}>{chatIsLive ? 'LIVE' : 'LOCKED'}</span>
        </div>

        {/* DM Controls */}
        {isModerator && <div className="moderator-actions">
            <button onClick={handleStatusChange} className={`toggle-button ${chatIsLive ? 'lock-action' : 'unlock-action'}`} aria-label={chatIsLive ? `Lock ${room} chat` : `Unlock ${room} chat`}>
              {chatIsLive ? 'Lock chat' : 'Unlock chat'}
            </button>
            <button onClick={handlePurge} className="purge-button">Purge Chat</button>
        </div>}
        <div className="chat-controls">
        <div className="profile-tools">
          <label htmlFor="nickname">Nickname</label>
          <input id="nickname" value={nicknameDraft} onChange={(e) => setNicknameDraft(e.target.value)} maxLength={24} />
          <button type="button" onClick={requestNickname} className="nickname-button">Request</button>
          {nicknameNotice && <span>{nicknameNotice}</span>}
        </div>
        </div>
      </div>

      {!chatIsLive && <div className="chat-status-banner" role="status">
        <span className="lock-symbol">⌁</span>
        <div><strong>Chat locked</strong><span>{lockState.reason || 'Posting is paused for this room.'}</span></div>
        {isModerator && <button type="button" onClick={handleStatusChange}>Unlock</button>}
      </div>}
      {statusNotice && <p className="status-notice" role="status">{statusNotice}</p>}

      {/* 2. Messages List */}
      <div className="messages" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <p className="empty">No messages yet.</p>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = messages[index - 1];
            const isSameSender = prevMsg && prevMsg.sender_id === msg.sender_id && !prevMsg.is_whisper && !msg.is_whisper;
            const isMe = msg.sender_id === currentUserId;
            const participantProfile = participants.find((participant) => participant.id === msg.sender_id);
            const senderProfile = isMe ? { ...participantProfile, ...currentProfile } : participantProfile;
            const profileIcon = avatarItemById.get(senderProfile?.avatarUrl || '') || avatarItemById.get('profile-happy-slime') || profileItems[0];
            const profileBackground = avatarItemById.get(senderProfile?.backgroundUrl || 'background-happy-slime');
            return (
              <div key={msg.id} className={`message ${isMe ? 'mine' : ''} ${msg.is_whisper ? 'whisper' : ''}`}>
                {!isSameSender && (
                  <div className="message-meta" onMouseEnter={() => setOpenUsername(msg.id)} onMouseLeave={() => setOpenUsername((open) => open === msg.id ? null : open)}>
                    <span className={`chat-profile-icon ${isMe && chatCosmetics.glow ? 'chat-name-glow' : ''}`} style={{ backgroundImage: profileBackground ? `url(${profileBackground.src})` : undefined }}><img src={profileIcon.src} alt={`${msg.sender_name}'s profile icon`} /></span>
                    <button type="button" className={`message-name ${isMe && chatCosmetics.glow ? 'chat-name-glow' : ''}`} onClick={() => setOpenUsername(openUsername === msg.id ? null : msg.id)} title="Show username">
                      {msg.sender_name}
                    </button>
                    {isMe && chatCosmetics.tag && <span className="equipped-chat-tag">{chatCosmetics.tag.replace(/^tag-/, '').replace(/-/g, ' ')}</span>}
                    {openUsername === msg.id && <span className="profile-popover">
                      <span className="profile-popover-art" style={profileBackground ? { backgroundImage: `url(${profileBackground.src})` } : undefined}><img src={profileIcon.src} alt="" /></span>
                      <span><strong>{msg.sender_name}</strong><small>@{msg.sender_username || (isMe ? currentUsernameHandle : msg.sender_name)}</small></span>
                    </span>}
                    {msg.is_whisper && (
                      <span className="whisper-tag">
                        whisper
                      </span>
                    )}
                  </div>
                )}
                <div className={`bubble-wrapper ${isMe ? 'mine' : ''}`}>
                  <div 
                    className={`bubble ${isMe && chatCosmetics.style === 'cyber-style' ? 'cyber-bubble' : ''}`}
                    onClick={() => {
                      if (msg.content.includes(COIN_EMOJI)) {
                        const now = Date.now();
                        const lastRun = vfxCooldowns.current.get(msg.id) || 0;
                        // Prevent restart if animation is still likely running (approx 1.6s duration)
                        if (now - lastRun < 1600) return;

                        vfxCooldowns.current.set(msg.id, now);
                        setActiveVfxId(null);
                        setTimeout(() => setActiveVfxId(msg.id), 10);
                      }
                    }}
                    style={{ cursor: msg.content.includes(COIN_EMOJI) ? 'pointer' : 'default' }}
                  >
                    {msg.content}
                    {msg.content.includes(COIN_EMOJI) && (
                      <span 
                        key={activeVfxId === msg.id ? 'restart' : 'static'} 
                        className="coin-burst" 
                        aria-label="coin effect"
                      >
                        <span>🪙</span><span>🪙</span><span>🪙</span><span>🪙</span><span>🪙</span><span>🪙</span><span>🪙</span>
                      </span>
                    )}
                  </div>
                  {isModerator && (
                    <button 
                      type="button" 
                      className="message-delete bubble-delete" 
                      onClick={(event) => { event.stopPropagation(); void handleDeleteMessage(msg.id); }} 
                      title="Delete message"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Restricted Input Bar */}
      <div className="composer">
        {!canPost ? (
          <div className="locked-message">
            Chat is locked. Waiting for host to set status to LIVE.
          </div>
        ) : (
          <form onSubmit={handleSend}>
            {!chatIsLive && <div className="staff-posting-note">Staff broadcast mode · members cannot post while this room is locked.</div>}
            <div className="whisper-row">
              <label htmlFor="whisperTarget">Whisper to:</label>
              <select
                id="whisperTarget"
                aria-label="Choose a whisper recipient"
                value={whisperTarget}
                onChange={(e) => setWhisperTarget(e.target.value)}
                className="whisper-select"
              ><option value="">Everyone (public)</option>{participants.filter((participant) => participant.id !== currentUserId).map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select>
            </div>

            <div className="message-form">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="message-input"
              />
              { (chatCosmetics.stickers === 'pixel-stickers' || demoMode) && <div className="emoji-picker" aria-label="Emoji set">
                <div className="picker-container">
                  <button type="button" className="vfx-menu-toggle" onClick={() => {
                    setShowEmojiMenu((open) => !open);
                    setShowVfxMenu(false);
                  }} aria-label="Open emojis" aria-expanded={showEmojiMenu}>😊</button>
                  <span className="picker-label">Emoji</span>
                </div>
                {showEmojiMenu && <div className="vfx-menu" ref={emojiMenuRef} role="menu">
                  {KID_FRIENDLY_EMOJIS.map((emoji) => (
                    <button key={emoji} type="button" className="vfx-button" onClick={() => {
                      setInput((v) => v + emoji);
                      setShowEmojiMenu(false);
                    }} aria-label={`Add ${emoji}`} role="menuitem">{emoji}</button>
                  ))}
                </div>}
              </div>}
              { (chatCosmetics.vfx === 'coin-vfx' || demoMode) && <div className="vfx-picker">
                <div className="picker-container">
                  <button type="button" className="vfx-menu-toggle" onClick={() => {
                    setShowVfxMenu((open) => !open);
                    setShowEmojiMenu(false);
                  }} aria-label="Open effects" aria-expanded={showVfxMenu}>✦</button>
                  <span className="picker-label">Effect</span>
                </div>
                {showVfxMenu && <div className="vfx-menu" ref={vfxMenuRef} role="menu">{VFX_EMOJIS.map(({ emoji, label }) => <button key={emoji} type="button" className="vfx-button" onClick={() => void handleSendVfx(emoji)} disabled={!chatIsLive && !isModerator} aria-label={`Send ${label}`} role="menuitem">{emoji}</button>)}</div>}
              </div>}
              <button
                type="submit"
                className="send-button"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </div>
      </div>
      </div>
    </>
  );
};
