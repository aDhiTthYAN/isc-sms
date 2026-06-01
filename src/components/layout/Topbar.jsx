import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotifBell from '../ui/NotifBell';

const titles = {
  '/':            'Dashboard',
  '/students':    'All Students',
  '/bulk-import': 'Bulk Import',
  '/followups':   'Follow-Up Tracker',
  '/concerns':    'Student Concerns',
  '/assessments': 'Assessments',
  '/batches':     'Batch Management',
  '/leaderboard': 'Student Leaderboard',
  '/tasks':       'Staff Tasks',
  '/reports':     'Daily Reports',
  '/leads':       'Lead Pipeline',
  '/documents':   'Document Repository',
  '/staff':       'Staff Management',
};

const ROLE_COLORS = { ceo: '#E53935', admin: '#8B5CF6', staff: '#3B82F6' };

export default function Topbar() {
  const { pathname } = useLocation();
  const { profile }  = useAuth();

  const title = pathname.startsWith('/students/') ? 'Student Profile' : (titles[pathname] || 'ISC SMS');
  const role  = profile?.role || 'staff';

  return (
    <header style={{
      background: 'var(--white)', borderBottom: '1px solid var(--border)',
      padding: '0 24px', height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <h1 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Notification Bell */}
        <NotifBell />
        {/* User info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: ROLE_COLORS[role] || '#E53935',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 600,
          }}>
            {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{profile?.name || 'User'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>
              {role}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
