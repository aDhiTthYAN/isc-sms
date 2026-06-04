import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, PhoneCall, AlertCircle,
  ClipboardList, School, CheckSquare, FileText,
  TrendingUp, FolderOpen, LogOut, ShieldCheck,
  Trophy, Upload, UsersRound
} from 'lucide-react';

const ICONS = {
  LayoutDashboard, Users, PhoneCall, AlertCircle,
  ClipboardList, School, CheckSquare, FileText,
  TrendingUp, FolderOpen, Trophy, Upload, UsersRound
};

export default function Sidebar({ navItems = [], sidebarColor = '#1A1A2E', roleLabel = 'Staff' }) {
  const { logout, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside style={{
      width: 220, background: sidebarColor,
      display: 'flex', flexDirection: 'column',
      height: '100vh', flexShrink: 0,
      overflowY: 'auto', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.svg" alt="ISC" style={{ width:38, height:38, borderRadius:10, flexShrink:0 }} />
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:'#fff', lineHeight:1.2 }}>Int'l Skills Club</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>Management System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '10px 0', flex: 1 }}>
        {navItems.map((item, i) => {
          if (item.section) {
            return (
              <div key={i} style={{
                padding: '10px 16px 3px',
                color: 'rgba(255,255,255,0.28)',
                fontSize: 9.5, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                marginTop: i === 0 ? 0 : 4,
              }}>{item.section}</div>
            );
          }
          const Icon = ICONS[item.icon] || LayoutDashboard;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 16px', fontSize: 13,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                borderLeft: isActive ? '3px solid #E53935' : '3px solid transparent',
                background: isActive ? 'rgba(229,57,53,0.15)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.15s',
              })}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, background: '#E53935',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600,
          }}>
            {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.name || 'User'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
              <ShieldCheck size={10} /> {roleLabel}
            </div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          width: '100%', padding: '7px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.06)', border: 'none',
          color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          <LogOut size={13} /> Sign Out
        </button>
      </div>
    </aside>
  );
}