import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  is_whisper: boolean;
  recipient_id?: string;
  created_at: string;
}

export function usePixelingsChat(sessionId: string, currentUserId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Fetch initial session lock state & messages
    async function initChat() {
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
          if (!newMsg.is_whisper || newMsg.recipient_id === currentUserId || newMsg.sender_id === currentUserId) {
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
  }, [sessionId, currentUserId]);

  // Send message helper enforcing client-side live check before RPC/Insert
  const sendMessage = async (content: string, recipientId?: string, senderName: string = 'Pixel') => {
    if (!isLive) throw new Error("Chat is currently locked. Session is not LIVE.");

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
    await supabase.from('messages').delete().eq('session_id', sessionId);
  };

  return { messages, isLive, loading, sendMessage, purgeChat };
}
