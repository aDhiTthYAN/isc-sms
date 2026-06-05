import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getMyStudents, getMyTasks, getMyFollowUps, getStaffBatches, updateTask
} from '../firebase/services';
import { Loading, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  Users, CheckSquare, PhoneCall, School,
  ChevronRight, AlertTriangle, Activity
} from 'lucide-react';

const CARD = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #E5E7EB',
  padding: '20px 22px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
};

export default function StaffDashboard() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const [students,        setStudents]        = useState([]);
  const [tasks,           setTasks]           = useState([]);
  const [followups,       setFollowups]       = useState([]);
  const [myBatches,       setMyBatches]       = useState([]);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, f, b] = await Promise.all([
          getMyStudents(profile?.name, profile?.uid).catch(() => []),
          getMyTasks(profile?.email).catch(() => []),
          getMyFollowUps(profile?.email).catch(() => []),
          getStaffBatches(profile?.uid).catch(() => []),
        ]);
        setStudents(s);
        setTasks(t);
        setFollowups(f);
        setMyBatches(b);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (profile?.uid) load();
  }, [profile?.uid]);

  if (loading) return <Loading text="Loading your dashboard..." />;

  const pendingTasks    = tasks.filter(t => t.status !== 'completed');
  const pendingFollowups = followups.filter(f => !f.completed);
  const atRisk          = students.filter(s => s.status === 'at-risk');

  const statCards = [
    { label: 'My Students',     value: students.length,         color: '#0F3460', bg: '#DBEAFE', icon: Users,          link: '/students'  },
    { label: 'Pending Tasks',   value: pendingTasks.length,     color: '#F59E0B', bg: '#FEF3C7', icon: CheckSquare,    link: '/tasks'     },
    { label: 'Open Follow-Ups', value: pendingFollowups.length, color: '#10B981', bg: '#D1FAE5', icon: PhoneCall,      link: '/followups' },
    { label: 'At-Risk Students',value: atRisk.length,           color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle,  link: '/students'  },
  ];

  const sHead = (title, to, label = 'View all') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>{title}</h3>
      {to && (
        <Link to={to} style={{ fontSize: 12, color: '#E53935', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
          {label} <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>
          Welcome back, {profile?.name?.split(' ')[0]}
        </h2>
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              style={{ ...CARD, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onClick={() => navigate(card.link)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = CARD.boxShadow}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{card.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</div>
                </div>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* My Batches */}
        <div style={CARD}>
          {sHead('My Batches', '/batches', 'Manage all')}
          {myBatches.length === 0 && (
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>No batches assigned yet.</p>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Batch', 'Course', 'Status'].map(h => (
                    <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #F3F4F6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myBatches.map((batch, idx) => (
                  <tr
                    key={batch.id}
                    style={{ cursor: 'pointer', transition: 'background 0.12s', background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F0F4FF'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC'}
                    onClick={() => navigate('/batches')}
                  >
                    <td style={{ padding: '9px 8px', fontWeight: 600 }}>{batch.name}</td>
                    <td style={{ padding: '9px 8px', color: '#6B7280' }}>{batch.course || '—'}</td>
                    <td style={{ padding: '9px 8px' }}>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                        background: batch.status === 'active' ? '#D1FAE5' : batch.status === 'upcoming' ? '#DBEAFE' : '#F3F4F6',
                        color: batch.status === 'active' ? '#065F46' : batch.status === 'upcoming' ? '#1E40AF' : '#374151',
                      }}>{batch.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* My Upcoming Tasks */}
        <div style={CARD}>
          {sHead('My Upcoming Tasks', '/tasks', 'View all')}
          {pendingTasks.length === 0 && (
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>All tasks completed! Great work.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingTasks.slice(0, 5).map(task => (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                background: '#FAFBFC', borderRadius: 8, border: '1px solid #F3F4F6',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                  background: task.status === 'in-progress' ? '#F59E0B' : '#E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                    {task.dueDate && `Due: ${task.dueDate}`}
                    {task.priority === 'high' && <span style={{ color: '#EF4444', marginLeft: 6, fontWeight: 600 }}>● High</span>}
                  </div>
                </div>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', border: 'none', flexShrink: 0 }}
                  onClick={async () => {
                    await updateTask(task.id, { status: 'completed', completedAt: new Date().toISOString() });
                    setTasks(prev => prev.filter(t => t.id !== task.id));
                  }}
                >
                  Done
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* At-Risk Students in My Batches */}
        <div style={CARD}>
          {sHead('At-Risk Students', '/students', 'View all')}
          {atRisk.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              No at-risk students in your batches.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {atRisk.slice(0, 5).map(s => (
                <div
                  key={s.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FFF8F8'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => navigate(`/students/${s.id}`)}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#E53935', flexShrink: 0 }}>
                    {(s.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.batchName || '—'}</div>
                  </div>
                  <ChevronRight size={13} style={{ color: '#D1D5DB', flexShrink: 0 }} />
                </div>
              ))}
              {atRisk.length > 5 && (
                <Link to="/students" style={{ fontSize: 12, color: '#E53935', textAlign: 'center', padding: '6px 0', fontWeight: 500 }}>
                  +{atRisk.length - 5} more →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Open Follow-Ups */}
        <div style={CARD}>
          {sHead('Open Follow-Ups', '/followups', 'View all')}
          {pendingFollowups.length === 0 && (
            <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>No open follow-ups.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendingFollowups.slice(0, 5).map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px', borderRadius: 8, transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#10B981', flexShrink: 0 }}>
                  <Activity size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{f.studentName}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{f.note}</div>
                </div>
                {f.priority === 'high' && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#FEE2E2', color: '#991B1B', fontWeight: 600, flexShrink: 0 }}>Urgent</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
