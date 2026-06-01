import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyStudents, getMyTasks, getMyFollowUps, getBatches, getUnassignedStudents, selfAssignStudents } from '../firebase/services';
import { Loading, StatusBadge, Avatar, Toast, Modal } from '../components/ui';
import { AlertTriangle, CheckSquare, Users, BookOpen, ChevronRight, Phone, UserPlus, Activity } from 'lucide-react';

export default function StaffDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents]         = useState([]);
  const [tasks, setTasks]               = useState([]);
  const [followups, setFollowups]       = useState([]);
  const [batches, setBatches]           = useState([]);
  const [unassigned, setUnassigned]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState('assigned');
  const [showSelfAssign, setShowSelfAssign] = useState(false);
  const [selectedToAssign, setSelectedToAssign] = useState([]);
  const [assigning, setAssigning]       = useState(false);
  const [toast, setToast]               = useState(null);

  const load = async () => {
    const [s, t, f, b, u] = await Promise.all([
      getMyStudents(profile?.name),
      getMyTasks(user?.email),
      getMyFollowUps(user?.email),
      getBatches(),
      getUnassignedStudents(),
    ]);
    setStudents(s);
    setTasks(t);
    setFollowups(f);
    setBatches(b);
    setUnassigned(u);
    setLoading(false);
  };

  useEffect(() => { if (profile) load(); }, [profile]);

  const handleSelfAssign = async () => {
    if (!selectedToAssign.length) return;
    setAssigning(true);
    await selfAssignStudents(profile.name, selectedToAssign);
    setToast({ message: `${selectedToAssign.length} students assigned to you!`, type: 'success' });
    setShowSelfAssign(false);
    setSelectedToAssign([]);
    load();
    setAssigning(false);
  };

  const toggleSelect = (id) => {
    setSelectedToAssign(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const batchName = (id) => batches.find(b => b.id === id)?.name || '—';
  const myBatchIds = [...new Set(students.map(s => s.batchId).filter(Boolean))];
  const myBatches  = batches.filter(b => myBatchIds.includes(b.id));

  // Activity tracking helpers
  const noActivity = students.filter(s => {
    if (!s.lastActivityDate) return true;
    const d = s.lastActivityDate.toDate ? s.lastActivityDate.toDate() : new Date(s.lastActivityDate);
    const days = Math.ceil((new Date() - d) / (1000 * 60 * 60 * 24));
    return days > 7;
  });

  // Expiring subscriptions
  const expiringSoon = students.filter(s => {
    if (!s.joinDate || !s.courseDurationMonths) return false;
    const expiry = new Date(s.joinDate);
    expiry.setMonth(expiry.getMonth() + Number(s.courseDurationMonths));
    const daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
    return daysLeft >= 0 && daysLeft <= 30;
  });

  if (loading) return <Loading />;

  const atRisk = students.filter(s => s.status === 'at-risk');

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>
          Welcome, {profile?.name?.split(' ')[0]} 👋
        </h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          {students.length} students · {myBatchIds.length} batches · {tasks.length} open tasks
        </p>
      </div>

      {/* Alert banners */}
      {noActivity.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠️ <strong>{noActivity.length} students</strong> have had no activity in the last 7 days.
          <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#E53935' }} onClick={() => setActiveTab('no-activity')}>View →</span>
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, fontSize: 12, color: '#991B1B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          📅 <strong>{expiringSoon.length} students'</strong> subscriptions expire within 30 days.
          <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#E53935' }} onClick={() => setActiveTab('expiring')}>View →</span>
        </div>
      )}
      {unassigned.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, fontSize: 12, color: '#1E40AF', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={14} /> <strong>{unassigned.length} unassigned students</strong> available. You can assign them to yourself.
          <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#E53935' }} onClick={() => setShowSelfAssign(true)}>Assign →</span>
        </div>
      )}
      {tasks.length > 0 && (
        <div style={{ padding: '10px 14px', background: '#EDE9FE', borderRadius: 8, fontSize: 12, color: '#5B21B6', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          📋 <strong>{tasks.length} open task{tasks.length > 1 ? 's' : ''}</strong> assigned by CEO.
          <span style={{ marginLeft: 'auto', cursor: 'pointer', color: '#E53935' }} onClick={() => navigate('/tasks')}>View →</span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'My Students',  value: students.length,   color: '#3B82F6', bg: '#DBEAFE',  icon: Users },
          { label: 'At Risk',      value: atRisk.length,     color: '#EF4444', bg: '#FEE2E2',  icon: AlertTriangle },
          { label: 'No Activity',  value: noActivity.length, color: '#F59E0B', bg: '#FEF3C7',  icon: Activity },
          { label: 'Expiring',     value: expiringSoon.length,color:'#8B5CF6', bg: '#EDE9FE',  icon: BookOpen },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {[
          { key: 'assigned',    label: `All Students (${students.length})` },
          { key: 'batches',     label: `Batches (${myBatches.length})` },
          { key: 'no-activity', label: `No Activity (${noActivity.length})` },
          { key: 'expiring',    label: `Expiring Soon (${expiringSoon.length})` },
          { key: 'followups',   label: `Follow-Ups (${followups.filter(f=>!f.completed).length})` },
        ].map(t => (
          <div key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ALL STUDENTS */}
      {activeTab === 'assigned' && (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Child Name</th><th>Parent</th><th>Phone</th><th>Class/Std</th><th>Batch</th><th>Status</th><th>Subscription</th><th></th></tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>
                  No students assigned yet.
                  {unassigned.length > 0 && <span style={{ color: '#E53935', cursor: 'pointer', marginLeft: 8 }} onClick={() => setShowSelfAssign(true)}>Assign unassigned students →</span>}
                </td></tr>
              )}
              {students.map(s => {
                let daysLeft = null;
                if (s.joinDate && s.courseDurationMonths) {
                  const expiry = new Date(s.joinDate);
                  expiry.setMonth(expiry.getMonth() + Number(s.courseDurationMonths));
                  daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
                }
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={s.name} size="sm" />
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{s.parentName || '—'}</td>
                    <td>
                      <div style={{ fontSize: 13 }}>{s.phone || '—'}</div>
                      {s.parentPhone && <div style={{ fontSize: 11, color: '#6B7280' }}>P: {s.parentPhone}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{s.classStd || '—'}</td>
                    <td style={{ fontSize: 13 }}>{batchName(s.batchId)}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      {daysLeft !== null ? (
                        <span style={{
                          fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                          background: daysLeft < 0 ? '#FEE2E2' : daysLeft <= 30 ? '#FEF3C7' : '#D1FAE5',
                          color: daysLeft < 0 ? '#991B1B' : daysLeft <= 30 ? '#92400E' : '#065F46'
                        }}>
                          {daysLeft < 0 ? `Expired` : `${daysLeft}d left`}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>
                        View <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* BATCHES */}
      {activeTab === 'batches' && (
        <div className="grid-2">
          {myBatches.length === 0 && <div className="card" style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>Your students are not in any batch yet.</div>}
          {myBatches.map(batch => {
            const bStudents = students.filter(s => s.batchId === batch.id);
            const bAtRisk   = bStudents.filter(s => s.status === 'at-risk').length;
            const bActive   = bStudents.filter(s => s.status === 'active').length;
            const bNoAct    = bStudents.filter(s => {
              if (!s.lastActivityDate) return true;
              const d = s.lastActivityDate.toDate ? s.lastActivityDate.toDate() : new Date(s.lastActivityDate);
              return Math.ceil((new Date() - d) / (1000*60*60*24)) > 7;
            }).length;
            return (
              <div key={batch.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{batch.name}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{batch.course} {batch.courseDurationMonths && `· ${batch.courseDurationMonths} months`}</div>
                  </div>
                  <span className={`badge ${batch.status === 'active' ? 'badge-green' : 'badge-blue'}`}>{batch.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  <div style={{ textAlign: 'center', padding: '6px', background: '#D1FAE5', borderRadius: 7 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#10B981' }}>{bActive}</div>
                    <div style={{ fontSize: 10, color: '#065F46' }}>Active</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '6px', background: '#FEE2E2', borderRadius: 7 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#EF4444' }}>{bAtRisk}</div>
                    <div style={{ fontSize: 10, color: '#991B1B' }}>At Risk</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '6px', background: '#FEF3C7', borderRadius: 7 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#F59E0B' }}>{bNoAct}</div>
                    <div style={{ fontSize: 10, color: '#92400E' }}>No Activity</div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
                  {bStudents.slice(0, 4).map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }} onClick={() => navigate(`/students/${s.id}`)}>
                      <Avatar name={s.name} size="sm" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: '#6B7280' }}>{s.classStd} · {s.parentPhone || s.phone}</div>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                  ))}
                  {bStudents.length > 4 && (
                    <div style={{ fontSize: 12, color: '#E53935', marginTop: 6, cursor: 'pointer' }} onClick={() => setActiveTab('assigned')}>
                      +{bStudents.length - 4} more →
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NO ACTIVITY */}
      {activeTab === 'no-activity' && (
        <div className="table-container">
          <table>
            <thead><tr><th>Child</th><th>Parent</th><th>Phone</th><th>Batch</th><th>Last Activity</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {noActivity.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6B7280', padding: 30 }}>All students have recent activity! 🎉</td></tr>}
              {noActivity.map(s => (
                <tr key={s.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar name={s.name} size="sm" /><div><div style={{ fontWeight: 500 }}>{s.name}</div><div style={{ fontSize: 11, color: '#6B7280' }}>{s.classStd}</div></div></div></td>
                  <td style={{ fontSize: 13 }}>{s.parentName || '—'}</td>
                  <td><div style={{ fontSize: 13 }}>{s.phone || '—'}</div><div style={{ fontSize: 11, color: '#6B7280' }}>{s.parentPhone}</div></td>
                  <td style={{ fontSize: 13 }}>{batchName(s.batchId)}</td>
                  <td><span className="badge badge-amber">{s.lastActivityDate ? 'Inactive 7+ days' : 'No activity recorded'}</span></td>
                  <td><StatusBadge status={s.status} /></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* EXPIRING SOON */}
      {activeTab === 'expiring' && (
        <div className="table-container">
          <table>
            <thead><tr><th>Child</th><th>Parent Phone</th><th>Batch</th><th>Join Date</th><th>Expires</th><th>Days Left</th><th></th></tr></thead>
            <tbody>
              {expiringSoon.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6B7280', padding: 30 }}>No subscriptions expiring soon.</td></tr>}
              {expiringSoon.map(s => {
                const expiry = new Date(s.joinDate);
                expiry.setMonth(expiry.getMonth() + Number(s.courseDurationMonths));
                const daysLeft = Math.ceil((expiry - new Date()) / (1000*60*60*24));
                return (
                  <tr key={s.id}>
                    <td><div style={{ fontWeight: 500 }}>{s.name}</div></td>
                    <td style={{ fontSize: 13 }}>{s.parentPhone || s.phone || '—'}</td>
                    <td style={{ fontSize: 13 }}>{batchName(s.batchId)}</td>
                    <td style={{ fontSize: 13 }}>{s.joinDate}</td>
                    <td style={{ fontSize: 13 }}>{expiry.toLocaleDateString('en-IN')}</td>
                    <td><span className="badge badge-amber">{daysLeft} days</span></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* FOLLOW-UPS */}
      {activeTab === 'followups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {followups.filter(f => !f.completed).length === 0 && <div className="card" style={{ textAlign: 'center', color: '#6B7280', padding: 30 }}>No pending follow-ups.</div>}
          {followups.filter(f => !f.completed).map(f => (
            <div key={f.id} className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: f.priority === 'urgent' ? '#FEE2E2' : '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Phone size={15} style={{ color: f.priority === 'urgent' ? '#E53935' : '#F59E0B' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{f.studentName}</div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{f.note}</div>
                {f.nextAction && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>Next: {f.nextAction}</div>}
              </div>
              <span className={`badge ${f.priority === 'urgent' ? 'badge-red' : f.priority === 'high' ? 'badge-amber' : 'badge-gray'}`}>{f.priority}</span>
            </div>
          ))}
        </div>
      )}

      {/* Self-assign modal */}
      {showSelfAssign && (
        <Modal title="Assign Students to Yourself" onClose={() => setShowSelfAssign(false)} wide>
          <div style={{ padding: '8px 12px', background: '#EFF6FF', borderRadius: 8, fontSize: 12, color: '#1E40AF', marginBottom: 14 }}>
            These students are not assigned to any staff. Select the ones you want to take responsibility for.
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 14 }}>
            {unassigned.map(s => (
              <div key={s.id} onClick={() => toggleSelect(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                borderRadius: 8, cursor: 'pointer', marginBottom: 4,
                background: selectedToAssign.includes(s.id) ? '#EFF6FF' : 'var(--bg)',
                border: `1px solid ${selectedToAssign.includes(s.id) ? '#3B82F6' : 'var(--border)'}`,
              }}>
                <input type="checkbox" checked={selectedToAssign.includes(s.id)} onChange={() => {}} style={{ flexShrink: 0 }} />
                <Avatar name={s.name} size="sm" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{s.classStd} · {s.batchName || 'No batch'}</div>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{s.phone}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{selectedToAssign.length} selected</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowSelfAssign(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSelfAssign} disabled={assigning || !selectedToAssign.length}>
                {assigning ? 'Assigning...' : `Assign ${selectedToAssign.length} to Me`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}