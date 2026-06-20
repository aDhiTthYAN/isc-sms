import { useState, useRef, useEffect } from 'react';
import { useNotifs } from '../../context/NotifContext';
import { Bell, CheckCheck, AlertCircle, PhoneCall, ClipboardList } from 'lucide-react';

const TYPE_ICONS = {
  task:     <ClipboardList size={14} style={{ color: '#F59E0B' }} />,
  followup: <PhoneCall size={14} style={{ color: '#3B82F6' }} />,
  concern:  <AlertCircle size={14} style={{ color: '#EF4444' }} />,
};

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotifBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifs();
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative', background: 'transparent',
          border: '1px solid var(--border)', borderRadius: 8,
          padding: '6px 8px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', color: 'var(--muted)'
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#E53935', color: '#fff',
            borderRadius: '50%', width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700,
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 8,
          width: 340, background: 'var(--white)',
          border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Notifications {unreadCount > 0 && <span style={{ background: '#FEE2E2', color: '#E53935', borderRadius: 10, padding: '1px 7px', fontSize: 11, marginLeft: 4 }}>{unreadCount} new</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ background: 'none', border: 'none', color: '#E53935', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No notifications yet
              </div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  background: n.read ? 'transparent' : '#FFF8F8',
                  cursor: 'pointer',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: n.read ? 'var(--bg)' : '#FEE2E2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {TYPE_ICONS[n.type] || <Bell size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {n.title && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {n.title}
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text)', lineHeight: 1.4 }}>
                    {n.message || n.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {n.fromName && `From ${n.fromName} · `}{timeAgo(n.createdAt)}
                  </div>
                </div>
                {!n.read && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E53935', flexShrink: 0, marginTop: 4 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}