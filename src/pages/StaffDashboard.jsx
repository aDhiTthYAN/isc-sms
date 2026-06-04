import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getMyStudents, getMyTasks, getMyFollowUps, getBatches,
  getBatchStudents, getBatchSchedules, getBatchTasks, updateTask
} from '../firebase/services';
import { Loading, Avatar, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  Users, CheckSquare, PhoneCall, School,
  ChevronRight, Clock, AlertTriangle, Calendar
} from 'lucide-react';

export default function StaffDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [students,  setStudents]  = useState([]);
  const [tasks,     setTasks]     = useState([]);
  const [followups, setFollowups] = useState([]);
  const [batches,   setBatches]   = useState([]);
  const [myBatches, setMyBatches] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, f, b] = await Promise.all([
          getMyStudents(profile?.name).catch(() => []),
          getMyTasks(profile?.email).catch(() => []),
          getMyFollowUps(profile?.email).catch(() => []),
          getBatches().catch(() => []),
        ]);
        setStudents(s);
        setTasks(t);
        setFollowups(f);
        setBatches(b);
        // Filter batches where this staff is a faculty/mentor
        const mine = b.filter(batch =>
          batch.faculties?.includes(profile?.name) ||
          batch.mentor === profile?.name
        );
        setMyBatches(mine.length > 0 ? mine : b.slice(0, 3));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (profile?.name) load();
  }, [profile?.name]);

  if (loading) return <Loading text="Loading your dashboard..." />;

  const pendingTasks   = tasks.filter(t => t.status !== 'completed');
  const pendingFollowups = followups.filter(f => !f.completed);
  const atRisk         = students.filter(s => s.status === 'at-risk');

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>
          Welcome back, {profile?.name?.split(' ')[0]} 👋
        </h2>
        <div style={{ fontSize:13, color:'#6B7280' }}>Here's your work summary for today</div>
      </div>

      {/* Quick stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'My Students',      value:students.length,        color:'#3B82F6', bg:'#DBEAFE', icon:Users,        link:'/students'  },
          { label:'Pending Tasks',    value:pendingTasks.length,    color:'#F59E0B', bg:'#FEF3C7', icon:CheckSquare,  link:'/tasks'     },
          { label:'Open Follow-Ups',  value:pendingFollowups.length,color:'#10B981', bg:'#D1FAE5', icon:PhoneCall,    link:'/followups' },
          { label:'At Risk Students', value:atRisk.length,          color:'#EF4444', bg:'#FEE2E2', icon:AlertTriangle,link:'/students'  },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card" style={{ cursor:'pointer' }} onClick={() => navigate(card.link)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div className="stat-label">{card.label}</div>
                  <div className="stat-value" style={{ color:card.color }}>{card.value}</div>
                </div>
                <div style={{ width:36, height:36, borderRadius:9, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={17} style={{ color:card.color }}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-2" style={{ marginBottom:16 }}>
        {/* My Batches */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>My Batches</h3>
            <Link to="/batches" style={{ fontSize:12, color:'#E53935', display:'flex', alignItems:'center', gap:2 }}>
              Manage all <ChevronRight size={13}/>
            </Link>
          </div>
          {myBatches.length === 0 && (
            <p style={{ fontSize:13, color:'#6B7280' }}>No batches assigned yet.</p>
          )}
          {myBatches.map(batch => (
            <div key={batch.id}
              onClick={() => navigate('/batches')}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'#F9FAFB', borderRadius:8, marginBottom:8, cursor:'pointer' }}
            >
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{batch.name}</div>
                <div style={{ fontSize:11, color:'#6B7280' }}>{batch.course} · {batch.status}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span className={`badge ${batch.status==='active'?'badge-green':batch.status==='upcoming'?'badge-blue':'badge-gray'}`}>
                  {batch.status}
                </span>
                <ChevronRight size={13} style={{ color:'#9CA3AF' }}/>
              </div>
            </div>
          ))}
          <Link to="/batches" style={{ display:'block', textAlign:'center', padding:'8px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#3B82F6', fontWeight:500, marginTop:4 }}>
            Open Batch Management →
          </Link>
        </div>

        {/* My Pending Tasks */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>My Tasks</h3>
            <Link to="/tasks" style={{ fontSize:12, color:'#E53935', display:'flex', alignItems:'center', gap:2 }}>
              View all <ChevronRight size={13}/>
            </Link>
          </div>
          {pendingTasks.slice(0,5).map(task => (
            <div key={task.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width:16, height:16, borderRadius:4, background:task.status==='in-progress'?'#F59E0B':'#E5E7EB', flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{task.title}</div>
                <div style={{ fontSize:11, color:'#9CA3AF' }}>
                  {task.dueDate && `Due: ${task.dueDate}`}
                  {task.priority === 'high' && <span style={{ color:'#EF4444', marginLeft:6 }}>● High</span>}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize:11 }}
                onClick={async () => {
                  await updateTask(task.id, { status: 'completed', completedAt: new Date().toISOString() });
                  setTasks(prev => prev.filter(t => t.id !== task.id));
                }}
              >Done</button>
            </div>
          ))}
          {pendingTasks.length === 0 && <p style={{ fontSize:13, color:'#6B7280' }}>All tasks completed! 🎉</p>}
        </div>
      </div>

      <div className="grid-2">
        {/* At risk students */}
        {atRisk.length > 0 && (
          <div className="card">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:14, fontWeight:600, color:'#EF4444' }}>⚠️ At Risk Students</h3>
              <Link to="/students" style={{ fontSize:12, color:'#E53935' }}>View all</Link>
            </div>
            {atRisk.slice(0,5).map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, cursor:'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
                <Avatar name={s.name} size="sm"/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'#6B7280' }}>{s.batchName}</div>
                </div>
                <ChevronRight size={13} style={{ color:'#9CA3AF' }}/>
              </div>
            ))}
          </div>
        )}

        {/* Open Follow-ups */}
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>Open Follow-Ups</h3>
            <Link to="/followups" style={{ fontSize:12, color:'#E53935' }}>View all</Link>
          </div>
          {pendingFollowups.slice(0,5).map(f => (
            <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <Avatar name={f.studentName||'?'} size="sm"/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>{f.studentName}</div>
                <div style={{ fontSize:11, color:'#6B7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.note}</div>
              </div>
              {f.priority === 'high' && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:'#FEE2E2', color:'#991B1B', fontWeight:600 }}>Urgent</span>}
            </div>
          ))}
          {pendingFollowups.length === 0 && <p style={{ fontSize:13, color:'#6B7280' }}>No open follow-ups.</p>}
        </div>
      </div>
    </div>
  );
}
