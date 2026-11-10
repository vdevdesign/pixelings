import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { APPROVED_GIFS, GIF_MESSAGE_PREFIX, type ApprovedGif } from './approvedGifs';
import { usePixelingsChat } from '../src/hooks/usePixelingsChat';
import { CHAT_ROOMS, ChatRoom } from './chatRooms';
import { avatarItemById, profileItems } from './avatarItems';

const PIXEL_STICKERS = ['✨', '🎉', '🧪', '🔥'];
const COIN_EMOJI = '\u{1FA99}';
const VFX_EMOJIS = [{ emoji: COIN_EMOJI, label: 'Coin burst' }];
// Username color cosmetics: the color lives in its own slot so it can be worn
// with or without the glow. The glow item adds an aura on top of any color.
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
const QUICK_NEEDS = [
  { label: 'Bathroom', emoji: '🚽', message: 'I need to use the restroom' },
  { label: 'Water/Snack', emoji: '🍎', message: 'I am hungry or thirsty' },
  { label: 'Help', emoji: '🆘', message: 'I need help' },
  { label: 'Break', emoji: '🎧', message: 'I need a sensory break' },
];
// Chat themes map an owned shop item (equipped as the chat 'style' slot) to a
// class applied on the chat card. Classic is always available and needs no
// purchase; every other theme is a Stardust Shop item.
const CHAT_THEMES = [
  { id: '', name: 'Classic', emoji: '◆' },
  { id: 'cyber-style', name: 'Cyberpunk', emoji: '⌁' },
  { id: 'style-pastel-dream', name: 'Pastel Dream', emoji: '☁' },
  { id: 'style-forest-grove', name: 'Forest Grove', emoji: '☘' },
  { id: 'style-sunset-vibes', name: 'Sunset Vibes', emoji: '☀' },
  { id: 'style-deep-space', name: 'Deep Space', emoji: '✦' },
  { id: 'style-candy-pop', name: 'Candy Pop', emoji: '♡' },
  { id: 'style-blocky-craft', name: 'Blocky Craft', emoji: '⛏' },
  { id: 'style-redstone-forge', name: 'Redstone Forge', emoji: '🔴' },
  { id: 'style-kanto-league', name: 'Kanto League', emoji: '⚡' },
  { id: 'style-team-rocket', name: 'Team Rocket', emoji: '🚀' },
  { id: 'style-green-hills', name: 'Green Hills', emoji: '🌀' },
  { id: 'style-star-chili-dogs', name: 'Chili Dog Nights', emoji: '⭐' },
  { id: 'style-mushroom-speedway', name: 'Mushroom Speedway', emoji: '🍄' },
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
  chatCosmetics?: { glow: string; tag: string; stickers: string; vfx: string; style: string; nameColor?: string };
  ownedItems?: string[];
  onChatStyleChange?: (style: string) => void | Promise<void>;
  /** Mirror the moderation queue (flagged messages + nickname requests) up to
   *  the app header so the bell panel can review them from any tab. */
  onModerationQueue?: (queue: {
    reviewQueue: { id: string; sender_name: string; content: string; moderation_reason?: string | null }[];
    nicknameRequests: { id: string; username: string; nickname: string }[];
    handlers: { approveMessage: (id: string) => void; rejectMessage: (id: string) => void; approveNickname: (id: string) => void; rejectNickname: (id: string) => void };
  }) => void;
  currentProfile?: { avatarUrl: string; backgroundUrl: string };
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
  ownedItems = [],
  onChatStyleChange,
  onModerationQueue,
  currentProfile = { avatarUrl: 'profile-happy-slime', backgroundUrl: 'background-happy-slime' },
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
  const pendingScrollHeight = React.useRef<number | null>(null);
  const shouldFollowMessages = React.useRef(true);
  const vfxMenuRef = React.useRef<HTMLDivElement>(null);
  const emojiMenuRef = React.useRef<HTMLDivElement>(null);
  const [activeVfxId, setActiveVfxId] = React.useState<string | null>(null);
  const vfxCooldowns = React.useRef<Map<string, number>>(new Map());
  const { messages, reviewQueue, participants, isLive, lockState, loading, hasMoreMessages, loadingOlderMessages, chatLoadError, historyError, loadOlderMessages, sendMessage, sessionId: hookSessionId, onlineUsers, penalty, requestNickname: requestNicknameToServer, nicknameRequests, reviewNickname: reviewNicknameToServer, purgeChat, deleteMessage, approveMessage, rejectMessage, toggleLive } = usePixelingsChat(
    room,
    currentUserId,
    demoMode,
    isModerator
  );

  const [input, setInput] = React.useState('');
  const [whisperTarget, setWhisperTarget] = React.useState<string>('');
  const [nicknameDraft, setNicknameDraft] = React.useState(currentUsername);
  const [nicknameNotice, setNicknameNotice] = React.useState('');
  const [lockReasonDraft, setLockReasonDraft] = React.useState('Class chat is paused while we reset the room.');
  const [statusNotice, setStatusNotice] = React.useState('');
  const [openUsername, setOpenUsername] = React.useState<string | null>(null);
  const [showThemeMenu, setShowThemeMenu] = React.useState(false);
  const themeMenuRef = React.useRef<HTMLDivElement>(null);
  const availableThemes = CHAT_THEMES.filter((theme) => !theme.id || ownedItems.includes(theme.id));
  const visibleRooms = CHAT_ROOMS.filter((option) => option !== 'Teacher Lounge' || isModerator || isAdmin);
  const activeTheme = CHAT_THEMES.find((theme) => theme.id === chatCosmetics.style) || CHAT_THEMES[0];
  React.useEffect(() => {
    if (!showThemeMenu) return;
    const close = (event: MouseEvent) => {
      if (!themeMenuRef.current?.contains(event.target as Node)) setShowThemeMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showThemeMenu]);
  const [showVfxMenu, setShowVfxMenu] = React.useState(false);
  const [showEmojiMenu, setShowEmojiMenu] = React.useState(false);
  const [showGifMenu, setShowGifMenu] = React.useState(false);
  const [gifSearch, setGifSearch] = React.useState('');
  const gifMenuRef = React.useRef<HTMLDivElement>(null);
  const liveUsername = participants.find((participant) => participant.id === currentUserId)?.name || currentUsername;

  React.useEffect(() => {
    setNicknameDraft(liveUsername);
  }, [liveUsername]);

  React.useEffect(() => {
    pendingScrollHeight.current = null;
    shouldFollowMessages.current = true;
    if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = 0;
  }, [room]);

  React.useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (pendingScrollHeight.current !== null) {
      container.scrollTop += container.scrollHeight - pendingScrollHeight.current;
      pendingScrollHeight.current = null;
    } else if (shouldFollowMessages.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const handleMessagesScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    shouldFollowMessages.current = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
    if (container.scrollTop <= 24 && hasMoreMessages && !loadingOlderMessages) {
      pendingScrollHeight.current = container.scrollHeight;
      void loadOlderMessages();
    }
  };

  useEffect(() => {
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

  // Sends an approved GIF as a chat message: `[gif] <url>`. Rendering turns it
  // back into an animated <img> for everyone — content stays plain text at rest.
  const sendGif = async (gif: ApprovedGif) => {
    if (!chatIsLive && !isModerator) return;
    setShowGifMenu(false);
    setGifSearch('');
    try {
      await sendMessage(GIF_MESSAGE_PREFIX + gif.url, whisperTarget.trim() ? whisperTarget : undefined, liveUsername);
    } catch (err) {
      console.error('Failed to send GIF:', err);
      setStatusNotice(getSendErrorMessage(err, 'Could not send that GIF.'));
    }
  };

  const handleThemeChange = async (style: string) => {
    if (!onChatStyleChange) return;
    setStatusNotice('');
    try {
      await onChatStyleChange(style);
    } catch (error) {
      console.error('Failed to save chat theme:', error);
      setStatusNotice(getSendErrorMessage(error, 'Could not save your chat theme.'));
    }
  };

  const requestNickname = async () => {
    const requested = nicknameDraft.trim();
    if (!requested || requested === liveUsername) return;
    try {
      await requestNicknameToServer(requested);
      setNicknameNotice('Nickname submitted for teacher approval.');
    } catch (error) {
      console.error('Failed to request nickname:', error);
      setNicknameNotice('Could not submit nickname request. Please try again.');
    }
  };

  const handleNicknameReview = async (studentId: string, approve: boolean) => {
    try {
      await reviewNicknameToServer(studentId, approve);
    } catch (error) {
      console.error('Failed to review nickname:', error);
      setStatusNotice('Could not save the nickname decision. Please try again.');
    }
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

  // The Teacher Lounge is always open for staff, regardless of the room's
  // session status; the database insert policy also allows moderators to post
  // to locked sessions, so this only needs to fix the client-side status.
  const teacherLoungeAlwaysLive = room === 'Teacher Lounge' && isModerator;
  const chatIsLive = teacherLoungeAlwaysLive ? true : allChatsLocked ? manualChatOverride === true : manualChatOverride ?? isLive;
  const canPost = !chatLoadError && (chatIsLive || isModerator) && !(penalty && !isModerator);

  React.useEffect(() => {
    onModerationQueue?.({
      reviewQueue: reviewQueue.map(({ id, sender_name, content, moderation_reason }) => ({ id, sender_name, content, moderation_reason })),
      nicknameRequests: nicknameRequests.map(({ id, username, nickname }) => ({ id, username, nickname })),
      handlers: {
        approveMessage: (id) => { void approveMessage({ id } as never); },
        rejectMessage: (id) => { void rejectMessage({ id } as never); },
        approveNickname: (id) => { void handleNicknameReview(id, true); },
        rejectNickname: (id) => { void handleNicknameReview(id, false); },
      },
    });
  }, [reviewQueue, nicknameRequests, approveMessage, rejectMessage, handleNicknameReview, onModerationQueue]);

  const setPenaltyFor = async (userId: string, kind: 'timeout' | 'ban' | 'unban', minutes?: number) => {
    setStatusNotice('');
    const { error } = await supabase.rpc('set_chat_penalty', { target: userId, penalty_kind: kind, minutes: minutes ?? null, reason: '' });
    setStatusNotice(error ? 'Could not update chat access. Check moderator permissions.' : kind === 'unban' ? 'Chat access restored.' : kind === 'ban' ? 'Student banned from chat.' : `Student timed out for ${minutes} minutes.`);
  };

  if (loading) {
    return <div className="chat-card"><div className="composer">Loading Pixelings Chat...</div></div>;
  }



  return (
    <>
      <div className="chat-workspace">
      <aside className="room-menu" aria-label="Chat rooms">
        <div className="room-menu-header">CLASSROOMS</div>
        <div className="room-options">
          {visibleRooms.map((option) => <button key={option} type="button" className={`room-option ${room === option ? 'active' : ''}`} onClick={() => onRoomChange(option)} aria-current={room === option ? 'page' : undefined}>{option}<span className="room-option-sparkles" aria-hidden="true">✦</span></button>)}
        </div>
      </aside>
      <div className={`chat-card theme-${chatCosmetics.style || 'classic'} ${chatIsLive ? 'chat-live' : 'chat-locked'}`}>
      
      {/* 1. Header & Live Indicator */}
      <div className="chat-header">
        <div className="chat-title">
          <span className={`status-dot ${chatIsLive ? '' : 'locked'}`} />
          <h3>{room}</h3>
          <span className={`status-label ${chatIsLive ? 'live' : 'locked'}`}>{chatIsLive ? 'LIVE' : 'LOCKED'}</span>
        </div>

        {/* DM Controls */}
        {isModerator && <div className="moderator-actions">
            {!teacherLoungeAlwaysLive && <button onClick={handleStatusChange} className={`toggle-button ${chatIsLive ? 'lock-action' : 'unlock-action'}`} aria-label={chatIsLive ? `Lock ${room} chat` : `Unlock ${room} chat`}>
              {chatIsLive ? 'Lock chat' : 'Unlock chat'}
            </button>}
            <button onClick={handlePurge} className="purge-button">Purge Chat</button>
        </div>}
        <div className="chat-controls">
        <div className="theme-picker" ref={themeMenuRef}>
          <button type="button" className={`theme-picker-button theme-${activeTheme.id || 'classic'}`} onClick={() => setShowThemeMenu((open) => !open)} aria-label="Change chat theme">
            <span aria-hidden="true">{activeTheme.emoji}</span> {activeTheme.name}
          </button>
          {showThemeMenu && <div className="theme-picker-menu">
            {availableThemes.map((theme) => <button key={theme.id || 'classic'} type="button" className={`theme-option ${chatCosmetics.style === theme.id ? 'active' : ''}`} onClick={() => { void handleThemeChange(theme.id); setShowThemeMenu(false); }}>
              <span aria-hidden="true">{theme.emoji}</span> {theme.name}{chatCosmetics.style === theme.id ? ' ✓' : ''}
            </button>)}
            {availableThemes.length === 1 && <span className="theme-picker-note">Buy themes in the Stardust Shop!</span>}
          </div>}
        </div>
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
      {penalty && !isModerator && <div className="chat-status-banner penalty-banner" role="alert">
        <span className="lock-symbol">⛔</span>
        <div><strong>{penalty.kind === 'ban' ? 'Banned from chat' : 'Time out'}</strong>
          <span>{penalty.kind === 'ban' ? 'Your chat access has been removed. Please talk with your teacher.' : `You can chat again at ${penalty.until ? new Date(penalty.until).toLocaleTimeString() : 'a later time'}.`}</span></div>
      </div>}
      {chatLoadError && <p className="chat-load-error" role="alert">{chatLoadError}</p>}
      {statusNotice && <p className="status-notice" role="status">{statusNotice}</p>}

      {/* 2. Messages List */}
      <div className="messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
        {loadingOlderMessages && <p className="history-loading">Loading earlier messages…</p>}
        {historyError && <p className="history-error" role="alert">{historyError}</p>}
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
                    <button type="button" className={`message-name ${isMe && chatCosmetics.glow ? 'chat-name-glow' : ''}`} style={isMe && chatCosmetics.nameColor && isNameColor(chatCosmetics.nameColor) ? { color: USERNAME_NAME_COLORS[chatCosmetics.nameColor] } : undefined} onClick={() => setOpenUsername(openUsername === msg.id ? null : msg.id)} title="Show username">
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
                    {(() => {
                      // Approved GIF messages arrive as `[gif] <asset-url>`.
                      if (msg.content.startsWith(GIF_MESSAGE_PREFIX)) {
                        const gifUrl = msg.content.slice(GIF_MESSAGE_PREFIX.length).trim();
                        if (/^(https?:\/\/|data:image\/)/.test(gifUrl) || gifUrl.startsWith('/')) {
                          return <img className="chat-gif-message" src={gifUrl} alt="Shared GIF" loading="eager" />;
                        }
                      }
                      return msg.content;
                    })()}
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
              {/* Pickers sit LEFT of the text input, icon-only and equal size. */}
              <div className="composer-pickers">
                <div className="picker-container">
                  <button type="button" className="vfx-menu-toggle" onClick={() => {
                    setShowEmojiMenu((open) => !open);
                    setShowVfxMenu(false);
                    setShowGifMenu(false);
                  }} aria-label="Open emojis" aria-expanded={showEmojiMenu} title="Emoji">😊</button>
                </div>
                <div className="picker-container">
                  <button type="button" className="vfx-menu-toggle" onClick={() => {
                    setShowVfxMenu((open) => !open);
                    setShowEmojiMenu(false);
                    setShowGifMenu(false);
                  }} aria-label="Open effects" aria-expanded={showVfxMenu} title="Effect">✦</button>
                </div>
                <div className="picker-container">
                  <button type="button" className="vfx-menu-toggle chat-gif-btn" onClick={() => {
                    setShowGifMenu((open) => !open);
                    setShowEmojiMenu(false);
                    setShowVfxMenu(false);
                  }} aria-label="Open GIF picker" aria-expanded={showGifMenu} title="Send a GIF">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                  </button>
                </div>
                {showEmojiMenu && <div className="vfx-menu emoji-grid" ref={emojiMenuRef} role="menu">
                  {KID_FRIENDLY_EMOJIS.map((emoji) => (
                    <button key={emoji} type="button" className="vfx-button" onClick={() => {
                      setInput((v) => v + emoji);
                      setShowEmojiMenu(false);
                    }} aria-label={`Add ${emoji}`} role="menuitem">{emoji}</button>
                  ))}
                </div>}
                {showVfxMenu && <div className="vfx-menu" ref={vfxMenuRef} role="menu">{VFX_EMOJIS.map(({ emoji, label }) => <button key={emoji} type="button" className="vfx-button" onClick={() => void handleSendVfx(emoji)} disabled={!chatIsLive && !isModerator} aria-label={`Send ${label}`} role="menuitem">{emoji}</button>)}</div>}
                {showGifMenu && (
                  <div className="vfx-menu chat-gif-panel" role="menu">
                    <input
                      type="search"
                      className="gif-search"
                      placeholder="Search GIFs…"
                      aria-label="Search GIFs"
                      value={gifSearch}
                      onChange={(e) => setGifSearch(e.target.value)}
                    />
                    {(() => {
                      const query = gifSearch.trim().toLowerCase();
                      const list = query ? APPROVED_GIFS.filter((gif) => gif.name.toLowerCase().includes(query)) : APPROVED_GIFS;
                      if (!list.length) return <p className="gif-empty">No GIFs match that search.</p>;
                      return (
                        <div className="gif-grid">
                          {list.map((gif) => (
                            <button key={gif.name} type="button" className="chat-gif-item" title={gif.name} aria-label={`Send GIF ${gif.name}`} onClick={() => void sendGif(gif)}>
                              <img src={gif.url} alt={gif.name} loading="lazy" />
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="message-input"
              />
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
      <footer className="online-roster" aria-label="Who is online">
        <div className="online-roster-title">ONLINE NOW · {onlineUsers.length}</div>
        <div className="online-roster-list">
          {onlineUsers.length === 0 ? <span className="online-empty">Nobody else is here right now.</span> : onlineUsers.map((user) => (
            <span className="online-user" key={user.user_id}>
              <span className={`presence-dot ${user.user_id === currentUserId ? 'me' : ''}`} aria-hidden="true" />
              <strong>{user.display_name}</strong>
              {user.room && <span className="online-room">in {user.room}</span>}
            </span>
          ))}
        </div>
      </footer>
    </>
  );
};
