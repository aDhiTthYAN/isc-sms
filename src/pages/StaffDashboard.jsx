import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getMyStudents, getMyTasks, getMyFollowUps, getStaffBatches, updateTask,
  getMyNotifications, markNotificationRead, getMyRequests, updateRequest, addNotification, createRequest,
  getBatchSchedules, getBatchTasks, getAssessments,
} from '../firebase/services';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Loading } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  Users, CheckSquare, PhoneCall, School,
  ChevronRight, AlertTriangle, Activity, Bell, Inbox, X
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
  const [notifications,   setNotifications]   = useState([]);
  const [myRequests,      setMyRequests]      = useState([]);
  const [showSidebar,     setShowSidebar]     = useState(false);
  const [sidebarTab,      setSidebarTab]      = useState('notif'); // 'notif' | 'requests'
  const [reminding,       setReminding]       = useState({});

  // Batch Activity Hub
  const [hubBatch,      setHubBatch]      = useState('');
  const [hubItems,      setHubItems]      = useState([]);
  const [hubLoading,    setHubLoading]    = useState(false);
  const [hubFilter,     setHubFilter]     = useState('all');
  const [hubSearch,     setHubSearch]     = useState('');
  const [hubTypeFilter, setHubTypeFilter] = useState('');
  const [hubCourse,     setHubCourse]     = useState('');
  const [hubTimeFilter, setHubTimeFilter] = useState('active'); // 'active'|'upcoming'|'past'|'all'
  const HUB_PAGE = 20;
  const [hubPage, setHubPage] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, f, b, n, r] = await Promise.all([
          getMyStudents(profile?.name, profile?.uid).catch(() => []),
          getMyTasks(profile?.email).catch(() => []),
          getMyFollowUps(profile?.email).catch(() => []),
          getStaffBatches(profile?.uid).catch(() => []),
          getMyNotifications(profile?.email).catch(() => []),
          getMyRequests(profile?.uid).catch(() => []),
        ]);
        setStudents(s);
        setTasks(t);
        setFollowups(f);
        setMyBatches(b);
        setNotifications(n);
        setMyRequests(r);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (profile?.uid) load();
  }, [profile?.uid]);

  // ── Due-today & 1-hour-before reminders ──────────────────────────────────
  useEffect(() => {
    if (!myBatches.length || !profile?.email) return;

    const parseMinutes = (timeStr) => {
      if (!timeStr) return null;
      // handles "10:30 AM", "14:30", "2:30 PM"
      const clean = timeStr.trim();
      const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return null;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const meridiem = (match[3] || '').toUpperCase();
      if (meridiem === 'PM' && h !== 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    const runChecks = async () => {
      const now      = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const dayName  = DAYS[now.getDay()];
      const nowMins  = now.getHours() * 60 + now.getMinutes();

      for (const batch of myBatches) {
        const [scheds, asmts, bTasks] = await Promise.all([
          getBatchSchedules(batch.id).catch(() => []),
          getAssessments(batch.id).catch(() => []),
          getBatchTasks(batch.id).catch(() => []),
        ]);

        // 1-hour-before schedule reminder
        for (const s of scheds) {
          const key = `rem_sched_${s.id}_${todayStr}`;
          if (localStorage.getItem(key)) continue;
          const isToday =
            (s.recurring && s.day === dayName) ||
            (!s.recurring && s.scheduledDate === todayStr);
          if (!isToday) continue;
          const schedMins = parseMinutes(s.time);
          if (schedMins === null) continue;
          const diff = schedMins - nowMins;
          if (diff >= 0 && diff <= 60) {
            await addNotification({
              toEmail: profile.email,
              title: 'Class Starting Soon',
              message: `"${s.title || 'Class'}" starts at ${s.time} in ${batch.name || 'your batch'}`,
              type: 'followup',
              fromName: 'Reminder',
              read: false,
              createdAt: new Date(),
            }).catch(() => {});
            localStorage.setItem(key, '1');
          }
        }

        // Assessment due today
        for (const a of asmts) {
          if (a.status === 'completed') continue;
          if (a.date !== todayStr) continue;
          const key = `rem_asmt_${a.id}_${todayStr}`;
          if (localStorage.getItem(key)) continue;
          await addNotification({
            toEmail: profile.email,
            title: 'Assessment Due Today',
            message: `"${a.title || 'Assessment'}" is due today in ${batch.name || 'your batch'}`,
            type: 'concern',
            fromName: 'Reminder',
            read: false,
            createdAt: new Date(),
          }).catch(() => {});
          localStorage.setItem(key, '1');
        }

        // Task/assignment due today
        for (const t of bTasks) {
          if (t.status === 'completed' || t.status === 'submitted') continue;
          if (t.dueDate !== todayStr) continue;
          const key = `rem_task_${t.id}_${todayStr}`;
          if (localStorage.getItem(key)) continue;
          await addNotification({
            toEmail: profile.email,
            title: 'Assignment Due Today',
            message: `"${t.title || 'Assignment'}" is due today in ${batch.name || 'your batch'}`,
            type: 'task',
            fromName: 'Reminder',
            read: false,
            createdAt: new Date(),
          }).catch(() => {});
          localStorage.setItem(key, '1');
        }
      }
    };

    runChecks();
    const interval = setInterval(runChecks, 5 * 60 * 1000); // recheck every 5 min
    return () => clearInterval(interval);
  }, [myBatches, profile?.email]);

  // Auto-select first batch when myBatches loads
  useEffect(() => {
    if (myBatches.length > 0 && !hubBatch) setHubBatch(myBatches[0].id);
  }, [myBatches]);

  // Load hub items whenever selected batch changes
  useEffect(() => {
    if (!hubBatch) return setHubItems([]);
    setHubLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      getBatchSchedules(hubBatch).catch(() => []),
      getAssessments(hubBatch).catch(() => []),
      getBatchTasks(hubBatch).catch(() => []),
    ]).then(([scheds, asmts, bTasks]) => {
      setHubItems([
        ...scheds.map(s => {
          const _timeStatus = s.recurring ? 'active'
            : !s.scheduledDate ? 'active'
            : s.scheduledDate > today ? 'upcoming'
            : s.scheduledDate < today ? 'past' : 'active';
          return { ...s, _kind: 'schedule', _timeStatus,
            _label: s.title || 'Class',
            _sub: s.recurring ? `Every ${s.day} at ${s.time}` : `${s.scheduledDate || ''} at ${s.time}`,
            _type: s.type || 'live-class', _course: s.course || '' };
        }),
        ...asmts.map(a => {
          const _timeStatus = a.status === 'completed' ? 'completed'
            : a.date > today ? 'upcoming' : a.date < today ? 'past' : 'active';
          return { ...a, _kind: 'assessment', _timeStatus,
            _label: a.title || 'Assessment',
            _sub: `${a.date || '—'} · ${a.totalMarks || ''} marks`,
            _type: a.subject || '', _course: a.course || '' };
        }),
        ...bTasks.map(t => {
          const _timeStatus = (t.status === 'completed' || t.status === 'submitted') ? 'completed'
            : t.dueDate > today ? 'upcoming' : t.dueDate < today ? 'past' : 'active';
          return { ...t, _kind: 'task', _timeStatus,
            _label: t.title || 'Task',
            _sub: `${t.subject || ''} · Due: ${t.dueDate || '—'}`,
            _type: t.subject || '', _course: t.course || '' };
        }),
      ]);
      setHubPage(0);
      setHubLoading(false);
    });
  }, [hubBatch]);

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

  const unreadNotifs = notifications.filter(n => !n.read).length;
  const pendingReqs  = myRequests.filter(r => r.status === 'pending').length;

  return (
    <div>
      {/* Welcome */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>
            Welcome back, {profile?.name?.split(' ')[0]}
          </h2>
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        {/* Bell + Requests button */}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => { setShowSidebar(true); setSidebarTab('requests'); }}
            style={{ position:'relative', background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'8px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600 }}>
            <Inbox size={15} style={{ color:'#0F3460' }}/>
            My Requests
            {pendingReqs > 0 && <span style={{ background:'#E53935', color:'#fff', fontSize:10, fontWeight:700, borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center' }}>{pendingReqs}</span>}
          </button>
          <button onClick={() => { setShowSidebar(true); setSidebarTab('notif'); }}
            style={{ position:'relative', background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'8px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600 }}>
            <Bell size={15} style={{ color:'#0F3460' }}/>
            Notifications
            {unreadNotifs > 0 && <span style={{ background:'#E53935', color:'#fff', fontSize:10, fontWeight:700, borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center' }}>{unreadNotifs}</span>}
          </button>
        </div>
      </div>

      {/* Notifications + Requests Sidebar */}
      {showSidebar && (
        <div style={{ position:'fixed', inset:0, zIndex:9000 }} onClick={() => setShowSidebar(false)}>
          <div style={{ position:'fixed', top:0, right:0, width:380, height:'100vh', background:'#fff', boxShadow:'-4px 0 24px rgba(0,0,0,0.12)', display:'flex', flexDirection:'column', zIndex:9001 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'18px 20px', borderBottom:'1px solid #E5E7EB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', gap:0, background:'#F3F4F6', borderRadius:8, padding:2 }}>
                {[{ key:'notif', label:'Notifications' }, { key:'requests', label:'My Requests' }].map(t => (
                  <button key={t.key} onClick={() => setSidebarTab(t.key)}
                    style={{ padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                      background: sidebarTab===t.key ? '#0F3460' : 'transparent',
                      color: sidebarTab===t.key ? '#fff' : '#6B7280' }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowSidebar(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF' }}><X size={18}/></button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
              {sidebarTab === 'notif' && (
                <>
                  {notifications.length === 0 && <div style={{ color:'#9CA3AF', fontSize:13, textAlign:'center', paddingTop:40 }}>No notifications.</div>}
                  {notifications.map(n => (
                    <div key={n.id} onClick={() => markNotificationRead(n.id).then(() => setNotifications(prev => prev.map(x => x.id===n.id ? { ...x, read:true } : x)))}
                      style={{ padding:'10px 12px', borderRadius:10, marginBottom:8, cursor:'pointer',
                        background: n.read ? '#FAFBFC' : '#EFF6FF', border:`1px solid ${n.read ? '#E5E7EB' : '#BFDBFE'}` }}>
                      <div style={{ fontSize:13, fontWeight:n.read ? 400 : 700, color:'#1A1A2E', marginBottom:2 }}>{n.title}</div>
                      <div style={{ fontSize:12, color:'#6B7280' }}>{n.body}</div>
                    </div>
                  ))}
                </>
              )}
              {sidebarTab === 'requests' && (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>My Removal Requests</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/requests')}>View All →</button>
                  </div>
                  {myRequests.length === 0 && <div style={{ color:'#9CA3AF', fontSize:13, textAlign:'center', paddingTop:40 }}>No requests submitted.</div>}
                  {myRequests.map(req => {
                    const isPending = req.status === 'pending';
                    return (
                      <div key={req.id} style={{ padding:'12px', borderRadius:10, marginBottom:8, background:'#FAFBFC', border:'1px solid #E5E7EB' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                          <div style={{ fontSize:13, fontWeight:600 }}>{req.targetName}</div>
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:600,
                            background: isPending ? '#FEF3C7' : req.status==='accepted' ? '#D1FAE5' : '#FEE2E2',
                            color: isPending ? '#92400E' : req.status==='accepted' ? '#065F46' : '#991B1B' }}>
                            {req.status}
                          </span>
                        </div>
                        <div style={{ fontSize:12, color:'#6B7280', marginBottom:8 }}>
                          {req.targetType} · {req.reason?.slice(0,80)}
                        </div>
                        {isPending && (
                          <button
                            disabled={reminding[req.id]}
                            onClick={async () => {
                              setReminding(p => ({ ...p, [req.id]: true }));
                              // Notify CEO
                              const ceoSnap = await getDocs(query(collection(db,'staff'), where('role','==','ceo')));
                              for (const ceoDoc of ceoSnap.docs) {
                                const ceo = ceoDoc.data();
                                if (ceo.email) await addNotification({
                                  toEmail: ceo.email, title: 'Reminder: Removal Request',
                                  body: `${profile?.name} is reminding you about their removal request from ${req.targetName}.`,
                                  type: 'removal_reminder', read: false,
                                });
                              }
                              setReminding(p => ({ ...p, [req.id]: false }));
                              alert('Reminder sent to CEO!');
                            }}
                            style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontWeight:500 }}>
                            {reminding[req.id] ? 'Sending...' : '🔔 Remind CEO'}
                          </button>
                        )}
                        {req.status === 'accepted' && (
                          <div style={{ fontSize:11, color:'#10B981', fontWeight:600 }}>✓ Approved — you have been removed.</div>
                        )}
                        {req.status === 'rejected' && (
                          <div style={{ fontSize:11, color:'#EF4444', fontWeight:600 }}>✗ Request was declined by CEO.</div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* ── Batch Activity Hub ── */}
      {(() => {
        const kindColor = {
          schedule:   { bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6' },
          assessment: { bg: '#D1FAE5', color: '#065F46', dot: '#10B981' },
          task:       { bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B' },
        };
        // Derive dropdown options
        const courseOptions = [...new Set(hubItems.map(i => i._course).filter(Boolean))];
        const typeOptions = [...new Set(hubItems.filter(i => hubFilter === 'all' || i._kind === hubFilter).map(i => i._type).filter(Boolean))];

        // Apply all filters
        let list = hubItems;
        if (hubFilter !== 'all') list = list.filter(i => i._kind === hubFilter);
        if (hubTimeFilter === 'active')   list = list.filter(i => i._timeStatus === 'active');
        else if (hubTimeFilter === 'upcoming') list = list.filter(i => i._timeStatus === 'upcoming');
        else if (hubTimeFilter === 'past')     list = list.filter(i => i._timeStatus === 'past' || i._timeStatus === 'completed');
        // 'all' = no time filter
        if (hubCourse)           list = list.filter(i => i._course === hubCourse);
        if (hubTypeFilter)       list = list.filter(i => i._type === hubTypeFilter);
        if (hubSearch.trim())    list = list.filter(i => i._label.toLowerCase().includes(hubSearch.toLowerCase()) || (i._sub||'').toLowerCase().includes(hubSearch.toLowerCase()));

        const totalPages = Math.ceil(list.length / HUB_PAGE);
        const pageList   = list.slice(hubPage * HUB_PAGE, (hubPage + 1) * HUB_PAGE);

        return (
          <div style={{ ...CARD, marginBottom: 20 }}>
            {/* Title + batch chips row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E' }}>📅 Batch Activity Hub <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 400 }}>(active only)</span></h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {myBatches.map(b => (
                  <button key={b.id} onClick={() => { setHubBatch(b.id); setHubFilter('all'); setHubTypeFilter(''); setHubSearch(''); setHubPage(0); }}
                    style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                      background: hubBatch === b.id ? '#0F3460' : '#F3F4F6',
                      color:      hubBatch === b.id ? '#fff'    : '#374151' }}>
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter bar */}
            {hubBatch && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, padding: '10px 12px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E5E7EB' }}>
                {/* Category pills */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[
                    { key: 'all',        label: 'All'            },
                    { key: 'schedule',   label: '🗓 Classes'     },
                    { key: 'assessment', label: '📝 Assessments' },
                    { key: 'task',       label: '✅ Assignments'  },
                  ].map(f => (
                    <button key={f.key} onClick={() => { setHubFilter(f.key); setHubTypeFilter(''); setHubPage(0); }}
                      style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        background: hubFilter === f.key ? '#0F3460' : '#E5E7EB',
                        color:      hubFilter === f.key ? '#fff'    : '#374151' }}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Time filter pills */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderLeft: '1px solid #E5E7EB', paddingLeft: 8 }}>
                  {[
                    { key: 'active',   label: '⚡ Active'   },
                    { key: 'upcoming', label: '📅 Upcoming' },
                    { key: 'past',     label: '🕐 Past'     },
                    { key: 'all',      label: 'All Time'    },
                  ].map(f => (
                    <button key={f.key} onClick={() => { setHubTimeFilter(f.key); setHubPage(0); }}
                      style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        background: hubTimeFilter === f.key ? '#E53935' : '#E5E7EB',
                        color:      hubTimeFilter === f.key ? '#fff'    : '#374151' }}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Course dropdown */}
                {courseOptions.length > 0 && (
                  <select value={hubCourse} onChange={e => { setHubCourse(e.target.value); setHubPage(0); }}
                    style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, background: '#fff', color: '#374151' }}>
                    <option value="">All Courses</option>
                    {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}

                {/* Subject/type dropdown */}
                {typeOptions.length > 0 && (
                  <select value={hubTypeFilter} onChange={e => { setHubTypeFilter(e.target.value); setHubPage(0); }}
                    style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, background: '#fff', color: '#374151' }}>
                    <option value="">All {hubFilter === 'schedule' ? 'Types' : 'Subjects'}</option>
                    {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}

                {/* Search */}
                <input
                  placeholder="Search…"
                  value={hubSearch}
                  onChange={e => { setHubSearch(e.target.value); setHubPage(0); }}
                  style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, background: '#fff', minWidth: 120, flex: 1 }}
                />

                {/* Clear */}
                {(hubSearch || hubTypeFilter || hubCourse || hubFilter !== 'all' || hubTimeFilter !== 'active') && (
                  <button onClick={() => { setHubFilter('all'); setHubTypeFilter(''); setHubCourse(''); setHubSearch(''); setHubTimeFilter('active'); setHubPage(0); }}
                    style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 11, background: '#fff', cursor: 'pointer', color: '#E53935', fontWeight: 600 }}>
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            {!hubBatch && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '28px 0', fontSize: 13 }}>No batches assigned yet.</div>
            )}
            {hubBatch && hubLoading && (
              <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px 0', fontSize: 13 }}>Loading…</div>
            )}
            {hubBatch && !hubLoading && (
              <>
                {/* Count row */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12, color: '#6B7280', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: '#1A1A2E' }}>{list.length} item{list.length !== 1 ? 's' : ''}</span>
                  <span>🗓 {hubItems.filter(i=>i._kind==='schedule').length} classes</span>
                  <span>📝 {hubItems.filter(i=>i._kind==='assessment').length} assessments</span>
                  <span>✅ {hubItems.filter(i=>i._kind==='task').length} assignments</span>
                </div>

                {pageList.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px 0', fontSize: 13 }}>No active items match your filters.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pageList.map((item, i) => {
                      const c = kindColor[item._kind] || kindColor.task;
                      const tab = item._kind === 'schedule' ? 'schedule' : item._kind === 'assessment' ? 'assessments' : 'tasks';
                      return (
                        <div key={item.id || i} onClick={() => navigate('/batches', { state: { batchId: hubBatch, tab } })}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', cursor: 'pointer', background: '#fff', transition: 'background 0.12s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                          <div style={{ width: 9, height: 9, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item._label}</div>
                            {item._sub && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{item._sub}</div>}
                          </div>
                          {item._type && (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#F3F4F6', color: '#374151', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>{item._type}</span>
                          )}
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: c.bg, color: c.color, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                            {item._kind === 'schedule' ? 'Class' : item._kind === 'assessment' ? 'Assessment' : 'Assignment'}
                          </span>
                          <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>→</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid #F3F4F6' }}>
                    <button className="btn btn-ghost btn-sm" disabled={hubPage === 0} onClick={() => setHubPage(p => p - 1)}>← Prev</button>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>Page {hubPage + 1} of {totalPages} · {list.length} items</span>
                    <button className="btn btn-ghost btn-sm" disabled={hubPage >= totalPages - 1} onClick={() => setHubPage(p => p + 1)}>Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

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
                    {(() => {
                      if (!task.dueDate) return null;
                      const due = new Date(task.dueDate);
                      if (isNaN(due)) return null;
                      due.setHours(23, 59, 59, 999);
                      const now = Date.now();
                      const pill = (bg, ink, label) => (
                        <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: bg, color: ink }}>{label}</span>
                      );
                      if (due.getTime() < now) return pill('var(--red-soft)', 'var(--red-ink)', 'Overdue');
                      if (due.getTime() - now <= 48 * 3600 * 1000) return pill('var(--amber-soft)', 'var(--amber-ink)', 'Due soon');
                      return null;
                    })()}
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
