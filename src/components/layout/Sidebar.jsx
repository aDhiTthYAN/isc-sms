import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, PhoneCall, AlertCircle,
  ClipboardList, School, CheckSquare, FileText,
  TrendingUp, FolderOpen, LogOut, ShieldCheck,
  Trophy, Upload, UsersRound, Inbox, Trash2,
} from 'lucide-react';

const ICONS = {
  LayoutDashboard, Users, PhoneCall, AlertCircle,
  ClipboardList, School, CheckSquare, FileText,
  TrendingUp, FolderOpen, Trophy, Upload, UsersRound, Inbox, Trash2,
};

// Tint color per nav item icon (matches design system)
const TINTS = {
  '/':            'var(--brand)',
  '/students':    'var(--blue)',
  '/followups':   'var(--teal)',
  '/concerns':    'var(--orange)',
  '/assessments': 'var(--violet)',
  '/batches':     'var(--indigo)',
  '/leaderboard': 'var(--amber)',
  '/tasks':       'var(--green)',
  '/reports':     'var(--pink)',
  '/leads':       'var(--teal)',
  '/documents':   'var(--slate)',
  '/staff':       'var(--slate)',
  '/requests':    'var(--blue)',
  '/trash':       'var(--red)',
  '/bulk-import': 'var(--green)',
};

export default function Sidebar({ navItems = [] }) {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (profile?.name || 'U').split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase();

  return (
    <aside style={{
      width: 248,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      height: '100vh', flexShrink: 0,
      overflowY: 'auto', position: 'sticky', top: 0,
      boxShadow: '1px 0 0 var(--border)',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 18px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'var(--grad-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: '#fff',
            letterSpacing: '-0.01em',
          }}>ISC</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', lineHeight: 1.2, fontFamily: 'var(--font-display)' }}>Int'l Skills Club</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Management System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 10px', flex: 1 }}>
        {navItems.map((item, i) => {
          if (item.section) {
            return (
              <div key={i} style={{
                padding: '12px 10px 4px',
                color: 'var(--text-muted)',
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                marginTop: i === 0 ? 0 : 4,
              }}>{item.section}</div>
            );
          }
          const Icon = ICONS[item.icon] || LayoutDashboard;
          const tint = TINTS[item.to] || 'var(--brand)';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', fontSize: 13.5,
                color: isActive ? 'var(--brand-ink)' : 'var(--text-sub)',
                background: isActive ? 'var(--brand-50)' : 'transparent',
                borderRadius: 10,
                textDecoration: 'none',
                transition: 'all 0.15s',
                marginBottom: 2,
                fontWeight: isActive ? 600 : 500,
              })}
              onMouseEnter={e => { if (!e.currentTarget.dataset.active) e.currentTarget.style.background = 'var(--n-100)'; }}
              onMouseLeave={e => { if (!e.currentTarget.dataset.active) e.currentTarget.style.background = 'transparent'; }}
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? 'var(--brand)' : tint, display: 'flex', flexShrink: 0 }}>
                    <Icon size={17} />
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, background: 'var(--surface-sunken)' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'var(--grad-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, color: '#fff',
          }}>{initials}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.name || 'User'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{profile?.role || 'staff'}</div>
          </div>
          <button onClick={handleLogout} title="Sign out" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
