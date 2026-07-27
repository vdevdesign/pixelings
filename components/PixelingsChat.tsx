import React, { useState } from 'react';
import { usePixelingsChat } from '../hooks/usePixelingsChat';

interface ChatProps {
  sessionId: string;
  currentUserId: string;
  currentUsername: string;
  isAdmin?: boolean;
}

export const PixelingsChat: React.FC<ChatProps> = ({
  sessionId,
  currentUserId,
  currentUsername,
  isAdmin = false,
}) => {
  const { messages, isLive, loading, sendMessage, purgeChat } = usePixelingsChat(
    sessionId,
    currentUserId
  );

  const [input, setInput] = useState('');
  const [whisperTarget, setWhisperTarget] = useState<string>(''); // recipient UUID if whispering

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

  if (loading) {
    return <div className="p-4 text-gray-400">Loading Pixelings Chat...</div>;
  }

  return (
    <div className="flex flex-col h-[500px] w-full max-w-lg border border-slate-700 rounded-lg bg-slate-900 text-slate-100 shadow-xl overflow-hidden">
      
      {/* 1. Header & Live Indicator */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <h3 className="font-semibold text-sm">Pixelings Chat</h3>
          <span className="text-xs text-slate-400">({isLive ? 'LIVE' : 'LOCKED'})</span>
        </div>

        {/* DM Controls */}
        {isAdmin && (
          <button
            onClick={purgeChat}
            className="text-xs bg-rose-900/40 hover:bg-rose-900 text-rose-300 px-2 py-1 rounded border border-rose-700 transition"
          >
            Purge Chat
          </button>
        )}
      </div>

      {/* 2. Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center mt-10">No messages yet.</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                  <span className="font-medium text-slate-300">{msg.sender_name}</span>
                  {msg.is_whisper && (
                    <span className="bg-purple-900/60 text-purple-300 px-1 rounded border border-purple-700">
                      whisper
                    </span>
                  )}
                </div>
                <div
                  className={`p-2.5 rounded-lg text-sm max-w-[80%] ${
                    msg.is_whisper
                      ? 'bg-purple-950/80 border border-purple-800/60 text-purple-100'
                      : isMe
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. Restricted Input Bar */}
      <div className="p-3 border-t border-slate-800 bg-slate-950">
        {!isLive ? (
          <div className="p-2 rounded bg-slate-900 border border-slate-800 text-center text-xs text-slate-500">
            Chat is locked. Waiting for host to set status to LIVE.
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-2">
            {/* Optional Whisper Target Input */}
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="whisperTarget" className="text-slate-400">Whisper To (User ID):</label>
              <input
                id="whisperTarget"
                type="text"
                placeholder="Leave blank for public..."
                value={whisperTarget}
                onChange={(e) => setWhisperTarget(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs px-2 py-0.5 rounded text-slate-300 focus:outline-none focus:border-purple-500 flex-1"
              />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-900 border border-slate-800 text-sm px-3 py-1.5 rounded focus:outline-none focus:border-indigo-500 text-slate-100"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-1.5 rounded transition"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
