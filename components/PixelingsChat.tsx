import React, { useEffect, useState } from 'react';
import { usePixelingsChat } from '../src/hooks/usePixelingsChat';
import { moderationReason } from '../lib/moderation';
import { CHAT_ROOMS, ChatRoom } from './chatRooms';

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
}) => {
  const { messages, reviewQueue, participants, isLive, lockState, loading, sendMessage, requestNickname: requestNicknameToServer, purgeChat, approveMessage, rejectMessage, toggleLive } = usePixelingsChat(
    room,
    currentUserId,
    demoMode,
    isModerator
  );

  const [input, setInput] = useState('');
  const [whisperTarget, setWhisperTarget] = useState<string>('');
  const [nickname, setNickname] = useState(currentUsername);
  const [nicknameDraft, setNicknameDraft] = useState(currentUsername);
  const [nicknameNotice, setNicknameNotice] = useState('');
  const [showModeration, setShowModeration] = useState(false);
  const [lockReasonDraft, setLockReasonDraft] = useState('Class chat is paused while we reset the room.');
  const [statusNotice, setStatusNotice] = useState('');
  const [openUsername, setOpenUsername] = useState<string | null>(null);
  const [nicknameQueue, setNicknameQueue] = useState<Array<{ id: string; user: string; nickname: string; reason: string }>>(
    isModerator ? [{ id: 'nickname-1', user: 'Pixels7', nickname: 'CodeWizard', reason: 'All nicknames require approval' }] : []
  );
  const liveUsername = participants.find((participant) => participant.id === currentUserId)?.name || currentUsername;

  useEffect(() => {
    setNickname(liveUsername);
    setNicknameDraft(liveUsername);
  }, [liveUsername]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || (!chatIsLive && !isModerator)) return;

    try {
      await sendMessage(
        input, 
        whisperTarget.trim() ? whisperTarget : undefined, 
        liveUsername
      );
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
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
            <button onClick={purgeChat} className="purge-button">Purge Chat</button>
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
      <div className="messages">
        {messages.length === 0 ? (
          <p className="empty">No messages yet.</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`message ${isMe ? 'mine' : ''} ${msg.is_whisper ? 'whisper' : ''}`}>
                <div className="message-meta">
                  <button type="button" className="message-name" onClick={() => setOpenUsername(openUsername === msg.id ? null : msg.id)} title="Show username">
                    {msg.sender_name}
                  </button>
                  {openUsername === msg.id && <span className="username-popover">username: {msg.sender_username || (isMe ? currentUsernameHandle : msg.sender_name)}</span>}
                  {msg.is_whisper && (
                    <span className="whisper-tag">
                      whisper
                    </span>
                  )}
                </div>
                <div
                  className="bubble"
                >
                  {msg.content}
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
