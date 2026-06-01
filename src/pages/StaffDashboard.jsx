import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyStudents, getMyTasks, getMyFollowUps, getBatches } from '../firebase/services';
import { Loading, StatusBadge, Avatar } from '../components/ui';
import { AlertTriangle, CheckSquare, Users, BookOpen, ChevronRight, Phone } from 'lucide-react';

export default function StaffDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents]   = useState([]);
  const [tasks, setTasks]         = useState([]);
  const [followups, setFollowups] = useState([]);
  const [batches, setBatches]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('assigned'); // assigned | batches

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      getMyStudents(profile.name),         // students assigned to this staff
      getMyTasks(user?.email),             // tasks assigned to this staff's email
      getMyFollowUps(user?.email),         // follow-ups assigned to this staff's email
      getBatches(),
    ]).then(([s, t, f, b]) => {
      setStudents(s);
      setTasks(t);
      setFollowups(f);
      setBatches(b);
      setLoading(false);
    });
  }, [profile, user]);

  if (loading) return <Loading />;

  const atRisk    = students.filter(s => s.status === 'at-risk');
  const active    = students.filter(s => s.status === 'active');
  const moderate  = students.filter(s => s.status === 'moderate');

  // Get unique batches this staff's students belong to
  const myBatchIds = [...new Set(students.map(s => s.batchId).filter(Boolean))];
  const myBatches  = batches.filter(b => myBatchIds.includes(b.id));

  const batchName = (id) => batches.find(b => b.id === id)?.name || '—';

  return (
    <div>
      {/* Welcome */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>
          Welcome, {profile?.name?.split(' ')[0]} 👋
        </h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          You have <strong>{students.length} students</strong> assigned to you across <strong>{myBatchIds.length} batch{myBatchIds.length !== 1 ? 'es' : ''}</strong>.
        </p>
      </div>

      {/* Alerts */}
      {tasks.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, fontSize: 12, color: '#1E40AF', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          📬 You have <strong>{tasks.length} open task{tasks.length > 1 ? 's' : ''}</strong> assigned to you.
          <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#E53935' }} onClick={() => navigate('/tasks')}>View →</span>
        </div>
      )}
      {followups.filter(f => !f.completed).length > 0 && (
        <div style={{ padding: '10px 14px', background: '#FFF7ED', borderRadius: 8, fontSize: 12, color: '#92400E', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          📞 You have <strong>{followups.filter(f => !f.completed).length} pending follow-up{followups.filter(f=>!f.completed).length > 1 ? 's' : ''}</strong>.
          <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#E53935' }} onClick={() => navigate('/followups')}>View →</span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'My Students',     value: students.length, color: '#3B82F6', bg: '#DBEAFE',  icon: Users        },
          { label: 'Active',          value: active.length,   color: '#10B981', bg: '#D1FAE5',  icon: CheckSquare  },
          { label: 'At Risk',         value: atRisk.length,   color: '#EF4444', bg: '#FEE2E2',  icon: AlertTriangle},
          { label: 'My Batches',      value: myBatchIds.length,color:'#8B5CF6', bg: '#EDE9FE',  icon: BookOpen     },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={17} style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        <div className={`tab ${activeTab === 'assigned' ? 'active' : ''}`} onClick={() => setActiveTab('assigned')}>
          My Assigned Students ({students.length})
        </div>
        <div className={`tab ${activeTab === 'batches' ? 'active' : ''}`} onClick={() => setActiveTab('batches')}>
          My Batches ({myBatches.length})
        </div>
        <div className={`tab ${activeTab === 'followups' ? 'active' : ''}`} onClick={() => setActiveTab('followups')}>
          My Follow-Ups ({followups.filter(f=>!f.completed).length})
        </div>
      </div>

      {/* ASSIGNED STUDENTS TAB */}
      {activeTab === 'assigned' && (
        <div>
          {students.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>
              No students assigned to you yet. Ask your CEO to assign students.
            </div>
          )}
          {/* Group by status */}
          {atRisk.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={14} /> At Risk Students ({atRisk.length}) — Needs immediate attention
              </div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Student</th><th>Batch</th><th>Phone</th><th>Issue</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {atRisk.map(s => (
                      <tr key={s.id}>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={s.name} size="sm" /><div><div style={{ fontWeight: 500 }}>{s.name}</div><div style={{ fontSize: 11, color: '#6B7280' }}>{s.location}</div></div></div></td>
                        <td style={{ fontSize: 13 }}>{batchName(s.batchId)}</td>
                        <td style={{ fontSize: 13 }}>{s.phone}</td>
                        <td style={{ fontSize: 12, color: '#6B7280' }}>{s.notes || '—'}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>View <ChevronRight size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All assigned students */}
          <div className="table-container">
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontWeight: 500, fontSize: 13 }}>
              All My Students ({students.length})
            </div>
            <table>
              <thead><tr><th>Student</th><th>Batch</th><th>Phone</th><th>ClassPlus ID</th><th>Status</th><th>Progress</th><th></th></tr></thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={s.name} size="sm" /><div><div style={{ fontWeight: 500 }}>{s.name}</div><div style={{ fontSize: 11, color: '#6B7280' }}>{s.email}</div></div></div></td>
                    <td style={{ fontSize: 13 }}>{batchName(s.batchId)}</td>
                    <td style={{ fontSize: 13 }}>{s.phone || '—'}</td>
                    <td style={{ fontSize: 13, color: '#6B7280' }}>{s.classplusId || '—'}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { status: 'active',   color: '#10B981' },
                          { status: 'moderate', color: '#F59E0B' },
                          { status: 'at-risk',  color: '#EF4444' },
                        ].map(dot => (
                          <div key={dot.status} style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: s.status === dot.status ? dot.color : '#E5E7EB'
                          }} />
                        ))}
                      </div>
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BATCHES TAB */}
      {activeTab === 'batches' && (
        <div>
          {myBatches.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>
              Your assigned students are not in any batch yet.
            </div>
          )}
          <div className="grid-2">
            {myBatches.map(batch => {
              const batchStudents = students.filter(s => s.batchId === batch.id);
              const batchAtRisk   = batchStudents.filter(s => s.status === 'at-risk').length;
              const batchActive   = batchStudents.filter(s => s.status === 'active').length;
              const start = batch.startDate ? new Date(batch.startDate) : null;
              const end   = batch.endDate   ? new Date(batch.endDate)   : null;
              const pct   = start && end ? Math.min(100, Math.max(0, Math.round((new Date() - start)/(end - start)*100))) : 0;
              return (
                <div key={batch.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{batch.name}</div>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>{batch.course}</div>
                    </div>
                    <span className={`badge ${batch.status === 'active' ? 'badge-green' : 'badge-blue'}`}>{batch.status}</span>
                  </div>
                  {/* My students in this batch */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 12 }}>
                    <div style={{ flex: 1, padding: '8px 10px', background: '#F0FDF4', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 18, color: '#10B981' }}>{batchActive}</div>
                      <div style={{ color: '#065F46' }}>Active</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px 10px', background: '#FEF3C7', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 18, color: '#F59E0B' }}>{batchStudents.filter(s=>s.status==='moderate').length}</div>
                      <div style={{ color: '#92400E' }}>Moderate</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px 10px', background: '#FEE2E2', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: 18, color: '#EF4444' }}>{batchAtRisk}</div>
                      <div style={{ color: '#991B1B' }}>At Risk</div>
                    </div>
                  </div>
                  {batch.status === 'active' && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                        <span>Batch progress</span><span>{pct}%</span>
                      </div>
                      <div className="pb"><div className="pb-f" style={{ width: `${pct}%`, background: '#E53935' }} /></div>
                    </div>
                  )}
                  {/* List students in this batch */}
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#6B7280', marginBottom: 8 }}>
                      My {batchStudents.length} students in this batch:
                    </div>
                    {batchStudents.slice(0, 5).map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #F9FAFB', cursor: 'pointer' }}
                        onClick={() => navigate(`/students/${s.id}`)}>
                        <Avatar name={s.name} size="sm" />
                        <span style={{ fontSize: 12, flex: 1 }}>{s.name}</span>
                        <StatusBadge status={s.status} />
                      </div>
                    ))}
                    {batchStudents.length > 5 && (
                      <div style={{ fontSize: 12, color: '#E53935', marginTop: 6, cursor: 'pointer' }}
                        onClick={() => navigate('/students')}>
                        +{batchStudents.length - 5} more students →
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FOLLOW-UPS TAB */}
      {activeTab === 'followups' && (
        <div>
          {followups.length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>
              No follow-ups assigned to you yet.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {followups.map(f => (
              <div key={f.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: f.completed ? '#D1FAE5' : f.priority === 'urgent' ? '#FEE2E2' : '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone size={16} style={{ color: f.completed ? '#10B981' : f.priority === 'urgent' ? '#E53935' : '#F59E0B' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{f.studentName}</span>
                    <span className={`badge ${f.priority === 'urgent' ? 'badge-red' : f.priority === 'high' ? 'badge-amber' : 'badge-gray'}`}>{f.priority}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{f.note}</p>
                  {f.nextAction && <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Next: {f.nextAction}</p>}
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Assigned by {f.assignedBy}</div>
                </div>
                <div>
                  {!f.completed
                    ? <button className="btn btn-ghost btn-sm" onClick={() => navigate('/followups')}>Log & Close</button>
                    : <span className="badge badge-green">✓ Done</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
