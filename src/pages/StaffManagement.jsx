import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Modal, Toast, Loading, Confirm, FormRow } from '../components/ui';
import { Plus, ShieldOff, RefreshCw, Shield, Copy, Check, BookOpen, Edit } from 'lucide-react';

const ALL_SUBJECTS = [
  'Mathematics','Science','English','Hindi','Social Science',
  'Physics','Chemistry','Biology','Computer Science',
  'Python','Data Science','Web Development','Machine Learning',
  'Economics','Accountancy','Business Studies','Other'
];

const ROLE_INFO = {
  ceo:   { label:'CEO',   badgeCls:'badge-red',    color:'#E53935', desc:'Full access — all modules, assign tasks, manage staff, view all reports' },
  admin: { label:'Admin', badgeCls:'badge-purple',  color:'#8B5CF6', desc:'Manage students, batches, documents, concerns. Cannot manage staff.' },
  staff: { label:'Staff', badgeCls:'badge-blue',    color:'#3B82F6', desc:'View assigned students, log follow-ups, submit daily reports, complete tasks.' },
};

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#';
  let pass = '';
  for (let i = 0; i < 10; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

export default function StaffManagement() {
  const [staffList, setStaffList]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [showInstructions, setShowInstructions] = useState(null);
  const [showSubjectModal, setShowSubjectModal] = useState(null); // staff member
  const [revoking, setRevoking]     = useState(null);
  const [toast, setToast]           = useState(null);
  const [saving, setSaving]         = useState(false);
  const [copied, setCopied]         = useState('');
  const [editingSubjects, setEditingSubjects] = useState([]);
  const [form, setForm] = useState({ name:'', email:'', role:'staff' });

  const load = async () => {
    const snap = await getDocs(collection(db, 'staff'));
    setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tempPassword = generateTempPassword();
      const newDocRef = doc(collection(db, 'staff'));
      await setDoc(newDocRef, {
        name:           form.name,
        email:          form.email,
        role:           form.role,
        subjects:       [],
        active:         true,
        tempPassword:   tempPassword,
        needsAuthSetup: true,
        createdAt:      new Date().toISOString(),
      });
      setShowModal(false);
      setShowInstructions({ name: form.name, email: form.email, tempPassword, role: form.role });
      setForm({ name:'', email:'', role:'staff' });
      load();
    } catch (err) {
      setToast({ message: err.message, type:'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    await updateDoc(doc(db, 'staff', revoking.id), { active: false });
    setRevoking(null);
    setToast({ message: `Access revoked for ${revoking.name}.`, type:'info' });
    load();
  };

  const handleRestore = async (member) => {
    await updateDoc(doc(db, 'staff', member.id), { active: true });
    setToast({ message: `Access restored for ${member.name}.`, type:'success' });
    load();
  };

  const handleSaveSubjects = async () => {
    await updateDoc(doc(db, 'staff', showSubjectModal.id), { subjects: editingSubjects });
    setToast({ message: `Subjects updated for ${showSubjectModal.name}!`, type:'success' });
    setShowSubjectModal(null);
    load();
  };

  const toggleSubject = (sub) => {
    setEditingSubjects(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    );
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const active  = staffList.filter(s => s.active !== false);
  const revoked = staffList.filter(s => s.active === false);

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h2>Staff Management</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add Staff Member
        </button>
      </div>

      {/* Role cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {Object.entries(ROLE_INFO).map(([key, info]) => (
          <div key={key} style={{ padding:'14px 16px', borderRadius:10, border:`1.5px solid ${info.color}30`, background:`${info.color}08` }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <Shield size={15} style={{ color:info.color }} />
              <span style={{ fontWeight:600, fontSize:13, color:info.color }}>{info.label}</span>
            </div>
            <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.5 }}>{info.desc}</div>
          </div>
        ))}
      </div>

      {/* Auth setup warning */}
      <div style={{ padding:'12px 16px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, marginBottom:20, fontSize:13 }}>
        <div style={{ fontWeight:600, marginBottom:6 }}>⚠️ How to give staff login access (2 steps)</div>
        <div style={{ color:'#374151', lineHeight:1.7 }}>
          <strong>Step 1:</strong> Add staff below → saves their profile + generates temp password.<br/>
          <strong>Step 2:</strong> Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" style={{ color:'#E53935' }}>Firebase Console</a> → Authentication → Add user → enter their email + temp password → copy the UID → in Firestore rename their staff document ID to match that UID.
        </div>
      </div>

      {/* Active staff table */}
      <div className="table-container" style={{ marginBottom:20 }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:13 }}>
          Active Staff ({active.length})
        </div>
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Subjects Handling</th><th>Auth Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {active.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', color:'#6B7280', padding:30 }}>
                No staff yet. Add your first staff member.
              </td></tr>
            )}
            {active.map(member => {
              const ri = ROLE_INFO[member.role] || ROLE_INFO.staff;
              return (
                <tr key={member.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:30, height:30, borderRadius:'50%', background:ri.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:11, fontWeight:600 }}>
                        {member.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight:500, fontSize:13 }}>{member.name}</span>
                    </div>
                  </td>
                  <td style={{ color:'#6B7280', fontSize:13 }}>{member.email}</td>
                  <td><span className={`badge ${ri.badgeCls}`}>{ri.label}</span></td>
                  <td>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
                      {(member.subjects || []).length === 0 ? (
                        <span style={{ fontSize:12, color:'#9CA3AF' }}>No subjects assigned</span>
                      ) : (
                        (member.subjects || []).slice(0, 3).map(s => (
                          <span key={s} className="badge badge-blue" style={{ fontSize:10 }}>{s}</span>
                        ))
                      )}
                      {(member.subjects || []).length > 3 && (
                        <span style={{ fontSize:11, color:'#6B7280' }}>+{member.subjects.length - 3} more</span>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ padding:'3px 8px', fontSize:11 }}
                        onClick={() => { setShowSubjectModal(member); setEditingSubjects(member.subjects || []); }}>
                        <Edit size={11} /> Edit
                      </button>
                    </div>
                  </td>
                  <td>
                    {member.needsAuthSetup
                      ? <span className="badge badge-amber">⚠️ Needs Auth setup</span>
                      : <span className="badge badge-green">✅ Login active</span>
                    }
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      {member.needsAuthSetup && member.tempPassword && (
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => setShowInstructions({ name:member.name, email:member.email, tempPassword:member.tempPassword, role:member.role })}>
                          View Setup
                        </button>
                      )}
                      {member.role !== 'ceo' && (
                        <button className="btn btn-sm"
                          style={{ background:'#FEE2E2', color:'#991B1B', border:'none', borderRadius:6, cursor:'pointer', padding:'5px 10px', fontSize:12, display:'flex', alignItems:'center', gap:4 }}
                          onClick={() => setRevoking(member)}>
                          <ShieldOff size={13} /> Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Revoked staff */}
      {revoked.length > 0 && (
        <div className="table-container">
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:13, color:'#6B7280' }}>
            Revoked ({revoked.length})
          </div>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {revoked.map(member => (
                <tr key={member.id} style={{ opacity:0.6 }}>
                  <td style={{ fontSize:13, fontWeight:500 }}>{member.name}</td>
                  <td style={{ fontSize:13, color:'#6B7280' }}>{member.email}</td>
                  <td><span className={`badge ${ROLE_INFO[member.role]?.badgeCls||'badge-gray'}`}>{member.role}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRestore(member)}>
                      <RefreshCw size={13} /> Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Modal */}
      {showModal && (
        <Modal title="Add Staff Member" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" required value={form.name}
                onChange={e => setForm({...form, name:e.target.value})} placeholder="Staff member's full name" />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input className="form-input" type="email" required value={form.email}
                onChange={e => setForm({...form, email:e.target.value})} placeholder="staff@internationalskillsclub.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-input" value={form.role} onChange={e => setForm({...form, role:e.target.value})}>
                <option value="staff">Staff — Limited access</option>
                <option value="admin">Admin — Moderate access</option>
                <option value="ceo">CEO — Full access</option>
              </select>
              <div style={{ fontSize:11, color:'#6B7280', marginTop:4 }}>{ROLE_INFO[form.role]?.desc}</div>
            </div>
            <div style={{ padding:'10px 14px', background:'#FFFBEB', borderRadius:8, fontSize:12, color:'#92400E' }}>
              After saving, you can assign subjects to this staff member from the table.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Add Staff Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Subject Assignment Modal */}
      {showSubjectModal && (
        <Modal title={`Assign Subjects — ${showSubjectModal.name}`} onClose={() => setShowSubjectModal(null)}>
          <div style={{ fontSize:13, color:'#6B7280', marginBottom:14 }}>
            Select all subjects this staff member handles. A staff member can handle multiple subjects.
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
            {ALL_SUBJECTS.map(sub => (
              <div key={sub} onClick={() => toggleSubject(sub)} style={{
                padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:500,
                background: editingSubjects.includes(sub) ? '#3B82F6' : 'var(--bg)',
                color:      editingSubjects.includes(sub) ? '#fff'    : 'var(--muted)',
                border:     `1px solid ${editingSubjects.includes(sub) ? '#3B82F6' : 'var(--border)'}`,
                transition: 'all .15s',
              }}>
                {editingSubjects.includes(sub) ? '✓ ' : ''}{sub}
              </div>
            ))}
          </div>
          {editingSubjects.length > 0 && (
            <div style={{ padding:'8px 12px', background:'#DBEAFE', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:14 }}>
              <strong>Assigned:</strong> {editingSubjects.join(', ')}
            </div>
          )}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setShowSubjectModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveSubjects}>
              <BookOpen size={14} /> Save Subjects
            </button>
          </div>
        </Modal>
      )}

      {/* Setup Instructions Modal */}
      {showInstructions && (
        <Modal title="Staff Setup Instructions" onClose={() => setShowInstructions(null)}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ padding:'12px 14px', background:'#D1FAE5', borderRadius:8, fontSize:13, color:'#065F46', fontWeight:500 }}>
              ✅ Staff profile saved! Follow these 2 steps to give them login access.
            </div>
            <div style={{ padding:'14px', background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)' }}>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Step 1 — Create login in Firebase Console</div>
              <ol style={{ fontSize:12, color:'#374151', lineHeight:2, paddingLeft:16 }}>
                <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" style={{ color:'#E53935' }}>console.firebase.google.com</a></li>
                <li>Open your project → Authentication → Users → Add user</li>
                <li>Enter the email and password shown below</li>
                <li>Copy the UID shown after creation</li>
                <li>In Firestore → staff collection → find this person's document → click the 3 dots → rename document ID to match the UID</li>
              </ol>
            </div>
            <div style={{ padding:'14px', background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)' }}>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Step 2 — Share with {showInstructions.name}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { label:'App URL',      value:window.location.origin,         key:'url'   },
                  { label:'Email',        value:showInstructions.email,          key:'email' },
                  { label:'Temp Password',value:showInstructions.tempPassword,   key:'pass'  },
                  { label:'Role',         value:showInstructions.role,           key:'role'  },
                ].map(item => (
                  <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'#fff', borderRadius:8, border:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize:10, color:'#9CA3AF', textTransform:'uppercase', marginBottom:2 }}>{item.label}</div>
                      <div style={{ fontSize:13, fontWeight:500, fontFamily:item.key==='pass'?'monospace':'inherit' }}>{item.value}</div>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => copyToClipboard(item.value, item.key)}>
                      {copied === item.key ? <Check size={13} style={{ color:'#10B981' }} /> : <Copy size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowInstructions(null)}>Done</button>
          </div>
        </Modal>
      )}

      {revoking && (
        <Confirm
          message={`Revoke access for ${revoking.name}? Their data is preserved but they cannot log in.`}
          onConfirm={handleRevoke}
          onCancel={() => setRevoking(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}