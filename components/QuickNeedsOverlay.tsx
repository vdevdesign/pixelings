import React from 'react';
import { supabase } from '../lib/supabaseClient';
import type { ChatRoom } from './chatRooms';

const QUICK_NEEDS = [
  { label: 'Bathroom', emoji: '🚽', message: 'I need to use the restroom' },
  { label: 'Water/Snack', emoji: '🍎', message: 'I am hungry or thirsty' },
  { label: 'Help', emoji: '🆘', message: 'I need help' },
  { label: 'Break', emoji: '🎧', message: 'I need a sensory break' },
];

// App-wide quick-needs overlay (bottom-left). Sends priority quick-need
// messages to the student's current chat room, which the DB archives so only
// the teacher's Priority Alerts panel ever sees them.
export function QuickNeedsOverlay({ room, userId, username, hidden }: {
  room: ChatRoom;
  userId: string;
  username: string;
  hidden?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  if (hidden) return null;

  const send = async (need: typeof QUICK_NEEDS[0]) => {
    setBusy(true);
    setNotice('');
    // Find the room's session first; fall back gracefully if it is missing.
    const { data: session } = await supabase.from('sessions').select('id').eq('name', room).maybeSingle();
    if (!session) {
      setBusy(false);
      setNotice('Chat room is not ready yet. Try again in a moment.');
      return;
    }
    const { error } = await supabase.from('messages').insert({
      session_id: session.id,
      sender_id: userId,
      sender_name: username,
      content: `🆘 ${need.emoji} ${need.message}`,
      is_whisper: false,
      is_priority: true,
    });
    setBusy(false);
    if (error) setNotice('Could not send the request. Try again.');
    else {
      setNotice(`Sent to your teacher!`);
      setOpen(false);
    }
  };

  return (
    <div className="quick-needs-control">
      <button type="button" className="quick-needs-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="quick-needs-menu">
        <span aria-hidden="true">✦</span> Quick needs
      </button>
      {open && <div className="quick-needs-menu" id="quick-needs-menu" ref={menuRef} role="group" aria-label="Quick needs">
        {QUICK_NEEDS.map((need) => <button key={need.label} type="button" disabled={busy} onClick={() => void send(need)} title={need.message}>
          <span aria-hidden="true">{need.emoji}</span>{need.label}
        </button>)}
      </div>}
      {notice && <div className="quick-needs-notice" role="status">{notice}</div>}
    </div>
  );
}
