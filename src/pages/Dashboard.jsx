import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStudents } from '../firebase/services';
import { getTasks } from '../firebase/services';
import { getFollowUps } from '../firebase/services';
import { getAllFollowUps } from '../firebase/services';
import { getBatches } from '../firebase/services';
import { Loading, Avatar, StatusBadge } from '../components/ui';
import { TrendingUp, Users, AlertTriangle, School, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getStudents(),
      getTasks(),
      getAllFollowUps(),
      getBatches(),
    ]).then(([s, t, f, b]) => {
      setStudents(s);
      setTasks(t);
      setFollowups(f);
      setBatches(b);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;

  const active   = students.filter(s => s.status === 'active').length;
  const atRisk   = students.filter(s => s.status === 'at-risk').length;
  const moderate = students.filter(s => s.status === 'moderate').length;
  const dropped  = students.filter(s => s.status === 'dropped').length;
  const total    = students.length;

  const pendingTasks   = tasks.filter(t => t.status === 'pending').length;
  const recentFollowups = followups.slice(0, 5);
  const activeBatches  = batches.filter(b => b.status === 'active');

  const statsCards = [
    { label: 'Total Students', value: total, sub: `+${students.filter(s => {
        if (!s.createdAt) return false;
        const d = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length} this month`, color: '#E53935', bg: '#FEE2E2', icon: Users },
    { label: 'Active Students', value: active, sub: `${total ? Math.round(active/total*100) : 0}% active rate`, color: '#10B981', bg: '#D1FAE5', icon: TrendingUp },
    { label: 'At Risk', value: atRisk, sub: 'Needs attention', color: '#F59E0B', bg: '#FEF3C7', icon: AlertTriangle },
    { label: 'Active Batches', value: activeBatches.length, sub: `${batches.filter(b => b.status === 'upcoming').length} starting soon`, color: '#3B82F6', bg: '#DBEAFE', icon: School },
  ];

  return (
    <div>
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {statsCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-label">{card.label}</div>
                  <div className="stat-value" style={{ color: card.color }}>{card.value}</div>
                  <div className="stat-sub" style={{ color: card.color }}>{card.sub}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Activity breakdown */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Student Activity Overview</h3>
          </div>
          {[
            { label: 'Active',   count: active,   color: '#10B981', total },
            { label: 'Moderate', count: moderate,  color: '#F59E0B', total },
            { label: 'At Risk',  count: atRisk,    color: '#EF4444', total },
            { label: 'Dropped',  count: dropped,   color: '#9CA3AF', total },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, width: 72 }}>{row.label}</span>
              <div className="progress-bar" style={{ flex: 1 }}>
                <div className="progress-fill" style={{
                  width: `${row.total ? Math.round(row.count / row.total * 100) : 0}%`,
                  background: row.color
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, width: 28, textAlign: 'right' }}>{row.count}</span>
            </div>
          ))}
        </div>

        {/* Recent follow-ups */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Recent Follow-Ups</h3>
            <Link to="/followups" style={{ fontSize: 12, color: '#E53935', display: 'flex', alignItems: 'center', gap: 2 }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {recentFollowups.length === 0 && (
            <p style={{ color: '#6B7280', fontSize: 13 }}>No follow-ups recorded yet.</p>
          )}
          {recentFollowups.map(fu => (
            <div key={fu.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <Avatar name={fu.studentName || '?'} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{fu.studentName}</div>
                <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fu.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        {/* Pending tasks */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Today's Staff Tasks</h3>
            <Link to="/tasks" style={{ fontSize: 12, color: '#E53935', display: 'flex', alignItems: 'center', gap: 2 }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {tasks.slice(0, 4).map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                background: task.status === 'completed' ? '#10B981' : '#E5E7EB',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {task.status === 'completed' && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, textDecoration: task.status === 'completed' ? 'line-through' : 'none', color: task.status === 'completed' ? '#9CA3AF' : 'inherit' }}>{task.title}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Assigned: {task.assignedTo}</div>
              </div>
              <span className={`badge ${task.status === 'completed' ? 'badge-green' : task.status === 'in-progress' ? 'badge-amber' : 'badge-gray'}`}>
                {task.status === 'in-progress' ? 'In Progress' : task.status === 'completed' ? 'Done' : 'Pending'}
              </span>
            </div>
          ))}
          {tasks.length === 0 && <p style={{ color: '#6B7280', fontSize: 13 }}>No tasks assigned yet.</p>}
        </div>

        {/* Batches */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Active Batches</h3>
            <Link to="/batches" style={{ fontSize: 12, color: '#E53935', display: 'flex', alignItems: 'center', gap: 2 }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {batches.slice(0, 4).map(batch => {
            const start = batch.startDate ? new Date(batch.startDate) : null;
            const end   = batch.endDate   ? new Date(batch.endDate)   : null;
            const now   = new Date();
            let pct = 0;
            if (start && end) {
              pct = Math.min(100, Math.max(0, Math.round((now - start) / (end - start) * 100)));
            }
            return (
              <div key={batch.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{batch.name}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{batch.studentCount || 0} students · {batch.mentor}</div>
                  </div>
                  <span className={`badge ${batch.status === 'active' ? 'badge-green' : batch.status === 'upcoming' ? 'badge-blue' : 'badge-gray'}`}>
                    {batch.status}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: '#E53935' }} />
                </div>
              </div>
            );
          })}
          {batches.length === 0 && <p style={{ color: '#6B7280', fontSize: 13 }}>No batches created yet.</p>}
        </div>
      </div>
    </div>
  );
}
