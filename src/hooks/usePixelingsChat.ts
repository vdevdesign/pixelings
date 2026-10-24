import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { moderationReason } from '../../lib/moderation';
import { avatarItemById, profileItems } from '../../components/avatarItems';

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
export interface Participant { id: string; name: string; avatarUrl?: string | null; backgroundUrl?: string | null; }
export interface ChatLockState {
  reason: string;
  changedAt?: string;
  changedBy?: string;
}
const COIN_EMOJI = '\u{1FA99}';

export function usePixelingsChat(
  roomName: string, 
  currentUserId: string, 
  demoMode = false, 
  isModerator = false,
  externalState?: {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    isLive: boolean;
    setIsLive: React.Dispatch<React.SetStateAction<boolean>>;
    loading: boolean;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  }
) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [reviewQueue, setReviewQueue] = React.useState<Message[]>([]);
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isLive, setIsLive] = React.useState<boolean>(false);
  const [lockState, setLockState] = React.useState<ChatLockState>({ reason: '' });
  const [loading, setLoading] = React.useState<boolean>(true);
  const [sessionId, setSessionId] = React.useState<string>('');
  const coinSendTimes = React.useRef<number[]>([]);

  // Resolve which state to use: provided external state or internal hook state
  const activeMessages = externalState?.messages ?? messages;
  const activeSetMessages = externalState?.setMessages ?? setMessages;
  const activeIsLive = externalState?.isLive ?? isLive;
  const activeSetIsLive = externalState?.setIsLive ?? setIsLive;
  const activeLoading = externalState?.loading ?? loading;
  const activeSetLoading = externalState?.setLoading ?? setLoading;

  React.useEffect(() => {
    let realtimeSessionId = '';
    if (demoMode) {
      activeSetMessages([
        { id: '1', sender_id: 'mira', sender_name: 'Mira', sender_username: 'Mira', content: 'The new lounge is looking good ✨', is_whisper: false, created_at: new Date().toISOString() },
        { id: '2', sender_id: currentUserId, sender_name: 'You', sender_username: 'YourFirstName', content: 'Right? I wanted it to feel warm, not noisy.', is_whisper: false, created_at: new Date().toISOString() },
        { id: '3', sender_id: 'mira', sender_name: 'Mira', sender_username: 'Mira', content: 'That balance is perfect.', is_whisper: true, recipient_id: currentUserId, created_at: new Date().toISOString() },
      ]);
      setParticipants([{ id: 'mira', name: 'Mira', avatarUrl: profileItems[0]?.id, backgroundUrl: null }, { id: 'pixels7', name: 'Pixels7', avatarUrl: profileItems[1]?.id, backgroundUrl: null }, { id: 'pixels12', name: 'Pixels12', avatarUrl: profileItems[2]?.id, backgroundUrl: null }]);
      setReviewQueue([{ id: 'review-1', sender_id: 'pixels7', sender_name: 'Pixels7', content: 'This is a stupid idea', is_whisper: false, created_at: new Date().toISOString(), status: 'pending', moderation_reason: 'Possible unsafe language: “stupid”' }]);
      activeSetIsLive(true);
      setLockState({ reason: '' });
      activeSetLoading(false);
      return;
    }
    // 1. Fetch initial session lock state & messages
    async function initChat() {
      const { data: profileData } = await supabase.from('profiles').select('id, username, approved_nickname, avatar_url, background_url');
      if (profileData) setParticipants(profileData.map((profile) => ({ id: profile.id, name: profile.approved_nickname || profile.username, avatarUrl: profile.avatar_url || 'profile-happy-slime', backgroundUrl: profile.background_url || 'background-happy-slime' })));
      const { data: session } = await supabase
        .from('sessions')
        .select('id, status, lock_reason, locked_at, locked_by')
        .eq('name', roomName)
        .single();
      if (!session) { activeSetLoading(false); return; }
      realtimeSessionId = session.id;
      setSessionId(session.id);
      activeSetIsLive(session?.status === 'live');
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

      if (msgData) activeSetMessages(msgData);
      activeSetLoading(false);
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
            activeSetMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          if ((payload.old as Message).session_id !== realtimeSessionId) return;
          activeSetMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        (payload) => {
          if (payload.new.id !== realtimeSessionId) return;
          activeSetIsLive(payload.new.status === 'live');
          setLockState({
            reason: payload.new.status === 'locked' ? payload.new.lock_reason || '' : '',
            changedAt: payload.new.locked_at || undefined,
            changedBy: payload.new.locked_by || undefined,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload) => {
          const profile = payload.new as { id: string; username: string; approved_nickname?: string | null; avatar_url?: string | null; background_url?: string | null };
          setParticipants((prev) => prev.map((participant) => participant.id === profile.id
            ? { ...participant, name: profile.approved_nickname || profile.username, avatarUrl: profile.avatar_url || 'profile-happy-slime', backgroundUrl: profile.background_url || 'background-happy-slime' }
            : participant));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [roomName, currentUserId, demoMode, isModerator, activeSetMessages, activeSetIsLive, activeSetLoading]);

  // Send message helper enforcing client-side live check before RPC/Insert
  const sendMessage = async (content: string, recipientId?: string, senderName: string = 'Pixel') => {
    if (!activeIsLive && !isModerator) throw new Error("Chat is currently locked. Session is not LIVE.");

    if (!demoMode && !sessionId) {
      throw new Error("Chat is still loading. Please try sending the effect again in a moment.");
    }

    let reservedCoinTimestamp: number | null = null;
    if (content.includes(COIN_EMOJI) && !demoMode) {
      const now = Date.now();
      coinSendTimes.current = coinSendTimes.current.filter((sentAt) => now - sentAt < 5 * 60 * 1000);
      if (coinSendTimes.current.length >= 3) throw new Error('Coin VFX is limited to 3 coin messages every 5 minutes.');
      coinSendTimes.current.push(now);
      reservedCoinTimestamp = now;
    }

    if (demoMode) {
      const message: Message = {
        id: crypto.randomUUID(), sender_id: currentUserId, sender_name: senderName,
        content, is_whisper: Boolean(recipientId), recipient_id: recipientId, created_at: new Date().toISOString(), status: 'approved',
      };
      const reason = moderationReason(content);
      if (reason) setReviewQueue((prev) => [...prev, { ...message, status: 'pending', moderation_reason: reason }]);
      else activeSetMessages((prev) => [...prev, message]);
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

    if (error) {
      // A failed insert must not consume one of the user's three coin sends.
      if (reservedCoinTimestamp !== null) {
        coinSendTimes.current = coinSendTimes.current.filter((sentAt) => sentAt !== reservedCoinTimestamp);
      }
      throw error;
    }
  };

  const requestNickname = async (requested: string) => {
    if (demoMode) return;
    const { error } = await supabase.rpc('request_nickname', { requested: requested.trim() });
    if (error) throw error;
  };

  // DM / Admin purge functionality
  const purgeChat = async () => {
    if (demoMode) {
      activeSetMessages([]);
      return;
    }
    const { error } = await supabase.from('messages').delete().eq('session_id', sessionId);
    if (error) throw error;
    activeSetMessages([]);
  };

  const deleteMessage = async (messageId: string) => {
    if (demoMode) {
      activeSetMessages((prev) => prev.filter((message) => message.id !== messageId));
      setReviewQueue((prev) => prev.filter((item) => item.id !== messageId));
      return;
    }
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) throw error;
    activeSetMessages((prev) => prev.filter((message) => message.id !== messageId));
  };

  const approveMessage = async (message: Message) => {
    if (demoMode) {
      setReviewQueue((prev) => prev.filter((item) => item.id !== message.id));
      activeSetMessages((prev) => [...prev, { ...message, status: 'approved' }]);
      return;
    }
    await supabase.from('messages').update({ status: 'approved' }).eq('id', message.id);
  };

  const rejectMessage = async (message: Message) => {
    if (demoMode) { setReviewQueue((prev) => prev.filter((item) => item.id !== message.id)); return; }
    await supabase.from('messages').update({ status: 'rejected' }).eq('id', message.id);
  };

  const toggleLive = async (reason = '', requestedState?: boolean) => {
    const next = requestedState ?? !activeIsLive;
    const previousLockState = lockState;
    const nextLockState = next ? { reason: '' } : { reason: reason.trim() || 'Chat temporarily locked by a moderator.' };
    activeSetIsLive(next);
    setLockState(nextLockState);
    if (!demoMode) {
      const { error } = await supabase.from('sessions').update({
        status: next ? 'live' : 'locked',
        lock_reason: next ? null : nextLockState.reason,
        locked_at: next ? null : new Date().toISOString(),
        locked_by: next ? null : currentUserId,
      }).eq('id', sessionId);
      if (error) {
        activeSetIsLive(!next);
        setLockState(previousLockState);
        throw error;
      }
    }
  };

  return { messages: activeMessages, reviewQueue: isModerator ? reviewQueue : [], participants, isLive: activeIsLive, lockState, loading: activeLoading, sendMessage, requestNickname, purgeChat, deleteMessage, approveMessage, rejectMessage, toggleLive };
}
