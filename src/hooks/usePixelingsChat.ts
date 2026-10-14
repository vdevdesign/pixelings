import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { moderationReason } from '../../lib/moderation';

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_username?: string | null;
  content: string;
  is_whisper: boolean;
  recipient_id?: string;
  created_at: string;
  status?: 'approved' | 'pending' | 'rejected';
  moderation_reason?: string | null;
  session_id?: string;
}
export interface Participant { id: string; name: string; }
export interface ChatLockState {
  reason: string;
  changedAt?: string;
  changedBy?: string;
}

export function usePixelingsChat(roomName: string, currentUserId: string, demoMode = false, isModerator = false) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [lockState, setLockState] = useState<ChatLockState>({ reason: '' });
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    let realtimeSessionId = '';
    if (demoMode) {
      setMessages([
        { id: '1', sender_id: 'mira', sender_name: 'Mira', sender_username: 'Mira', content: 'The new lounge is looking good ✨', is_whisper: false, created_at: new Date().toISOString() },
        { id: '2', sender_id: currentUserId, sender_name: 'You', sender_username: 'YourFirstName', content: 'Right? I wanted it to feel warm, not noisy.', is_whisper: false, created_at: new Date().toISOString() },
        { id: '3', sender_id: 'mira', sender_name: 'Mira', sender_username: 'Mira', content: 'That balance is perfect.', is_whisper: true, recipient_id: currentUserId, created_at: new Date().toISOString() },
      ]);
      setParticipants([{ id: 'mira', name: 'Mira' }, { id: 'pixels7', name: 'Pixels7' }, { id: 'pixels12', name: 'Pixels12' }]);
      setReviewQueue([{ id: 'review-1', sender_id: 'pixels7', sender_name: 'Pixels7', content: 'This is a stupid idea', is_whisper: false, created_at: new Date().toISOString(), status: 'pending', moderation_reason: 'Possible unsafe language: “stupid”' }]);
      setIsLive(true);
      setLockState({ reason: '' });
      setLoading(false);
      return;
    }
    // 1. Fetch initial session lock state & messages
    async function initChat() {
      const { data: profileData } = await supabase.from('profiles').select('id, username, approved_nickname');
      if (profileData) setParticipants(profileData.map((profile) => ({ id: profile.id, name: profile.approved_nickname || profile.username })));
      const { data: session } = await supabase
        .from('sessions')
        .select('id, status, lock_reason, locked_at, locked_by')
        .eq('name', roomName)
        .single();
      if (!session) { setLoading(false); return; }
      realtimeSessionId = session.id;
      setSessionId(session.id);
      setIsLive(session?.status === 'live');
      setLockState({
        reason: session.status === 'locked' ? session.lock_reason || '' : '',
        changedAt: session.locked_at || undefined,
        changedBy: session.locked_by || undefined,
      });

      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true });

      if (msgData) setMessages(msgData);
      setLoading(false);
    }

    initChat();

    // 2. Subscribe to Realtime Message & Session Updates
    const chatChannel = supabase
      .channel(`chat:${roomName}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg.session_id !== realtimeSessionId) return;
          // Filtering recipient whispers client-side in tandem with RLS
          if (isModerator || !newMsg.is_whisper || newMsg.recipient_id === currentUserId || newMsg.sender_id === currentUserId) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          if ((payload.old as Message).session_id !== realtimeSessionId) return;
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.new.id !== realtimeSessionId) return;
          setIsLive(payload.new.status === 'live');
          setLockState({
            reason: payload.new.status === 'locked' ? payload.new.lock_reason || '' : '',
            changedAt: payload.new.locked_at || undefined,
            changedBy: payload.new.locked_by || undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [roomName, currentUserId, demoMode, isModerator]);

  // Send message helper enforcing client-side live check before RPC/Insert
  const sendMessage = async (content: string, recipientId?: string, senderName: string = 'Pixel') => {
    if (!isLive) throw new Error("Chat is currently locked. Session is not LIVE.");

    if (demoMode) {
      const message: Message = {
        id: crypto.randomUUID(), sender_id: currentUserId, sender_name: senderName,
        content, is_whisper: Boolean(recipientId), recipient_id: recipientId, created_at: new Date().toISOString(), status: 'approved',
      };
      const reason = moderationReason(content);
      if (reason) setReviewQueue((prev) => [...prev, { ...message, status: 'pending', moderation_reason: reason }]);
      else setMessages((prev) => [...prev, message]);
      return;
    }

    const isWhisper = Boolean(recipientId);
    
    const { error } = await supabase.from('messages').insert({
      session_id: sessionId,
      sender_id: currentUserId,
        sender_name: senderName,
      content,
      is_whisper: isWhisper,
      recipient_id: recipientId || null,
    });

    if (error) throw error;
  };

  // DM / Admin purge functionality
  const purgeChat = async () => {
    if (demoMode) {
      setMessages([]);
      return;
    }
    await supabase.from('messages').delete().eq('session_id', sessionId);
  };

  const approveMessage = async (message: Message) => {
    if (demoMode) {
      setReviewQueue((prev) => prev.filter((item) => item.id !== message.id));
      setMessages((prev) => [...prev, { ...message, status: 'approved' }]);
      return;
    }
    await supabase.from('messages').update({ status: 'approved' }).eq('id', message.id);
  };

  const rejectMessage = async (message: Message) => {
    if (demoMode) { setReviewQueue((prev) => prev.filter((item) => item.id !== message.id)); return; }
    await supabase.from('messages').update({ status: 'rejected' }).eq('id', message.id);
  };

  const toggleLive = async (reason = '') => {
    const next = !isLive;
    const previousLockState = lockState;
    const nextLockState = next ? { reason: '' } : { reason: reason.trim() || 'Chat temporarily locked by a moderator.' };
    setIsLive(next);
    setLockState(nextLockState);
    if (!demoMode) {
      const { error } = await supabase.from('sessions').update({
        status: next ? 'live' : 'locked',
        lock_reason: next ? null : nextLockState.reason,
        locked_at: next ? null : new Date().toISOString(),
        locked_by: next ? null : currentUserId,
      }).eq('id', sessionId);
      if (error) {
        setIsLive(!next);
        setLockState(previousLockState);
        throw error;
      }
    }
  };

  return { messages, reviewQueue: isModerator ? reviewQueue : [], participants, isLive, lockState, loading, sendMessage, purgeChat, approveMessage, rejectMessage, toggleLive };
}
