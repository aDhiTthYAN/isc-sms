import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getBatches, getBatchStudentCount, getTasks, getAllFollowUps,
  getStudentCount, getBatchTasks, getRequests, addNotification, updateRequest, markNotificationRead,
  getBatchSchedules, getAssessments,
} from '../firebase/services';
import { query, collection, where, limit, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Loading, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  Users, AlertTriangle, School, CheckSquare, TrendingUp,
  Calendar, ChevronRight, Clock, Activity, ArrowRight, Inbox, X, Bell,
  BookOpen, ClipboardCheck
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
  const { profile } = useAuth();
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

  const [schedBatch, setSchedBatch]   = useState('');
  const [schedItems, setSchedItems]   = useState([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const [schedFilter, setSchedFilter] = useState('all'); // 'all' | 'schedule' | 'assessment' | 'task'

  // Sidebar state
  const [showSidebar, setShowSidebar]   = useState(false);
  const [sidebarTab, setSidebarTab]     = useState('requests');
  const [pendingRequests, setPendingRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [processingReq, setProcessingReq] = useState(null);

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

        // Batches — staff see only their assigned ones
        const allBatches = await getBatches();
        const uid = profile?.uid;
        const isStaff = profile?.role !== 'ceo' && profile?.role !== 'admin';
        const batchList = isStaff
          ? allBatches.filter(b => b.mentorId === uid || (b.staffIds || []).includes(uid))
          : allBatches;
        setBatches(batchList);
        // Auto-select first batch for staff
        if (isStaff && batchList.length > 0) setSchedBatch(batchList[0].id);

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

        // CEO: load pending requests and notifications
        const [reqs, notifs] = await Promise.all([
          getRequests('pending').catch(() => []),
          profile?.email ? (async () => {
            const q = query(collection(db,'notifications'), where('toEmail','==',profile.email), limit(20));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }))
              .sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
          })() : Promise.resolve([]),
        ]);
        setPendingRequests(reqs);
        setNotifications(notifs);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile?.email]);

  const handleAcceptRequest = async (req) => {
    setProcessingReq(req.id);
    try {
      await updateRequest(req.id, { status: 'accepted' });
      // notify requesting staff
      if (req.requestedByEmail) {
        await addNotification({
          toEmail: req.requestedByEmail,
          message: `Your request "${req.title || req.type}" has been approved by CEO.`,
          type: 'request_accepted',
          requestId: req.id,
        });
      }
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e) { console.error(e); }
    setProcessingReq(null);
  };

  const handleRejectRequest = async (req) => {
    setProcessingReq(req.id);
    try {
      await updateRequest(req.id, { status: 'rejected' });
      if (req.requestedByEmail) {
        await addNotification({
          toEmail: req.requestedByEmail,
          message: `Your request "${req.title || req.type}" has been declined by CEO.`,
          type: 'request_rejected',
          requestId: req.id,
        });
      }
      setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e) { console.error(e); }
    setProcessingReq(null);
  };

  const loadBatchActivity = async (batchId) => {
    if (!batchId) return setSchedItems([]);
    setSchedLoading(true);
    try {
      const [scheds, asmts, bTasks] = await Promise.all([
        getBatchSchedules(batchId).catch(() => []),
        getAssessments(batchId).catch(() => []),
        getBatchTasks(batchId).catch(() => []),
      ]);
      const items = [
        ...scheds.map(s => ({ ...s, _kind: 'schedule', _label: s.title || 'Class', _sub: s.recurring ? `Every ${s.day} at ${s.time}` : `${s.scheduledDate} at ${s.time}`, _nav: '/batches' })),
        ...asmts.map(a => ({ ...a, _kind: 'assessment', _label: a.title || 'Assessment', _sub: `${a.date || '—'} · ${a.totalMarks} marks`, _nav: '/assessments' })),
        ...bTasks.map(t => ({ ...t, _kind: 'task', _label: t.title || 'Task', _sub: t.assignedTo || '', _nav: '/tasks' })),
      ];
      setSchedItems(items);
    } catch {}
    setSchedLoading(false);
  };

  useEffect(() => { loadBatchActivity(schedBatch); }, [schedBatch]);

  const handleMarkNotifRead = async (notif) => {
    if (notif.read) return;
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    await markNotificationRead(notif.id).catch(() => {});
  };

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

  const unreadNotifs = notifications.filter(n => !n.read).length;

  return (
    <div>
      {/* Header with Sidebar Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => { setSidebarTab('notif'); setShowSidebar(true); }}
          style={{ position: 'relative', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}
        >
          <Bell size={16} />
          Notifications
          {unreadNotifs > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -5, background: '#E53935', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadNotifs}</span>
          )}
        </button>
        <button
          onClick={() => { setSidebarTab('requests'); setShowSidebar(true); }}
          style={{ position: 'relative', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '7px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#374151' }}
        >
          <Inbox size={16} />
          Requests
          {pendingRequests.length > 0 && (
            <span style={{ position: 'absolute', top: -5, right: -5, background: '#F59E0B', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingRequests.length}</span>
          )}
        </button>
      </div>

      {/* CEO Sidebar */}
      {showSidebar && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000 }} onClick={() => setShowSidebar(false)}>
          <div
            style={{ position: 'absolute', top: 0, right: 0, width: 380, height: '100%', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.13)', display: 'flex', flexDirection: 'column', zIndex: 9001 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sidebar header */}
            <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSidebarTab('requests')}
                  style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: sidebarTab === 'requests' ? '#0F3460' : '#F3F4F6', color: sidebarTab === 'requests' ? '#fff' : '#374151' }}
                >Requests {pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}</button>
                <button
                  onClick={() => setSidebarTab('notif')}
                  style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: sidebarTab === 'notif' ? '#0F3460' : '#F3F4F6', color: sidebarTab === 'notif' ? '#fff' : '#374151' }}
                >Notifications {unreadNotifs > 0 ? `(${unreadNotifs})` : ''}</button>
              </div>
              <button onClick={() => setShowSidebar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={18} style={{ color: '#6B7280' }} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {sidebarTab === 'requests' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pendingRequests.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#9CA3AF', paddingTop: 40, fontSize: 13 }}>No pending requests</div>
                  )}
                  {pendingRequests.map(req => (
                    <div key={req.id} style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E5E7EB' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>{req.title || req.type || 'Request'}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>From: <b>{req.requestedByName || req.requestedByEmail || '—'}</b></div>
                      {req.assessmentName && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>Assessment: {req.assessmentName}</div>}
                      {req.reason && <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Reason: {req.reason}</div>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          disabled={processingReq === req.id}
                          onClick={() => handleAcceptRequest(req)}
                          style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: 'none', background: '#10B981', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >Accept</button>
                        <button
                          disabled={processingReq === req.id}
                          onClick={() => handleRejectRequest(req)}
                          style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: 'none', background: '#FEE2E2', color: '#991B1B', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >Reject</button>
                        <button
                          onClick={() => { setShowSidebar(false); navigate('/requests'); }}
                          style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >View</button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => { setShowSidebar(false); navigate('/requests'); }}
                    style={{ marginTop: 8, padding: '9px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#0F3460', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                  >View All Requests →</button>
                </div>
              )}

              {sidebarTab === 'notif' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notifications.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#9CA3AF', paddingTop: 40, fontSize: 13 }}>No notifications</div>
                  )}
                  {notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => handleMarkNotifRead(notif)}
                      style={{ padding: '10px 12px', borderRadius: 9, border: `1px solid ${notif.read ? '#F3F4F6' : '#BFDBFE'}`, background: notif.read ? '#F8FAFC' : '#EFF6FF', cursor: 'pointer' }}
                    >
                      <div style={{ fontSize: 13, color: '#1A1A2E', fontWeight: notif.read ? 400 : 600 }}>{notif.message}</div>
                      {notif.createdAt?.seconds && (
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                          {new Date(notif.createdAt.seconds * 1000).toLocaleString()}
                        </div>
                      )}
                      {!notif.read && <div style={{ fontSize: 10, color: '#2563EB', fontWeight: 600, marginTop: 2 }}>● Unread — click to mark read</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards — staff see a simpler 3-card strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {(profile?.role !== 'ceo' && profile?.role !== 'admin'
          ? kpis.filter(k => ['Active Batches','Pending Tasks','Recent Activity'].includes(k.label))
          : kpis
        ).map(k => <KPICard key={k.label} {...k} />)}
      </div>

      {/* Staff: My Batches quick info banner */}
      {profile?.role !== 'ceo' && profile?.role !== 'admin' && batches.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg,#0F3460 0%,#1E40AF 100%)', borderRadius: 14, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Your Assigned Batches</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {batches.map(b => (
                <span
                  key={b.id}
                  onClick={() => { setSchedBatch(b.id); setSchedFilter('all'); }}
                  style={{ padding: '4px 12px', borderRadius: 20, background: schedBatch === b.id ? '#fff' : 'rgba(255,255,255,0.15)', color: schedBatch === b.id ? '#0F3460' : '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  {b.name}
                </span>
              ))}
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Click a batch to view its schedule below ↓</div>
        </div>
      )}

      {/* Batches Overview Table — CEO/Admin only */}
      {(profile?.role === 'ceo' || profile?.role === 'admin') &&
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
      </div>}

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

      {/* Batch Activity Hub */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)', marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>📅 Batch Activity Hub</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={schedBatch}
              onChange={e => setSchedBatch(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 13, background: '#F9FAFB', minWidth: 180 }}
            >
              <option value="">Select a batch…</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {schedBatch && (
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'schedule', label: '🗓 Classes' },
                  { key: 'assessment', label: '📝 Assessments' },
                  { key: 'task', label: '✅ Tasks' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setSchedFilter(f.key)}
                    style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: schedFilter === f.key ? '#0F3460' : '#F3F4F6',
                      color: schedFilter === f.key ? '#fff' : '#374151' }}
                  >{f.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        {!schedBatch && (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '32px 0', fontSize: 13 }}>
            <Calendar size={28} style={{ color: '#D1D5DB', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            Select a batch to view its scheduled classes, assessments, and tasks
          </div>
        )}

        {schedBatch && schedLoading && (
          <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px 0', fontSize: 13 }}>Loading…</div>
        )}

        {schedBatch && !schedLoading && (() => {
          const filtered = schedFilter === 'all' ? schedItems : schedItems.filter(i => i._kind === schedFilter);
          const kindColor = { schedule: { bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6' }, assessment: { bg: '#D1FAE5', color: '#065F46', dot: '#10B981' }, task: { bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' } };
          return (
            <div>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px 0', fontSize: 13 }}>No items found for this filter.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map((item, i) => {
                  const c = kindColor[item._kind] || kindColor.task;
                  return (
                    <div
                      key={item.id || i}
                      onClick={() => navigate(item._nav)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 2 }}>{item._label}</div>
                        {item._sub && <div style={{ fontSize: 12, color: '#6B7280' }}>{item._sub}</div>}
                      </div>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color, fontWeight: 600, flexShrink: 0 }}>
                        {item._kind === 'schedule' ? 'Class' : item._kind === 'assessment' ? 'Assessment' : 'Task'}
                      </span>
                      <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>→</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, fontSize: 12, color: '#6B7280', display: 'flex', gap: 16 }}>
                <span>🗓 {schedItems.filter(i=>i._kind==='schedule').length} classes</span>
                <span>📝 {schedItems.filter(i=>i._kind==='assessment').length} assessments</span>
                <span>✅ {schedItems.filter(i=>i._kind==='task').length} tasks</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
