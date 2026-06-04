import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getBatches, getBatchStudentCount, getTasks, getAllFollowUps,
  getStudentCount, getBatchTasks
} from '../firebase/services';
import { query, collection, where, limit, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Loading, StatusBadge } from '../components/ui';
import {
  Users, AlertTriangle, School, CheckSquare, TrendingUp,
  Calendar, ChevronRight, Clock, Activity, ArrowRight
} from 'lucide-react';

const KPI_STYLE = {
  card: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #E5E7EB',
    padding: '20px 22px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  }
};

function KPICard({ label, value, sub, color, bg, icon: Icon, link }) {
  const navigate = useNavigate();
  return (
    <div
      style={{ ...KPI_STYLE.card, cursor: link ? 'pointer' : 'default' }}
      onClick={() => link && navigate(link)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1, marginBottom: 6 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{sub}</div>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={22} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading]           = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [atRiskCount, setAtRiskCount]   = useState(0);
  const [batches, setBatches]           = useState([]);
  const [batchRows, setBatchRows]       = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [atRiskStudents, setAtRiskStudents] = useState([]);
  const [actPage, setActPage]           = useState(0);
  const ACT_PAGE = 10;

  useEffect(() => {
    const load = async () => {
      try {
        // KPI: total students count (server-side, no full scan)
        const totalSnap = await getCountFromServer(collection(db, 'students'));
        const total = totalSnap.data().count;
        setTotalStudents(total);

        // At-risk count
        const arSnap = await getCountFromServer(query(collection(db, 'students'), where('status', '==', 'at-risk')));
        setAtRiskCount(arSnap.data().count);

        // At-risk students preview (first 10 for table)
        const arStudentsSnap = await getDocs(query(collection(db, 'students'), where('status', '==', 'at-risk'), limit(10)));
        setAtRiskStudents(arStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Batches
        const batchList = await getBatches();
        setBatches(batchList);

        // Pending tasks (limit 50)
        const tasks = await getTasks().catch(() => []);
        setPendingTasks(tasks.filter(t => t.status !== 'completed'));

        // Recent activity (follow-ups, limit 50 then sort)
        const fups = await getAllFollowUps().catch(() => []);
        const combined = [
          ...fups.map(f => ({ ...f, _type: 'followup', _ts: f.createdAt?.seconds || 0 })),
          ...tasks.map(t => ({ ...t, _type: 'task', _ts: t.createdAt?.seconds || 0 })),
        ].sort((a, b) => b._ts - a._ts);
        setRecentActivity(combined);

        // Batch rows with stats
        const rows = await Promise.all(batchList.map(async (batch) => {
          const count = await getBatchStudentCount(batch.id).catch(() => 0);

          // onboarding %: count students with any courseFlow data vs total
          let onboardedCount = 0;
          try {
            const batchStudentsSnap = await getDocs(query(collection(db, 'students'), where('batchId', '==', batch.id), limit(200)));
            const students = batchStudentsSnap.docs.map(d => d.data());
            const flow = batch.courseFlow || [];
            if (flow.length > 0) {
              onboardedCount = students.filter(s =>
                flow.every(step => s.courseFlow?.[step.key]?.done)
              ).length;
            }
          } catch {}

          return { batch, count, onboardedCount };
        }));
        setBatchRows(rows);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;

  const activeBatches = batches.filter(b => b.status === 'active');
  const totalPages = Math.ceil(recentActivity.length / ACT_PAGE);
  const pageActivity = recentActivity.slice(actPage * ACT_PAGE, (actPage + 1) * ACT_PAGE);

  const kpis = [
    { label: 'Total Students',     value: totalStudents,      sub: 'All enrolled',          color: '#E53935', bg: '#FEE2E2', icon: Users,          link: '/students' },
    { label: 'Active Batches',     value: activeBatches.length, sub: `${batches.filter(b=>b.status==='upcoming').length} upcoming`, color: '#0F3460', bg: '#DBEAFE', icon: School, link: '/batches' },
    { label: 'At-Risk Students',   value: atRiskCount,        sub: 'Needs attention',       color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle,  link: '/students' },
    { label: 'Pending Tasks',      value: pendingTasks.length, sub: 'Open tasks',           color: '#F59E0B', bg: '#FEF3C7', icon: CheckSquare,    link: '/tasks'    },
    { label: 'Total Batches',      value: batches.length,     sub: 'Across all programs',   color: '#10B981', bg: '#D1FAE5', icon: TrendingUp,     link: '/batches'  },
    { label: 'Recent Activity',    value: recentActivity.length, sub: 'Follow-ups + tasks',color: '#8B5CF6', bg: '#EDE9FE', icon: Activity,       link: null        },
  ];

  const sectionHead = (title, linkTo, linkLabel = 'View all') => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>{title}</h3>
      {linkTo && (
        <Link to={linkTo} style={{ fontSize: 12, color: '#E53935', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
          {linkLabel} <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map(k => <KPICard key={k.label} {...k} />)}
      </div>

      {/* Batches Overview Table */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)', marginBottom: 20 }}>
        {sectionHead('Batches Overview', '/batches', 'Manage Batches')}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Batch Name', 'Total Students', 'Onboarding %', 'Status', 'Course', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batchRows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>No batches yet.</td></tr>
              )}
              {batchRows.map(({ batch, count, onboardedCount }, idx) => {
                const flow = batch.courseFlow || [];
                const onboardPct = count > 0 && flow.length > 0 ? Math.round(onboardedCount / count * 100) : 0;
                return (
                  <tr
                    key={batch.id}
                    style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC', cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F0F4FF'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC'}
                    onClick={() => navigate('/batches')}
                  >
                    <td style={{ padding: '11px 12px', fontWeight: 600, color: '#1A1A2E' }}>{batch.name}</td>
                    <td style={{ padding: '11px 12px' }}><span style={{ fontWeight: 700, fontSize: 15, color: '#0F3460' }}>{count}</span></td>
                    <td style={{ padding: '11px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ height: '100%', width: `${onboardPct}%`, background: onboardPct === 100 ? '#10B981' : onboardPct > 60 ? '#F59E0B' : '#E53935', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: onboardPct === 100 ? '#10B981' : '#374151', minWidth: 34 }}>{onboardPct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                        background: batch.status === 'active' ? '#D1FAE5' : batch.status === 'upcoming' ? '#DBEAFE' : '#F3F4F6',
                        color: batch.status === 'active' ? '#065F46' : batch.status === 'upcoming' ? '#1E40AF' : '#374151',
                      }}>{batch.status}</span>
                    </td>
                    <td style={{ padding: '11px 12px', color: '#6B7280' }}>{batch.course || '—'}</td>
                    <td style={{ padding: '11px 12px' }}>
                      <span style={{ color: '#E53935', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
                        Open <ArrowRight size={12} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Recent Activity Feed */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)' }}>
          {sectionHead('Recent Activity', null)}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 280 }}>
            {pageActivity.length === 0 && (
              <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No activity yet.</div>
            )}
            {pageActivity.map((item, i) => {
              const isFollowup = item._type === 'followup';
              const ts = item.createdAt?.seconds
                ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
                : '';
              return (
                <div key={item.id || i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 10px',
                  borderRadius: 8, transition: 'background 0.12s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isFollowup ? '#D1FAE5' : '#FEF3C7',
                  }}>
                    {isFollowup ? <Activity size={13} style={{ color: '#10B981' }} /> : <CheckSquare size={13} style={{ color: '#F59E0B' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isFollowup ? (item.studentName || 'Unknown student') : (item.title || 'Task')}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                      {isFollowup ? item.note : `Assigned: ${item.assignedTo || '—'}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>{ts}</div>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
              <button className="btn btn-ghost btn-sm" disabled={actPage === 0} onClick={() => setActPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 12, color: '#6B7280', alignSelf: 'center' }}>Page {actPage + 1} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={actPage === totalPages - 1} onClick={() => setActPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {/* At-Risk Students */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)' }}>
          {sectionHead('At-Risk Students', '/students', 'View all')}
          {atRiskStudents.length === 0 && (
            <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
              <AlertTriangle size={28} style={{ color: '#D1D5DB', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              No at-risk students
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {atRiskStudents.map(s => (
              <div
                key={s.id}
                onClick={() => navigate(`/students/${s.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                  borderRadius: 8, cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#FFF8F8'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#E53935', flexShrink: 0,
                }}>
                  {(s.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.batchName || '—'}</div>
                </div>
                <button
                  className="btn btn-sm"
                  style={{ fontSize: 11, background: '#FEE2E2', color: '#991B1B', border: 'none', padding: '4px 10px' }}
                  onClick={e => { e.stopPropagation(); navigate(`/students/${s.id}`); }}
                >
                  Review
                </button>
              </div>
            ))}
          </div>
          {atRiskCount > 10 && (
            <Link to="/students" style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 12, color: '#E53935', fontWeight: 500 }}>
              +{atRiskCount - 10} more at-risk students →
            </Link>
          )}
        </div>
      </div>

      {/* Pending Tasks Quick View */}
      {pendingTasks.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)' }}>
          {sectionHead('Pending Staff Tasks', '/tasks', 'View all tasks')}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Task', 'Assigned To', 'Priority', 'Status'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingTasks.slice(0, 8).map((task, idx) => (
                  <tr key={task.id} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{task.title}</td>
                    <td style={{ padding: '10px 12px', color: '#6B7280' }}>{task.assignedTo || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                        background: task.priority === 'high' ? '#FEE2E2' : task.priority === 'medium' ? '#FEF3C7' : '#F3F4F6',
                        color: task.priority === 'high' ? '#991B1B' : task.priority === 'medium' ? '#92400E' : '#374151',
                      }}>{task.priority || 'normal'}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={task.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
