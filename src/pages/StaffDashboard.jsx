import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getMyStudents, getMyTasks, getMyFollowUps, getBatches,
  getUnassignedStudents, selfAssignStudents
} from '../firebase/services';
import { Loading, StatusBadge, Avatar, Toast, Modal } from '../components/ui';
import {
  AlertTriangle, Users, BookOpen, ChevronRight,
  Phone, UserPlus, Activity, Calendar, CheckSquare
} from 'lucide-react';

export default function StaffDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents]       = useState([]);
  const [tasks, setTasks]             = useState([]);
  const [followups, setFollowups]     = useState([]);
  const [batches, setBatches]         = useState([]);
  const [unassigned, setUnassigned]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState('assigned');
  const [showSelfAssign, setShowSelfAssign] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [assigning, setAssigning]     = useState(false);
  const [toast, setToast]             = useState(null);

  const load = async () => {
    try {
      const [s, t, f, b, u] = await Promise.all([
        getMyStudents(profile?.name || ''),
        getMyTasks(user?.email || ''),
        getMyFollowUps(user?.email || ''),
        getBatches(),
        getUnassignedStudents(),
      ]);
      setStudents(s || []);
      setTasks(t || []);
      setFollowups(f || []);
      setBatches(b || []);
      setUnassigned(u || []);
    } catch (err) {
      console.error('Staff dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.name) load();
  }, [profile]);

  const batchName  = (id) => batches.find(b => b.id === id)?.name || '—';
  const myBatchIds = [...new Set(students.map(s => s.batchId).filter(Boolean))];
  const myBatches  = batches.filter(b => myBatchIds.includes(b.id));

  // Compute derived lists
  const atRisk = students.filter(s => s.status === 'at-risk');

  const noActivity = students.filter(s => {
    if (!s.lastActivityDate) return true;
    const d = s.lastActivityDate?.toDate ? s.lastActivityDate.toDate() : new Date(s.lastActivityDate);
    return Math.ceil((Date.now() - d) / 86400000) > 7;
  });

  const expiringSoon = students.filter(s => {
    if (!s.joinDate || !s.courseDurationMonths) return false;
    const exp = new Date(s.joinDate);
    exp.setMonth(exp.getMonth() + Number(s.courseDurationMonths));
    const days = Math.ceil((exp - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  });

  const pendingFollowups = followups.filter(f => !f.completed);

  const daysLeft = (s) => {
    if (!s.joinDate || !s.courseDurationMonths) return null;
    const exp = new Date(s.joinDate);
    exp.setMonth(exp.getMonth() + Number(s.courseDurationMonths));
    return Math.ceil((exp - Date.now()) / 86400000);
  };

  const handleSelfAssign = async () => {
    if (!selectedIds.length) return;
    setAssigning(true);
    await selfAssignStudents(profile.name, selectedIds);
    setToast({ message: `${selectedIds.length} students assigned to you!`, type: 'success' });
    setShowSelfAssign(false);
    setSelectedIds([]);
    load();
    setAssigning(false);
  };

  const toggleSelect = (id) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (loading) return <Loading />;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>
          Welcome, {profile?.name?.split(' ')[0]} 👋
        </h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>
          {students.length} students · {myBatches.length} batches · {pendingFollowups.length} pending follow-ups
        </p>
      </div>

      {/* Alert banners */}
      {noActivity.length > 0 && (
        <div style={{ padding:'10px 14px', background:'#FEF3C7', borderRadius:8, fontSize:12, color:'#92400E', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
          ⚠️ <strong>{noActivity.length} students</strong> inactive for 7+ days.
          <span style={{ marginLeft:'auto', color:'#E53935', cursor:'pointer' }} onClick={() => setActiveTab('no-activity')}>View →</span>
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div style={{ padding:'10px 14px', background:'#FEE2E2', borderRadius:8, fontSize:12, color:'#991B1B', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
          📅 <strong>{expiringSoon.length} subscriptions</strong> expiring within 30 days.
          <span style={{ marginLeft:'auto', color:'#E53935', cursor:'pointer' }} onClick={() => setActiveTab('expiring')}>View →</span>
        </div>
      )}
      {unassigned.length > 0 && (
        <div style={{ padding:'10px 14px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
          <UserPlus size={13}/> <strong>{unassigned.length} unassigned students</strong> — you can take them.
          <span style={{ marginLeft:'auto', color:'#E53935', cursor:'pointer' }} onClick={() => setShowSelfAssign(true)}>Assign to me →</span>
        </div>
      )}
      {tasks.length > 0 && (
        <div style={{ padding:'10px 14px', background:'#EDE9FE', borderRadius:8, fontSize:12, color:'#5B21B6', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
          📋 <strong>{tasks.length} open tasks</strong> from management.
          <span style={{ marginLeft:'auto', color:'#E53935', cursor:'pointer' }} onClick={() => navigate('/tasks')}>View →</span>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[
          { label:'My Students',   value:students.length,     color:'#3B82F6', bg:'#DBEAFE', icon:Users       },
          { label:'At Risk',       value:atRisk.length,       color:'#EF4444', bg:'#FEE2E2', icon:AlertTriangle},
          { label:'No Activity',   value:noActivity.length,   color:'#F59E0B', bg:'#FEF3C7', icon:Activity     },
          { label:'Open Tasks',    value:tasks.length,        color:'#8B5CF6', bg:'#EDE9FE', icon:CheckSquare  },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #E5E7EB', padding:'12px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:11, color:'#6B7280', marginBottom:4 }}>{card.label}</div>
                  <div style={{ fontSize:22, fontWeight:700, color:card.color }}>{card.value}</div>
                </div>
                <div style={{ width:32, height:32, borderRadius:8, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={16} style={{ color:card.color }}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom:16 }}>
        {[
          { key:'assigned',    label:`All Students (${students.length})`      },
          { key:'batches',     label:`My Batches (${myBatches.length})`        },
          { key:'no-activity', label:`No Activity (${noActivity.length})`      },
          { key:'expiring',    label:`Expiring (${expiringSoon.length})`        },
          { key:'followups',   label:`Follow-Ups (${pendingFollowups.length})` },
        ].map(t => (
          <div key={t.key} className={`tab ${activeTab===t.key?'active':''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── ALL STUDENTS TAB ── */}
      {activeTab === 'assigned' && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Child Name</th><th>Parent</th><th>Phone</th>
                <th>Class / Std</th><th>Batch</th><th>Status</th>
                <th>Subscription</th><th></th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign:'center', color:'#6B7280', padding:40 }}>
                  No students assigned yet.
                  {unassigned.length > 0 && (
                    <span style={{ color:'#E53935', cursor:'pointer', marginLeft:8 }}
                      onClick={() => setShowSelfAssign(true)}>
                      Pick unassigned students →
                    </span>
                  )}
                </td></tr>
              )}
              {students.map(s => {
                const dl = daysLeft(s);
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar name={s.name} size="sm"/>
                        <div style={{ fontWeight:500 }}>{s.name}</div>
                      </div>
                    </td>
                    <td style={{ fontSize:13 }}>{s.parentName || '—'}</td>
                    <td>
                      <div style={{ fontSize:13 }}>{s.phone || '—'}</div>
                      {s.parentPhone && <div style={{ fontSize:11, color:'#6B7280' }}>P: {s.parentPhone}</div>}
                    </td>
                    <td style={{ fontSize:13 }}>{s.classStd || '—'}</td>
                    <td style={{ fontSize:13 }}>{batchName(s.batchId)}</td>
                    <td><StatusBadge status={s.status}/></td>
                    <td>
                      {dl !== null ? (
                        <span style={{
                          fontSize:11, padding:'2px 7px', borderRadius:10, fontWeight:600,
                          background: dl<0?'#FEE2E2': dl<=30?'#FEF3C7':'#D1FAE5',
                          color:       dl<0?'#991B1B': dl<=30?'#92400E':'#065F46',
                        }}>
                          {dl<0 ? 'Expired' : `${dl}d left`}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/students/${s.id}`)}>
                        View <ChevronRight size={12}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BATCHES TAB ── */}
      {activeTab === 'batches' && (
        <div>
          {myBatches.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'#6B7280', padding:40 }}>
              Your students are not in any batch yet, or batches haven't been created.
            </div>
          )}
          <div className="grid-2">
            {myBatches.map(batch => {
              const bs     = students.filter(s => s.batchId === batch.id);
              const bRisk  = bs.filter(s => s.status === 'at-risk').length;
              const bAct   = bs.filter(s => s.status === 'active').length;
              const bNoAct = bs.filter(s => {
                if (!s.lastActivityDate) return true;
                const d = s.lastActivityDate?.toDate ? s.lastActivityDate.toDate() : new Date(s.lastActivityDate);
                return Math.ceil((Date.now()-d)/86400000) > 7;
              }).length;
              const start = batch.startDate ? new Date(batch.startDate) : null;
              const end   = batch.endDate   ? new Date(batch.endDate)   : null;
              const pct   = start && end
                ? Math.min(100, Math.max(0, Math.round((Date.now()-start)/(end-start)*100)))
                : 0;
              return (
                <div key={batch.id} className="card">
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14 }}>{batch.name}</div>
                      <div style={{ fontSize:12, color:'#6B7280' }}>
                        {batch.course}{batch.courseDurationMonths ? ` · ${batch.courseDurationMonths} months` : ''}
                      </div>
                    </div>
                    <span className={`badge ${batch.status==='active'?'badge-green':'badge-blue'}`}>
                      {batch.status}
                    </span>
                  </div>

                  {/* Faculty tags */}
                  {batch.faculties?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:10 }}>
                      {batch.faculties.map((f, i) => (
                        <span key={i} className="badge badge-blue">{f}</span>
                      ))}
                    </div>
                  )}

                  {/* Mini stats */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:10 }}>
                    {[
                      { label:'Active',      val:bAct,   bg:'#D1FAE5', col:'#10B981' },
                      { label:'At Risk',     val:bRisk,  bg:'#FEE2E2', col:'#EF4444' },
                      { label:'No Activity', val:bNoAct, bg:'#FEF3C7', col:'#F59E0B' },
                    ].map(c => (
                      <div key={c.label} style={{ textAlign:'center', padding:'6px', background:c.bg, borderRadius:7 }}>
                        <div style={{ fontWeight:700, fontSize:16, color:c.col }}>{c.val}</div>
                        <div style={{ fontSize:10, color:c.col }}>{c.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  {batch.status === 'active' && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9CA3AF', marginBottom:3 }}>
                        <span>Batch progress</span><span>{pct}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width:`${pct}%`, background:'#E53935' }}/>
                      </div>
                    </div>
                  )}

                  {/* Student preview */}
                  <div style={{ borderTop:'1px solid #F3F4F6', paddingTop:8 }}>
                    <div style={{ fontSize:11, color:'#6B7280', marginBottom:6 }}>
                      My {bs.length} students in this batch:
                    </div>
                    {bs.slice(0, 4).map(s => (
                      <div key={s.id}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', cursor:'pointer', borderBottom:'1px solid #F9FAFB' }}
                        onClick={() => navigate(`/students/${s.id}`)}>
                        <Avatar name={s.name} size="sm"/>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:500 }}>{s.name}</div>
                          <div style={{ fontSize:10, color:'#6B7280' }}>
                            {s.classStd}{s.classStd && (s.parentPhone||s.phone) ? ' · ' : ''}{s.parentPhone||s.phone}
                          </div>
                        </div>
                        <StatusBadge status={s.status}/>
                      </div>
                    ))}
                    {bs.length > 4 && (
                      <div style={{ fontSize:12, color:'#E53935', marginTop:6, cursor:'pointer' }}
                        onClick={() => setActiveTab('assigned')}>
                        +{bs.length-4} more →
                      </div>
                    )}
                    {bs.length === 0 && (
                      <div style={{ fontSize:12, color:'#9CA3AF' }}>
                        No students from this batch assigned to you yet.
                      </div>
                    )}
                  </div>

                  <button className="btn btn-ghost btn-sm" style={{ marginTop:10, width:'100%' }}
                    onClick={() => navigate('/batches')}>
                    <Calendar size={13}/> View Schedule & Tasks
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── NO ACTIVITY TAB ── */}
      {activeTab === 'no-activity' && (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Child</th><th>Parent</th><th>Parent Phone</th><th>Batch</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {noActivity.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign:'center', color:'#6B7280', padding:30 }}>
                  All students have recent activity 🎉
                </td></tr>
              )}
              {noActivity.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Avatar name={s.name} size="sm"/>
                      <div>
                        <div style={{ fontWeight:500 }}>{s.name}</div>
                        <div style={{ fontSize:11, color:'#6B7280' }}>{s.classStd}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize:13 }}>{s.parentName||'—'}</td>
                  <td style={{ fontSize:13 }}>{s.parentPhone||s.phone||'—'}</td>
                  <td style={{ fontSize:13 }}>{batchName(s.batchId)}</td>
                  <td><StatusBadge status={s.status}/></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── EXPIRING TAB ── */}
      {activeTab === 'expiring' && (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Child</th><th>Parent Phone</th><th>Batch</th><th>Join Date</th><th>Expires</th><th>Days Left</th><th></th></tr>
            </thead>
            <tbody>
              {expiringSoon.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'#6B7280', padding:30 }}>
                  No subscriptions expiring soon.
                </td></tr>
              )}
              {expiringSoon.map(s => {
                const exp = new Date(s.joinDate);
                exp.setMonth(exp.getMonth() + Number(s.courseDurationMonths));
                const dl = Math.ceil((exp - Date.now()) / 86400000);
                return (
                  <tr key={s.id}>
                    <td style={{ fontWeight:500 }}>{s.name}</td>
                    <td style={{ fontSize:13 }}>{s.parentPhone||s.phone||'—'}</td>
                    <td style={{ fontSize:13 }}>{batchName(s.batchId)}</td>
                    <td style={{ fontSize:13 }}>{s.joinDate}</td>
                    <td style={{ fontSize:13 }}>{exp.toLocaleDateString('en-IN')}</td>
                    <td><span className="badge badge-amber">{dl} days</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── FOLLOW-UPS TAB ── */}
      {activeTab === 'followups' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {pendingFollowups.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'#6B7280', padding:30 }}>
              No pending follow-ups assigned to you.
            </div>
          )}
          {pendingFollowups.map(f => (
            <div key={f.id} className="card" style={{ padding:'12px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
              <div style={{ width:34, height:34, borderRadius:9, flexShrink:0,
                background: f.priority==='urgent'?'#FEE2E2':'#FEF3C7',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Phone size={15} style={{ color:f.priority==='urgent'?'#E53935':'#F59E0B' }}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:500 }}>{f.studentName}</div>
                <div style={{ fontSize:13, color:'#374151', marginTop:3, lineHeight:1.5 }}>{f.note}</div>
                {f.nextAction && (
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:3 }}>Next: {f.nextAction}</div>
                )}
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>
                  Assigned by {f.assignedBy}
                </div>
              </div>
              <span className={`badge ${f.priority==='urgent'?'badge-red':f.priority==='high'?'badge-amber':'badge-gray'}`}>
                {f.priority}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── SELF-ASSIGN MODAL ── */}
      {showSelfAssign && (
        <Modal title="Assign Students to Yourself" onClose={() => { setShowSelfAssign(false); setSelectedIds([]); }} wide>
          <div style={{ padding:'8px 12px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:14 }}>
            These students have no staff assigned. Select the ones you want to manage.
          </div>
          <div style={{ maxHeight:320, overflowY:'auto', marginBottom:14, display:'flex', flexDirection:'column', gap:6 }}>
            {unassigned.length === 0 && (
              <div style={{ textAlign:'center', color:'#6B7280', padding:20, fontSize:13 }}>
                All students are already assigned.
              </div>
            )}
            {unassigned.map(s => (
              <div key={s.id} onClick={() => toggleSelect(s.id)} style={{
                display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                borderRadius:8, cursor:'pointer',
                background: selectedIds.includes(s.id)?'#EFF6FF':'var(--bg)',
                border:`1px solid ${selectedIds.includes(s.id)?'#3B82F6':'var(--border)'}`,
              }}>
                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => {}} style={{ flexShrink:0 }}/>
                <Avatar name={s.name} size="sm"/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'#6B7280' }}>
                    {s.classStd} · {s.batchName||'No batch'}
                  </div>
                </div>
                <div style={{ fontSize:12, color:'#6B7280' }}>{s.phone}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, color:'#6B7280' }}>{selectedIds.length} selected</span>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-ghost" onClick={() => { setShowSelfAssign(false); setSelectedIds([]); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSelfAssign}
                disabled={assigning || !selectedIds.length}>
                {assigning ? 'Assigning...' : `Assign ${selectedIds.length} to Me`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}