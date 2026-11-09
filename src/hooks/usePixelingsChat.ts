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
export interface NicknameRequest { id: string; username: string; nickname: string; }
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
  isModerator = false
) {
  const PAGE_SIZE = 15;
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [reviewQueue, setReviewQueue] = React.useState<Message[]>([]);
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [nicknameRequests, setNicknameRequests] = React.useState<NicknameRequest[]>([]);
  const [isLive, setIsLive] = React.useState<boolean>(false);
  const [lockState, setLockState] = React.useState<ChatLockState>({ reason: '' });
  const [loading, setLoading] = React.useState<boolean>(true);
  const [sessionId, setSessionId] = React.useState<string>('');
  const [sessionRoom, setSessionRoom] = React.useState('');
  const [loadedRoom, setLoadedRoom] = React.useState('');
  const [hasMoreMessages, setHasMoreMessages] = React.useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = React.useState(false);
  const [chatLoadError, setChatLoadError] = React.useState('');
  const [historyError, setHistoryError] = React.useState('');
  const coinSendTimes = React.useRef<number[]>([]);
  // Heartbeat every 30s so the roster shows who is online and in which room.
  React.useEffect(() => {
    if (demoMode || !currentUserId) return;
    const beat = () => { void supabase.rpc('heartbeat', { room_name: roomName }); };
    beat();
    const timer = window.setInterval(beat, 30000);
    return () => window.clearInterval(timer);
  }, [roomName, currentUserId, demoMode]);
  // Refresh the online roster every 30s alongside the heartbeat.
  const [onlineUsers, setOnlineUsers] = React.useState<{ user_id: string; display_name: string; room: string | null }[]>([]);
  React.useEffect(() => {
    if (demoMode) return;
    const pull = () => { void supabase.from('online_now').select('user_id, display_name, room')
      .then(({ data }) => { if (data) setOnlineUsers(data as typeof onlineUsers); }); };
    pull();
    const timer = window.setInterval(pull, 30000);
    return () => window.clearInterval(timer);
  }, [demoMode]);
  // Block sending while the signed-in user is timed out or banned.
  const [penalty, setPenalty] = React.useState<{ kind: string; reason: string; until?: string } | null>(null);
  React.useEffect(() => {
    if (demoMode || !currentUserId) { setPenalty(null); return; }
    const check = async () => {
      const { data } = await supabase.from('chat_penalties').select('kind, reason, until_at, lifted_at').eq('user_id', currentUserId).is('lifted_at', null).order('created_at', { ascending: false }).limit(5);
      const rows = (data || []) as { kind: string; reason: string; until_at: string | null; lifted_at: string | null }[];
      const active = rows.find((row) => row.kind === 'ban' || (row.kind === 'timeout' && row.until_at && new Date(row.until_at) > new Date()));
      setPenalty(active ? { kind: active.kind, reason: active.reason, until: active.until_at || undefined } : null);
    };
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    return () => window.clearInterval(timer);
  }, [currentUserId, demoMode]);
  const activeRoomRef = React.useRef(roomName);
  activeRoomRef.current = roomName;

  const activeMessages = loadedRoom === roomName ? messages : [];
  const activeIsLive = loadedRoom === roomName && isLive;
  const activeLoading = loadedRoom !== roomName || loading;

  React.useEffect(() => {
    let cancelled = false;
    let realtimeSessionId = '';
    setMessages([]);
    setIsLive(false);
    setLoading(true);
    setSessionId('');
    setSessionRoom('');
    setLoadedRoom(roomName);
    setHasMoreMessages(false);
    setLoadingOlderMessages(false);
    setChatLoadError('');
    setHistoryError('');
    setReviewQueue([]);
    setLockState({ reason: '' });
    if (demoMode) {
      setMessages([
        { id: '1', sender_id: 'mira', sender_name: 'Mira', sender_username: 'Mira', content: `The ${roomName} room is looking good ✨`, is_whisper: false, created_at: new Date().toISOString() },
        { id: '2', sender_id: currentUserId, sender_name: 'You', sender_username: 'YourFirstName', content: `We can keep ${roomName} chat focused on this class.`, is_whisper: false, created_at: new Date().toISOString() },
        { id: '3', sender_id: 'mira', sender_name: 'Mira', sender_username: 'Mira', content: 'That balance is perfect.', is_whisper: true, recipient_id: currentUserId, created_at: new Date().toISOString() },
      ]);
      setParticipants([{ id: 'mira', name: 'Mira', avatarUrl: profileItems[0]?.id, backgroundUrl: null }, { id: 'pixels7', name: 'Pixels7', avatarUrl: profileItems[1]?.id, backgroundUrl: null }, { id: 'pixels12', name: 'Pixels12', avatarUrl: profileItems[2]?.id, backgroundUrl: null }]);
      setReviewQueue([{ id: 'review-1', sender_id: 'pixels7', sender_name: 'Pixels7', content: 'This is a stupid idea', is_whisper: false, created_at: new Date().toISOString(), status: 'pending', moderation_reason: 'Possible unsafe language: “stupid”' }]);
      setIsLive(true);
      setLockState({ reason: '' });
      setLoading(false);
      return () => { cancelled = true; };
    }
    // 1. Fetch initial session lock state & messages
    async function initChat() {
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('id, status, lock_reason, locked_at, locked_by')
        .eq('name', roomName)
        .maybeSingle();
      if (cancelled) return;
      if (sessionError) {
        setChatLoadError(`Could not load ${roomName}. Please try again.`);
        setLoading(false);
        return;
      }
      if (!session) {
        setChatLoadError(roomName === 'Teacher Lounge'
          ? 'Teacher Lounge has not been set up in Supabase yet. Run supabase/teacher_lounge_room.sql to add it.'
          : `The ${roomName} room has not been set up in Supabase yet.`);
        setLoading(false);
        return;
      }
      realtimeSessionId = session.id;
      setSessionId(session.id);
      setSessionRoom(roomName);
      setIsLive(session.status === 'live');
      setLockState({
        reason: session.status === 'locked' ? session.lock_reason || '' : '',
        changedAt: session.locked_at || undefined,
        changedBy: session.locked_by || undefined,
      });

      const { data: msgData, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (messageError) {
        setChatLoadError(`Could not load messages for ${roomName}. Please try again.`);
        setLoading(false);
        return;
      }
      const initialMessages = (msgData || []).reverse();
      setMessages(initialMessages);
      setHasMoreMessages(initialMessages.length === PAGE_SIZE);
      setLoading(false);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles_public')
        .select('id, username, approved_nickname, avatar_url, background_url');
      if (!cancelled && profileError) console.error('Failed to load chat participants:', profileError);
      if (!cancelled && profileData) setParticipants(profileData.map((profile) => ({ id: profile.id, name: profile.approved_nickname || profile.username, avatarUrl: profile.avatar_url || 'profile-happy-slime', backgroundUrl: profile.background_url || 'background-happy-slime' })));
      if (!cancelled && isModerator) {
        const { data: pendingData, error: pendingError } = await supabase.from('profiles').select('id, username, pending_nickname').eq('nickname_status', 'pending');
        if (pendingError) console.error('Failed to load nickname requests:', pendingError);
        if (pendingData) setNicknameRequests(pendingData.map((row) => ({ id: row.id, username: row.username, nickname: row.pending_nickname })));
      }
    }

    initChat();

    // 2. Subscribe to Realtime Message & Session Updates
    const chatChannel = supabase
      .channel(`chat:${roomName}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (cancelled) return;
          const newMsg = payload.new as Message;
          if (newMsg.session_id !== realtimeSessionId) return;
          // Filtering recipient whispers client-side in tandem with RLS
          if (isModerator || !newMsg.is_whisper || newMsg.recipient_id === currentUserId || newMsg.sender_id === currentUserId) {
            setMessages((prev) => prev.some((message) => message.id === newMsg.id) ? prev : [...prev, newMsg]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          if (cancelled) return;
          if ((payload.old as Message).session_id !== realtimeSessionId) return;
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions' },
        (payload) => {
          if (cancelled) return;
          if (payload.new.id !== realtimeSessionId) return;
          setIsLive(payload.new.status === 'live');
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
        () => {
          // Realtime payloads are filtered by RLS, so a row may arrive without
          // data. Refetch the safe public view to keep participants in sync.
          void supabase.from('profiles_public').select('id, username, approved_nickname, avatar_url, background_url')
            .then(({ data }) => {
              if (data) setParticipants(data.map((profile) => ({ id: profile.id, name: profile.approved_nickname || profile.username, avatarUrl: profile.avatar_url || 'profile-happy-slime', backgroundUrl: profile.background_url || 'background-happy-slime' })));
            });
          if (isModerator) {
            void supabase.from('profiles').select('id, username, pending_nickname').eq('nickname_status', 'pending')
              .then(({ data }) => {
                if (data) setNicknameRequests(data.map((row) => ({ id: row.id, username: row.username, nickname: row.pending_nickname })));
              });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(chatChannel);
    };
  }, [roomName, currentUserId, demoMode, isModerator]);

  // The Teacher Lounge is permanently unlocked: only staff can see it, and
  // global "Lock chats" skips it so staff always have a place to talk.
  React.useEffect(() => {
    if (roomName !== 'Teacher Lounge' || demoMode) return;
    void supabase.from('sessions').update({ status: 'live', lock_reason: null }).eq('name', 'Teacher Lounge')
      .then(({ data, error }) => {
        if (!error) { setIsLive(true); setLockState({ reason: '' }); }
      });
  }, [roomName, demoMode]);

  // Send message helper enforcing room readiness and client-side live status.
  const sendMessage = async (
    content: string,
    recipientId?: string,
    senderName: string = 'Pixel',
    isBroadcast = false,
    isPriority = false,
  ) => {
    if (!demoMode && (!sessionId || sessionRoom !== roomName)) {
      throw new Error(chatLoadError || `The ${roomName} room is not ready yet. Please try again in a moment.`);
    }
    if ((!activeIsLive || sessionRoom !== roomName) && !isModerator) throw new Error("Chat is currently locked. Session is not LIVE.");
    if (penalty && !isModerator) {
      throw new Error(penalty.kind === 'ban'
        ? 'You are banned from chat. Ask your teacher for help.'
        : `You are in time out until ${new Date(penalty.until as string).toLocaleTimeString()}.`);
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
      else setMessages((prev) => [...prev, message]);
      return;
    }

    const isWhisper = Boolean(recipientId);
    let sendError: string | null = null;

    const { error } = await supabase.from('messages').insert({
      session_id: sessionId,
      sender_id: currentUserId,
        sender_name: senderName,
      content,
      is_whisper: isWhisper,
      recipient_id: recipientId || null,
      is_broadcast: isBroadcast,
      is_priority: isPriority,
    });
    if (error) sendError = error.message;

    // Retry once without is_priority/is_broadcast flags: older databases that
    // have not run supabase/chat_features.sql reject unknown columns.
    if (sendError && /column|is_priority|is_broadcast/i.test(sendError)) {
      const { error: retryError } = await supabase.from('messages').insert({
        session_id: sessionId,
        sender_id: currentUserId,
        sender_name: senderName,
        content,
        is_whisper: isWhisper,
        recipient_id: recipientId || null,
      });
      if (retryError) sendError = retryError.message; else sendError = null;
    }

    if (sendError) {
      // A failed insert must not consume one of the user's three coin sends.
      if (reservedCoinTimestamp !== null) {
        coinSendTimes.current = coinSendTimes.current.filter((sentAt) => sentAt !== reservedCoinTimestamp);
      }
      throw error;
    }
  };

  const loadOlderMessages = async () => {
    if (!hasMoreMessages || loadingOlderMessages || !sessionId || sessionRoom !== roomName || demoMode) return;
    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    const requestedRoom = roomName;
    setLoadingOlderMessages(true);
    setHistoryError('');
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .or(`created_at.lt.${oldestMessage.created_at},and(created_at.eq.${oldestMessage.created_at},id.lt.${oldestMessage.id})`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE);

    if (activeRoomRef.current !== requestedRoom) return;
    setLoadingOlderMessages(false);
    if (error) {
      console.error(`Failed to load older messages for ${requestedRoom}:`, error);
      setHistoryError('Could not load earlier messages. Please try again.');
      return;
    }

    const olderMessages = (data || []).reverse();
    setMessages((currentMessages) => {
      const currentIds = new Set(currentMessages.map((message) => message.id));
      return [...olderMessages.filter((message) => !currentIds.has(message.id)), ...currentMessages];
    });
    setHasMoreMessages((data || []).length === PAGE_SIZE);
  };

  const requestNickname = async (requested: string) => {
    if (demoMode) return;
    const { error } = await supabase.rpc('request_nickname', { requested: requested.trim() });
    if (error) throw error;
  };

  // Teacher action: approve or reject a student's pending nickname. Approval
  // writes approved_nickname server-side, so the message trigger and the
  // participants refetch immediately start using the new name.
  const reviewNickname = async (studentId: string, approve: boolean) => {
    if (demoMode) {
      setNicknameRequests((prev) => prev.filter((request) => request.id !== studentId));
      return;
    }
    const { data, error } = await supabase.rpc('approve_nickname', { student_id: studentId, approve });
    if (error) throw error;
    setNicknameRequests((prev) => prev.filter((request) => request.id !== studentId));
    void supabase.from('profiles_public').select('id, username, approved_nickname, avatar_url, background_url')
      .then(({ data }) => {
        if (data) setParticipants(data.map((profile) => ({ id: profile.id, name: profile.approved_nickname || profile.username, avatarUrl: profile.avatar_url || 'profile-happy-slime', backgroundUrl: profile.background_url || 'background-happy-slime' })));
      });
    return data;
  };

  // DM / Admin purge functionality
  const purgeChat = async () => {
    if (demoMode) {
      setMessages([]);
      return;
    }
    const { error } = await supabase.from('messages').delete().eq('session_id', sessionId);
    if (error) throw error;
    setMessages([]);
  };

  const deleteMessage = async (messageId: string) => {
    if (demoMode) {
      setMessages((prev) => prev.filter((message) => message.id !== messageId));
      setReviewQueue((prev) => prev.filter((item) => item.id !== messageId));
      return;
    }
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) throw error;
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
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

  const toggleLive = async (reason = '', requestedState?: boolean) => {
    if (roomName === 'Teacher Lounge' && isModerator) return;
    const next = requestedState ?? !activeIsLive;
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

  return {
    messages: activeMessages,
    reviewQueue: isModerator ? reviewQueue : [],
    participants,
    isLive: activeIsLive,
    lockState,
    loading: activeLoading,
    hasMoreMessages: loadedRoom === roomName && hasMoreMessages,
    loadingOlderMessages: loadedRoom === roomName && loadingOlderMessages,
    chatLoadError: loadedRoom === roomName ? chatLoadError : '',
    historyError: loadedRoom === roomName ? historyError : '',
    loadOlderMessages,
    sendMessage,
    sessionId: loadedRoom === roomName ? sessionId : '',
    onlineUsers,
    penalty,
    requestNickname,
    nicknameRequests,
    reviewNickname,
    purgeChat,
    deleteMessage,
    approveMessage,
    rejectMessage,
    toggleLive,
  };
}
