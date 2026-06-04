import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStudents, getTasks, getAllFollowUps, getBatches } from '../firebase/services';
import { Loading, Avatar, StatusBadge } from '../components/ui';
import { TrendingUp, Users, AlertTriangle, School, ChevronRight, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const [students,  setStudents]  = useState([]);
  const [tasks,     setTasks]     = useState([]);
  const [followups, setFollowups] = useState([]);
  const [batches,   setBatches]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getStudents(), getTasks(), getAllFollowUps(), getBatches()])
      .then(([s, t, f, b]) => {
        setStudents(s); setTasks(t); setFollowups(f); setBatches(b);
        setLoading(false);
      });
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;

  const active   = students.filter(s => s.status === 'active').length;
  const atRisk   = students.filter(s => s.status === 'at-risk').length;
  const moderate = students.filter(s => s.status === 'moderate').length;
  const dropped  = students.filter(s => s.status === 'dropped').length;
  const total    = students.length;

  // Students with weak subjects
  const weakSubjectStudents = students.filter(s => s.weakSubjects?.length > 0);

  // Expiring subscriptions
  const expiringSoon = students.filter(s => {
    if (!s.joinDate || !s.courseDurationMonths) return false;
    const exp = new Date(s.joinDate);
    exp.setMonth(exp.getMonth() + Number(s.courseDurationMonths));
    const days = Math.ceil((exp - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  });

  const recentFollowups = followups.slice(0, 4);
  const activeBatches   = batches.filter(b => b.status === 'active');

  const statsCards = [
    { label:'Total Students', value:total,        sub:`+${students.filter(s => { if (!s.createdAt) return false; const d = s.createdAt.toDate?s.createdAt.toDate():new Date(s.createdAt); const now=new Date(); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); }).length} this month`, color:'#E53935', bg:'#FEE2E2', icon:Users },
    { label:'Active Students', value:active,       sub:`${total?Math.round(active/total*100):0}% active rate`, color:'#10B981', bg:'#D1FAE5', icon:TrendingUp },
    { label:'At Risk',         value:atRisk,        sub:'Needs attention',  color:'#F59E0B', bg:'#FEF3C7', icon:AlertTriangle },
    { label:'Active Batches',  value:activeBatches.length, sub:`${batches.filter(b=>b.status==='upcoming').length} starting soon`, color:'#3B82F6', bg:'#DBEAFE', icon:School },
  ];

  return (
    <div>
      {/* Alert banners */}
      {expiringSoon.length > 0 && (
        <div style={{ padding:'10px 14px', background:'#FEE2E2', borderRadius:8, fontSize:12, color:'#991B1B', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          📅 <strong>{expiringSoon.length} student subscriptions</strong> expire within 30 days.
          <Link to="/students" style={{ marginLeft:'auto', color:'#E53935', fontSize:12 }}>View →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom:16 }}>
        {statsCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div className="stat-label">{card.label}</div>
                  <div className="stat-value" style={{ color:card.color }}>{card.value}</div>
                  <div className="stat-sub" style={{ color:card.color }}>{card.sub}</div>
                </div>
                <div style={{ width:38, height:38, borderRadius:10, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={19} style={{ color:card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-2" style={{ marginBottom:14 }}>
        {/* Activity overview */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>Student Activity Overview</h3>
          </div>
          {[
            { label:'Active',   count:active,   color:'#10B981', total },
            { label:'Moderate', count:moderate,  color:'#F59E0B', total },
            { label:'At Risk',  count:atRisk,    color:'#EF4444', total },
            { label:'Dropped',  count:dropped,   color:'#9CA3AF', total },
          ].map(row => (
            <div key={row.label} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width:9, height:9, borderRadius:'50%', background:row.color, flexShrink:0 }}/>
              <span style={{ fontSize:13, width:72 }}>{row.label}</span>
              <div className="progress-bar" style={{ flex:1 }}>
                <div className="progress-fill" style={{ width:`${row.total?Math.round(row.count/row.total*100):0}%`, background:row.color }}/>
              </div>
              <span style={{ fontSize:13, fontWeight:600, width:28, textAlign:'right' }}>{row.count}</span>
            </div>
          ))}
          {/* Weak subject students */}
          {weakSubjectStudents.length > 0 && (
            <div style={{ marginTop:12, padding:'10px 12px', background:'#FEF3C7', borderRadius:8, display:'flex', alignItems:'center', gap:8 }}>
              <AlertCircle size={14} style={{ color:'#F59E0B' }}/>
              <span style={{ fontSize:12, color:'#92400E' }}>
                <strong>{weakSubjectStudents.length} students</strong> have weak subjects flagged
              </span>
              <Link to="/students" style={{ marginLeft:'auto', fontSize:12, color:'#E53935' }}>View →</Link>
            </div>
          )}
        </div>

        {/* Recent follow-ups */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>Recent Follow-Ups</h3>
            <Link to="/followups" style={{ fontSize:12, color:'#E53935', display:'flex', alignItems:'center', gap:2 }}>
              View all <ChevronRight size={13}/>
            </Link>
          </div>
          {recentFollowups.length === 0 && (
            <p style={{ color:'#6B7280', fontSize:13 }}>No follow-ups recorded yet.</p>
          )}
          {recentFollowups.map(fu => (
            <div key={fu.id} style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
              <Avatar name={fu.studentName||'?'} size="sm"/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>{fu.studentName}</div>
                <div style={{ fontSize:12, color:'#6B7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fu.note}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        {/* Tasks */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>Today's Staff Tasks</h3>
            <Link to="/tasks" style={{ fontSize:12, color:'#E53935', display:'flex', alignItems:'center', gap:2 }}>
              View all <ChevronRight size={13}/>
            </Link>
          </div>
          {tasks.slice(0, 4).map(task => (
            <div key={task.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width:17, height:17, borderRadius:4, flexShrink:0,
                background: task.status==='completed'?'#10B981':'#E5E7EB',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                {task.status==='completed' && <span style={{ color:'#fff', fontSize:11 }}>✓</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, textDecoration:task.status==='completed'?'line-through':'none', color:task.status==='completed'?'#9CA3AF':'inherit' }}>{task.title}</div>
                <div style={{ fontSize:11, color:'#9CA3AF' }}>{task.assignedTo}</div>
              </div>
              <span className={`badge ${task.status==='completed'?'badge-green':task.status==='in-progress'?'badge-amber':'badge-gray'}`} style={{ fontSize:10 }}>
                {task.status==='in-progress'?'In Progress':task.status==='completed'?'Done':'Pending'}
              </span>
            </div>
          ))}
          {tasks.length === 0 && <p style={{ color:'#6B7280', fontSize:13 }}>No tasks yet.</p>}
        </div>

        {/* Batches */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>Active Batches</h3>
            <Link to="/batches" style={{ fontSize:12, color:'#E53935', display:'flex', alignItems:'center', gap:2 }}>
              View all <ChevronRight size={13}/>
            </Link>
          </div>
          {batches.slice(0, 4).map(batch => {
            const start = batch.startDate ? new Date(batch.startDate) : null;
            const end   = batch.endDate   ? new Date(batch.endDate)   : null;
            const pct   = start && end
              ? Math.min(100, Math.max(0, Math.round((Date.now()-start)/(end-start)*100)))
              : 0;
            return (
              <div key={batch.id} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{batch.name}</div>
                    <div style={{ fontSize:11, color:'#6B7280' }}>
                      {batch.faculties?.length > 0
                        ? batch.faculties.join(', ')
                        : batch.mentor || '—'}
                    </div>
                  </div>
                  <span className={`badge ${batch.status==='active'?'badge-green':batch.status==='upcoming'?'badge-blue':'badge-gray'}`}>
                    {batch.status}
                  </span>
                </div>
                {batch.status === 'active' && (
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width:`${pct}%`, background:'#E53935' }}/>
                  </div>
                )}
              </div>
            );
          })}
          {batches.length === 0 && <p style={{ color:'#6B7280', fontSize:13 }}>No batches yet.</p>}
        </div>
      </div>
    </div>
  );
}