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

export const TeacherNotificationCenter: React.FC<{ onUnreadChange?: (count: number) => void }> = ({ onUnreadChange }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  // Alerts the teacher dismissed with "Clear all"; kept so the 30s re-fetch
  // doesn't resurrect them.
  const dismissedRef = React.useRef<Set<string>>(new Set());

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [unreadCount, onUnreadChange]);

  const fetchNotifications = async () => {
    // In a real implementation, we would subscribe to a 'notifications' table 
    // or filter the 'messages' table for high-priority flags.
    // For now, we simulate the fetch.
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, sender_name, content, created_at')
      .eq('status', 'approved')
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
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
    // Update notification status in DB
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
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
         notifications.length === 0 ? <p>All quiet in the lounge! ✨</p> : 
         notifications.map(n => (
           <div key={n.id} className={`notif-item ${n.read ? 'read' : 'unread'}`} onClick={() => markAsRead(n.id)}>
             <div className="notif-icon">
               {n.type === 'signal' ? '🚨' : '🔔'}
             </div>
             <div className="notif-body">
               <strong>{n.sender_name}</strong>
               <span>{n.content}</span>
             </div>
             <div className="notif-time">{// Simple date formatting
               new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
             }</div>
           </div>
         ))}
      </div>
      <style>{`
        .notif-center { 
          background: white; border-radius: 12px; padding: 1rem; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-width: 400px; 
          border: 2px solid #eee;
        }
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
