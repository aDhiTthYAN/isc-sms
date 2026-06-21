import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotifBell from '../ui/NotifBell';
import { Search } from 'lucide-react';
import { useState } from 'react';

const BREADCRUMBS = {
  '/':            ['Overview', 'Dashboard'],
  '/students':    ['Overview', 'All Students'],
  '/followups':   ['Overview', 'Follow-Ups'],
  '/concerns':    ['Academic', 'Concerns'],
  '/assessments': ['Academic', 'Assessments'],
  '/batches':     ['Academic', 'Batches'],
  '/leaderboard': ['Academic', 'Leaderboard'],
  '/tasks':       ['Operations', 'Staff Tasks'],
  '/reports':     ['Operations', 'Daily Reports'],
  '/leads':       ['Operations', 'Lead Pipeline'],
  '/documents':   ['Operations', 'Documents'],
  '/staff':       ['Management', 'Staff Management'],
  '/requests':    ['Management', 'Staff Requests'],
  '/trash':       ['Management', 'Trash'],
  '/bulk-import': ['Operations', 'Bulk Import'],
};

export default function Topbar() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const [searchVal, setSearchVal] = useState('');

  const key = pathname.startsWith('/students/') ? '/students' : pathname;
  const [section, page] = BREADCRUMBS[key] || ['ISC', 'Dashboard'];

  const initials = (profile?.name || 'U').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: 60,
      display: 'flex', alignItems: 'center', gap: 16,
      flexShrink: 0,
    }}>
      {/* Left: Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, whiteSpace: 'nowrap', minWidth: 160 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{section}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 6px' }}>›</span>
        <span style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 600 }}>{page}</span>
      </div>

      {/* Center: Search (flex: 1 to center it) */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <div className="search-bar" style={{
          width: 270,
          borderRadius: 20,
          border: '1px solid var(--border)',
          background: 'var(--canvas)',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 14px', height: 36,
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="Search students, tasks…"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: 'var(--text)', flex: 1, fontFamily: 'var(--font-body)' }}
          />
        </div>
      </div>

      {/* Right: Bell + divider + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <NotifBell />
        <div style={{ width: 1, height: 26, background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'var(--grad-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: '#fff',
          }}>{initials}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>{profile?.name || 'User'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{profile?.role || 'staff'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
