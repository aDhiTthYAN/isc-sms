import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifs } from '../context/NotifContext';
import {
  Bell, CheckCheck, AlertCircle, PhoneCall, ClipboardList,
  FileText, UserCheck, BookOpen, Users, Star, CalendarClock,
} from 'lucide-react';

// Same type→icon map as NotifBell, kept local so the page stands alone.
const TYPE_META = {
  task:             { icon: <ClipboardList size={15} />, color: 'var(--amber-ink)',  bg: 'var(--amber-soft)',  route: '/tasks' },
  schedule:         { icon: <CalendarClock size={15} />, color: 'var(--teal-ink)',   bg: 'var(--teal-soft)',   route: '/schedule' },
  followup:         { icon: <PhoneCall size={15} />,     color: 'var(--blue-ink)',   bg: 'var(--blue-soft)',   route: '/followups' },
  concern:          { icon: <AlertCircle size={15} />,   color: 'var(--red-ink)',    bg: 'var(--red-soft)',    route: '/concerns' },
  request_update:   { icon: <FileText size={15} />,      color: 'var(--teal-ink)',   bg: 'var(--teal-soft)',   route: '/requests' },
  request_accepted: { icon: <UserCheck size={15} />,     color: 'var(--green-ink)',  bg: 'var(--green-soft)',  route: '/requests' },
  assessment:       { icon: <BookOpen size={15} />,      color: 'var(--violet-ink)', bg: 'var(--violet-soft)', route: '/assessments' },
  batch_assignment: { icon: <Users size={15} />,         color: 'var(--blue-ink)',   bg: 'var(--blue-soft)',   route: '/batches' },
  lead:             { icon: <Star size={15} />,          color: 'var(--amber-ink)',  bg: 'var(--amber-soft)',  route: '/leads' },
};
const DEFAULT_META = { icon: <Bell size={15} />, color: 'var(--text-muted)', bg: 'var(--surface-sunken)', route: null };

function getMeta(type) {
  if (!type) return DEFAULT_META;
  const key = type.toLowerCase().replace(/\s+/g, '_');
  if (TYPE_META[key]) return TYPE_META[key];
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

export default function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifs();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const navigate = useNavigate();

  const shown = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;

  const openNotif = (n) => {
    if (!n.read) markRead(n.id);
    const meta = getMeta(n.type);
    const route = n.route || meta.route;
    if (route) navigate(route);
  };

  return (
    <div>
      <div className="page-header">
        <h2>Notifications
          <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
            ({unreadCount} unread)
          </span>
        </h2>
        {unreadCount > 0 && (
          <button className="btn" onClick={markAllRead}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCheck size={15} /> Mark all read
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="segmented" style={{ marginBottom: 16, display: 'inline-flex', gap: 4 }}>
        {['all', 'unread'].map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? 'active' : ''}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              textTransform: 'capitalize',
              border: '1px solid var(--border)',
              background: filter === f ? 'var(--accent-50, var(--teal-soft))' : 'transparent',
              color: filter === f ? 'var(--accent-ink, var(--teal-ink))' : 'var(--text-muted)',
              fontWeight: filter === f ? 600 : 400,
            }}>
            {f}{f === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {shown.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </div>
        )}
        {shown.map(n => {
          const meta = getMeta(n.type);
          const body = n.body || n.message || '';
          const title = n.title || '';
          return (
            <div key={n.id} onClick={() => openNotif(n)}
              style={{
                padding: '14px 18px', borderBottom: '1px solid var(--border)',
                background: n.read ? 'transparent' : 'var(--surface-sunken)',
                cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: meta.bg, color: meta.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {meta.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {title && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {title}
                  </div>
                )}
                <div style={{ fontSize: 14, fontWeight: n.read ? 400 : 600, color: 'var(--text)', lineHeight: 1.45 }}>
                  {body || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {n.fromName && `From ${n.fromName} · `}{timeAgo(n.createdAt)}
                </div>
              </div>
              {!n.read && (
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--red-ink)', flexShrink: 0, marginTop: 6 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
