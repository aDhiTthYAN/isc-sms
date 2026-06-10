import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotifBell from '../ui/NotifBell';
import { Search } from 'lucide-react';
import { useState } from 'react';

const PAGE_META = {
  '/':            ['Dashboard',          "Welcome back — here's today at a glance"],
  '/students':    ['All Students',       'Track and manage enrolled students'],
  '/followups':   ['Follow-Up Tracker',  'Stay on top of student follow-ups'],
  '/concerns':    ['Student Concerns',   'Review and resolve flagged issues'],
  '/assessments': ['Assessments',        'Manage exams and evaluation records'],
  '/batches':     ['Batch Management',   'Organize courses, cohorts and schedules'],
  '/leaderboard': ['Leaderboard',        'Student performance and rankings'],
  '/tasks':       ['Staff Tasks',        "Assign and track your team's work"],
  '/reports':     ['Daily Reports',      'EOD reports from your staff'],
  '/leads':       ['Lead Pipeline',      'Track prospective student leads'],
  '/documents':   ['Documents',          'Shared files and resources'],
  '/staff':       ['Staff Management',   'Manage team roles and access'],
  '/requests':    ['Staff Requests',     'Pending approval requests'],
  '/trash':       ['Trash',              'Deleted items — restore or permanently remove'],
  '/bulk-import': ['Bulk Import',        'Import student data via CSV'],
};

export default function Topbar() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const [searchVal, setSearchVal] = useState('');

  const key = pathname.startsWith('/students/') ? '/students' : pathname;
  const [title, sub] = PAGE_META[key] || ['ISC SMS', ''];

  const initials = (profile?.name || 'U').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '0 28px',
      height: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, gap: 16,
    }}>
      <div>
        <h1 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, fontFamily: 'var(--font-display)' }}>{title}</h1>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="search-bar" style={{ width: 260 }}>
          <Search size={15} color="var(--text-muted)" />
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="Search students, tasks…"
          />
        </div>

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
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{profile?.name || 'User'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{profile?.role || 'staff'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
