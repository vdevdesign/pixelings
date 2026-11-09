import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Notification {
  id: string;
  sender_id: string;
  sender_name: string;
  type: 'quick-need' | 'signal' | 'mood';
  content: string;
  timestamp: string;
  read: boolean;
}

export const TeacherNotificationCenter: React.FC<{
  onUnreadChange?: (count: number) => void;
  reviewQueue?: { id: string; sender_name: string; content: string; moderation_reason?: string | null }[];
  nicknameRequests?: { id: string; username: string; nickname: string }[];
  onApproveMessage?: (id: string) => void;
  onRejectMessage?: (id: string) => void;
  onApproveNickname?: (id: string) => void;
  onRejectNickname?: (id: string) => void;
}> = ({ onUnreadChange, reviewQueue = [], nicknameRequests = [], onApproveMessage, onRejectMessage, onApproveNickname, onRejectNickname }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  // Alerts the teacher dismissed with "Clear all"; kept so the 30s re-fetch
  // doesn't resurrect them.
  const dismissedRef = React.useRef<Set<string>>(new Set());
  // When a new alert arrives it expands for ~5 seconds, then collapses back
  // into the list so the teacher notices it without opening the panel.
  const [spotlight, setSpotlight] = useState<Notification | null>(null);
  const seenIdsRef = React.useRef<Set<string>>(new Set());
  const spotlightTimerRef = React.useRef<number | null>(null);

  const queueCount = reviewQueue.length + nicknameRequests.length;
  const unreadCount = notifications.filter(n => !n.read).length + queueCount;

  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [unreadCount, onUnreadChange]);

  const fetchNotifications = async () => {
    // Quick-need alerts are priority messages marked 'archived' by a DB trigger,
    // so students never see them in the chat feed — but moderators can read them.
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, sender_name, content, created_at')
      .eq('is_priority', true)
      .in('status', ['archived', 'approved'])
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (!error && data) {
      const formatted = data
        .filter(m => !dismissedRef.current.has(m.id))
        .map(m => ({
        id: m.id,
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        type: m.content.includes('🆘') ? 'signal' as const : 'quick-need' as const,
        content: m.content,
        timestamp: m.created_at,
        read: false
      }));
      setNotifications(formatted);
      // Spotlight the newest alert we have not seen before.
      const fresh = formatted.find((item) => !seenIdsRef.current.has(item.id));
      if (fresh) {
        formatted.forEach((item) => seenIdsRef.current.add(item.id));
        setSpotlight(fresh);
        if (spotlightTimerRef.current) window.clearTimeout(spotlightTimerRef.current);
        spotlightTimerRef.current = window.setTimeout(() => setSpotlight(null), 5000);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    if (spotlight?.id === id) setSpotlight(null);
  };

  return (
    <div className="notif-center">
      <div className="notif-header">
        <h3>Priority Alerts</h3>
        <span className="notif-count">{notifications.filter(n => !n.read).length} New</span>
      </div>
      <div className="notif-actions">
        <button
          className="notif-clear-btn"
          onClick={() => {
            notifications.forEach(n => dismissedRef.current.add(n.id));
            setNotifications([]);
          }}
          disabled={loading || notifications.length === 0}
          title="Dismiss all notifications"
        >
          Clear all
        </button>
      </div>
      <div className="notif-list">
        {loading ? <p>Checking for alerts...</p> : 
         notifications.length === 0 && queueCount === 0 ? <p>All quiet in the lounge! ✨</p> : <>
         {spotlight && !spotlight.read && <div className={`notif-item spotlight unread`} onClick={() => markAsRead(spotlight.id)}>
           <div className="notif-icon">🚨</div>
           <div className="notif-body"><strong>{spotlight.sender_name}</strong><span>{spotlight.content}</span></div>
           <div className="notif-time">just now</div>
         </div>}
         {reviewQueue.map((item) => <div className="review-item" key={item.id}>
           <div><strong>{item.sender_name}</strong><p>{item.content}</p><small>{item.moderation_reason}</small></div>
           <div className="review-actions"><button onClick={() => onApproveMessage?.(item.id)} className="approve-button">Approve</button><button onClick={() => onRejectMessage?.(item.id)} className="reject-button">Reject</button></div>
         </div>)}
         {nicknameRequests.map((item) => <div className="review-item" key={item.id}>
           <div><strong>{item.username} · nickname</strong><p>{item.nickname}</p><small>Nickname requires teacher approval</small></div>
           <div className="review-actions"><button onClick={() => onApproveNickname?.(item.id)} className="approve-button">Approve</button><button onClick={() => onRejectNickname?.(item.id)} className="reject-button">Reject</button></div>
         </div>)}
         {notifications.filter(n => n.id !== spotlight?.id).map(n => (
           <div key={n.id} className={`notif-item ${n.read ? 'read' : 'unread'}`} onClick={() => markAsRead(n.id)}>
             <div className="notif-icon">{n.type === 'signal' ? '🚨' : '🔔'}</div>
             <div className="notif-body"><strong>{n.sender_name}</strong><span>{n.content}</span></div>
             <div className="notif-time">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
           </div>
         ))}
         </>}
      </div>
      <style>{`
        .notif-center { 
          background: #102936ee; backdrop-filter: blur(10px); border-radius: 12px; padding: 1rem; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; 
          border: 2px solid #174654; color: #d3d1c7;
        }
        .notif-center .notif-header h3 { color: #eaffff; }
        .notif-center .notif-item.unread { background: #123c46; border-left: 4px solid #ff4d4d; }
        .notif-center .notif-item.read { background: #0c1c27; border-left: 4px solid #1c5262; }
        .notif-center .notif-item .notif-body strong { color: #eaffff; }
        .notif-center .notif-item .notif-body span { color: #9ab7bd; }
        .notif-center .notif-clear-btn { background: #0c1c27; color: #9ab7bd; border-color: #1c5262; }
        .notif-center .notif-clear-btn:hover:not(:disabled) { background: #123c46; color: #ffc1c1; border-color: #a95757; }
        .notif-center .notif-count { background: #d32f2f; }
        .notif-center .review-item { background: #102936; border-left: 4px solid #ffb54d; }
        .notif-center .review-item strong { color: #eaffff; }
        .notif-center .review-item p { color: #d3d1c7; margin: 4px 0; }
        .notif-center .review-item small { color: #9ab7bd; }
        .notif-header { 
          display: flex; justify-content: space-between; align-items: center; 
          margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;
        }
        .notif-count { background: #ff4d4d; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: bold; }
        .notif-actions { display: flex; justify-content: flex-end; margin: -0.25rem 0 0.5rem; }
        .notif-clear-btn {
          padding: 0.3rem 0.8rem; font-size: 0.75rem; font-weight: bold;
          background: #f3f4f6; color: #6b7280; border: 1px solid #ddd;
          border-radius: 6px; cursor: pointer; transition: background 0.2s;
        }
        .notif-clear-btn:hover:not(:disabled) { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
        .notif-clear-btn:disabled { opacity: 0.5; cursor: default; }
        .notif-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 400px; overflow-y: auto; }
        .notif-item { 
          display: flex; align-items: center; gap: 0.8rem; padding: 0.8rem; 
          border-radius: 8px; cursor: pointer; transition: background 0.2s; 
        }
        .notif-item.unread { background: #fff5f5; border-left: 4px solid #ff4d4d; }
        .notif-item.read { background: #f9f9f9; border-left: 4px solid #ccc; }
        .notif-icon { font-size: 1.2rem; }
        .notif-body { display: flex; flex-direction: column; flex: 1; }
        .notif-body strong { font-size: 0.9rem; color: #333; }
        .notif-body span { font-size: 0.8rem; color: #666; }
        .notif-time { font-size: 0.7rem; color: #aaa; }
      `}</style>
    </div>
  );
};
