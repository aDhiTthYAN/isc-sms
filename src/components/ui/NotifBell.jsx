import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifs } from '../../context/NotifContext';
import {
  Bell, CheckCheck, AlertCircle, PhoneCall, ClipboardList,
  FileText, UserCheck, BookOpen, Users, Star, CalendarClock
} from 'lucide-react';

const TYPE_META = {
  task:               { icon: <ClipboardList size={14} />, color: 'var(--amber-ink)',  bg: 'var(--amber-soft)',  route: '/tasks' },
  schedule:           { icon: <CalendarClock size={14} />, color: 'var(--teal-ink)',   bg: 'var(--teal-soft)',   route: '/schedule' },
  followup:           { icon: <PhoneCall size={14} />,     color: 'var(--blue-ink)',   bg: 'var(--blue-soft)',   route: '/followups' },
  concern:            { icon: <AlertCircle size={14} />,   color: 'var(--red-ink)',    bg: 'var(--red-soft)',    route: '/concerns' },
  request_update:     { icon: <FileText size={14} />,      color: 'var(--teal-ink)',   bg: 'var(--teal-soft)',   route: '/requests' },
  request_accepted:   { icon: <UserCheck size={14} />,     color: 'var(--green-ink)',  bg: 'var(--green-soft)',  route: '/requests' },
  assessment:         { icon: <BookOpen size={14} />,      color: 'var(--violet-ink)', bg: 'var(--violet-soft)', route: '/assessments' },
  batch_assignment:   { icon: <Users size={14} />,         color: 'var(--blue-ink)',   bg: 'var(--blue-soft)',   route: '/batches' },
  lead:               { icon: <Star size={14} />,          color: 'var(--amber-ink)',  bg: 'var(--amber-soft)',  route: '/leads' },
};

const DEFAULT_META = { icon: <Bell size={14} />, color: 'var(--text-muted)', bg: 'var(--surface-sunken)', route: null };

function getMeta(type) {
  if (!type) return DEFAULT_META;
  const key = type.toLowerCase().replace(/\s+/g, '_');
  if (TYPE_META[key] || TYPE_META[type]) return TYPE_META[key] || TYPE_META[type];
  // Prefix match so variants (assessment_added, assessment_assignment,
  // task_completed, request_update, …) route to the right page.
  if (key.startsWith('assessment')) return TYPE_META.assessment;
  if (key.startsWith('schedule'))   return TYPE_META.schedule;
  if (key.startsWith('task'))       return TYPE_META.task;
  if (key.startsWith('followup'))   return TYPE_META.followup;
  if (key.startsWith('concern'))    return TYPE_META.concern;
  if (key.startsWith('request'))    return TYPE_META.request_update;
  if (key.startsWith('removal'))    return TYPE_META.request_update; // removal_request / removal_reminder → /requests
  if (key.startsWith('batch'))      return TYPE_META.batch_assignment;
  if (key.startsWith('lead'))       return TYPE_META.lead;
  return DEFAULT_META;
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotifBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifs();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (n) => {
    markRead(n.id);
    const meta = getMeta(n.type);
    const route = n.route || meta.route;
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative', background: 'transparent',
          border: '1px solid var(--border)', borderRadius: 8,
          padding: '6px 8px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', color: 'var(--text-muted)'
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--red-ink)', color: '#fff',
            borderRadius: '50%', width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700,
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 8,
          width: 348, background: 'var(--white)',
          border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: 'var(--shadow-md)', zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  background: 'var(--red-soft)', color: 'var(--red-ink)',
                  borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 6
                }}>{unreadCount} new</span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ background: 'none', border: 'none', color: 'var(--red-ink)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No notifications yet
              </div>
            )}
            {notifications.map(n => {
              const meta = getMeta(n.type);
              const body = n.body || n.message || '';
              const title = n.title || '';
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '11px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: n.read ? 'transparent' : 'var(--surface-sunken)',
                    cursor: 'pointer',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: meta.bg,
                    color: meta.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {title && (
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {title}
                      </div>
                    )}
                    {body && (
                      <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text)', lineHeight: 1.4 }}>
                        {body}
                      </div>
                    )}
                    {!body && !title && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>—</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {n.fromName && `From ${n.fromName} · `}{timeAgo(n.createdAt)}
                    </div>
                  </div>
                  {!n.read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red-ink)', flexShrink: 0, marginTop: 5 }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer — full history */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <button
              onClick={() => { setOpen(false); navigate('/notifications'); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-ink)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
