import React, { useState } from 'react';
import { usePixelingsChat } from '../src/hooks/usePixelingsChat';
import { moderationReason } from '../lib/moderation';

interface ChatProps {
  sessionId: string;
  currentUserId: string;
  currentUsername: string;
  isAdmin?: boolean;
  demoMode?: boolean;
  isModerator?: boolean;
}

export const PixelingsChat: React.FC<ChatProps> = ({
  sessionId,
  currentUserId,
  currentUsername,
  isAdmin = false,
  demoMode = false,
  isModerator = false,
}) => {
  const { messages, reviewQueue, participants, isLive, loading, sendMessage, purgeChat, approveMessage, rejectMessage, toggleLive } = usePixelingsChat(
    sessionId,
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
  const [nicknameQueue, setNicknameQueue] = useState<Array<{ id: string; user: string; nickname: string; reason: string }>>(
    isModerator ? [{ id: 'nickname-1', user: 'Pixels7', nickname: 'CodeWizard', reason: 'All nicknames require approval' }] : []
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isLive) return;

    try {
      await sendMessage(
        input, 
        whisperTarget.trim() ? whisperTarget : undefined, 
        currentUsername
      );
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const requestNickname = () => {
    const requested = nicknameDraft.trim();
    if (!requested || requested === nickname) return;
    const reason = moderationReason(requested);
    setNicknameQueue((prev) => [...prev, { id: crypto.randomUUID(), user: currentUsername, nickname: requested, reason: reason || 'Nickname requires teacher approval' }]);
    setNicknameNotice('Nickname submitted for teacher approval.');
  };

  const approveNickname = (id: string, requested: string, user: string) => {
    if (user === currentUsername) setNickname(requested);
    setNicknameQueue((prev) => prev.filter((item) => item.id !== id));
  };

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
      <div className="chat-card">
      
      {/* 1. Header & Live Indicator */}
      <div className="chat-header">
        <div className="chat-title">
          <span className={`status-dot ${isLive ? '' : 'locked'}`} />
          <h3>Pixelings Chat</h3>
          <span className="status-label">{isLive ? 'LIVE' : 'LOCKED'}</span>
        </div>

        {/* DM Controls */}
        {isModerator && <div className="moderator-actions">
            <button onClick={toggleLive} className="toggle-button">{isLive ? 'Lock chat' : 'Unlock chat'}</button>
            <button onClick={purgeChat} className="purge-button">Purge Chat</button>
          </div>}
        <div className="profile-tools">
          <label htmlFor="nickname">Nickname</label>
          <input id="nickname" value={nicknameDraft} onChange={(e) => setNicknameDraft(e.target.value)} maxLength={24} />
          <button type="button" onClick={requestNickname} className="nickname-button">Request</button>
          {nicknameNotice && <span>{nicknameNotice}</span>}
        </div>
      </div>

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
                  <strong>{msg.sender_name}</strong>
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
        {!isLive ? (
          <div className="locked-message">
            Chat is locked. Waiting for host to set status to LIVE.
          </div>
        ) : (
          <form onSubmit={handleSend}>
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
    </>
  );
};
