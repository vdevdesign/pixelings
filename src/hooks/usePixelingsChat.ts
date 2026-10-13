import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { moderationReason } from '../../lib/moderation';

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  is_whisper: boolean;
  recipient_id?: string;
  created_at: string;
  status?: 'approved' | 'pending' | 'rejected';
  moderation_reason?: string | null;
}
export interface Participant { id: string; name: string; }

export function usePixelingsChat(sessionId: string, currentUserId: string, demoMode = false, isModerator = false) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (demoMode) {
      setMessages([
        { id: '1', sender_id: 'mira', sender_name: 'Mira', content: 'The new lounge is looking good ✨', is_whisper: false, created_at: new Date().toISOString() },
        { id: '2', sender_id: currentUserId, sender_name: 'You', content: 'Right? I wanted it to feel warm, not noisy.', is_whisper: false, created_at: new Date().toISOString() },
        { id: '3', sender_id: 'mira', sender_name: 'Mira', content: 'That balance is perfect.', is_whisper: true, recipient_id: currentUserId, created_at: new Date().toISOString() },
      ]);
      setParticipants([{ id: 'mira', name: 'Mira' }, { id: 'pixels7', name: 'Pixels7' }, { id: 'pixels12', name: 'Pixels12' }]);
      setReviewQueue([{ id: 'review-1', sender_id: 'pixels7', sender_name: 'Pixels7', content: 'This is a stupid idea', is_whisper: false, created_at: new Date().toISOString(), status: 'pending', moderation_reason: 'Possible unsafe language: “stupid”' }]);
      setIsLive(true);
      setLoading(false);
      return;
    }
    // 1. Fetch initial session lock state & messages
    async function initChat() {
      const { data: profileData } = await supabase.from('profiles').select('id, username, approved_nickname');
      if (profileData) setParticipants(profileData.map((profile) => ({ id: profile.id, name: profile.approved_nickname || profile.username })));
      const { data: session } = await supabase
        .from('sessions')
        .select('status')
        .eq('id', sessionId)
        .single();
        
      setIsLive(session?.status === 'live');

      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (msgData) setMessages(msgData);
      setLoading(false);
    }

    initChat();

    // 2. Subscribe to Realtime Message & Session Updates
    const chatChannel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          // Filtering recipient whispers client-side in tandem with RLS
          if (isModerator || !newMsg.is_whisper || newMsg.recipient_id === currentUserId || newMsg.sender_id === currentUserId) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          setIsLive(payload.new.status === 'live');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [sessionId, currentUserId, demoMode, isModerator]);

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

  const toggleLive = async () => {
    const next = !isLive;
    setIsLive(next);
    if (!demoMode) await supabase.from('sessions').update({ status: next ? 'live' : 'locked' }).eq('id', sessionId);
  };

  return { messages, reviewQueue: isModerator ? reviewQueue : [], participants, isLive, loading, sendMessage, purgeChat, approveMessage, rejectMessage, toggleLive };
}
