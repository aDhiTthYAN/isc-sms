import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getStudent, updateStudent, getBatches,
  getFollowUps, addFollowUp, getAssessments, addAssessment
} from '../firebase/services';
import { Modal, Toast, Avatar, StatusBadge, Loading, FormRow } from '../components/ui';
import { ArrowLeft, Plus, Phone, Mail, MapPin, BookOpen, User, Calendar } from 'lucide-react';

const STAFF_LIST = ['Priya S.', 'Arjun M.', 'Meena R.', 'John K.', 'Arun P.'];

export default function StudentProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [batches, setBatches] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [toast, setToast] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [assessModal, setAssessModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [assessForm, setAssessForm] = useState({ testName: '', subject: '', date: '', marks: '', totalMarks: '' });

  const load = async () => {
    const [s, b, f, a] = await Promise.all([
      getStudent(id), getBatches(), getFollowUps(id), getAssessments(id)
    ]);
    setStudent(s);
    setBatches(b);
    setFollowups(f);
    setAssessments(a);
    setEditForm(s || {});
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const batchName = (bid) => batches.find(b => b.id === bid)?.name || bid || '—';

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleSaveNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    await addFollowUp({ studentId: id, studentName: student.name, note: newNote, addedBy: 'Staff' });
    setNewNote('');
    setToast({ message: 'Follow-up saved!', type: 'success' });
    const updated = await getFollowUps(id);
    setFollowups(updated);
    setSavingNote(false);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    await updateStudent(id, editForm);
    setToast({ message: 'Student updated!', type: 'success' });
    setEditModal(false);
    load();
  };

  const handleAddAssessment = async (e) => {
    e.preventDefault();
    const pct = Math.round(Number(assessForm.marks) / Number(assessForm.totalMarks) * 100);
    await addAssessment({ studentId: id, studentName: student.name, ...assessForm, percentage: pct });
    setToast({ message: 'Assessment added!', type: 'success' });
    setAssessModal(false);
    setAssessForm({ testName: '', subject: '', date: '', marks: '', totalMarks: '' });
    const updated = await getAssessments(id);
    setAssessments(updated);
  };

  if (loading || !student) return <Loading />;

  const latestPct = assessments.length ? assessments[assessments.length - 1].percentage : null;
  const firstPct  = assessments.length ? assessments[0].percentage : null;
  const trend = (latestPct !== null && firstPct !== null) ? latestPct - firstPct : null;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/students')}>
            <ArrowLeft size={16} />
          </button>
          <h2>{student.name}</h2>
          <StatusBadge status={student.status} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setAssessModal(true)}><Plus size={15} /> Assessment</button>
          <button className="btn btn-primary" onClick={() => setEditModal(true)}>Edit Profile</button>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Left col */}
        <div>
          {/* Profile card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <Avatar name={student.name} size="lg" />
              <div>
                <div style={{ fontSize: 17, fontWeight: 600 }}>{student.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  {student.classplusId && `${student.classplusId} · `}{batchName(student.batchId)}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{student.course}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
              {[
                  { icon: Phone,    label: 'Child Phone',   val: student.phone },
                  { icon: User,     label: 'Parent Name',   val: student.parentName },
                  { icon: Phone,    label: 'Parent Phone',  val: student.parentPhone },
                  { icon: Mail,     label: 'Email',         val: student.email },
                  { icon: BookOpen, label: 'Class / Std',   val: student.classStd },
                  { icon: MapPin,   label: 'Location',      val: student.location },
                  { icon: User,     label: 'Staff',         val: student.staffAssigned },
                  { icon: Calendar, label: 'Joined',        val: student.joinDate },
              ].filter(r => r.val).map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label}>
                    <div style={{ color: '#9CA3AF', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{row.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon size={12} style={{ color: '#9CA3AF' }} />
                      {row.val}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Subscription validity */}
{student.joinDate && student.courseDurationMonths && (() => {
              const joinDate = new Date(student.joinDate);
              const expiryDate = new Date(joinDate);
              expiryDate.setMonth(expiryDate.getMonth() + Number(student.courseDurationMonths));
              const today = new Date();
              const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
              const isExpired = daysLeft < 0;
              const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30;
              return (
                <div style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: isExpired ? '#FEE2E2' : isExpiringSoon ? '#FEF3C7' : '#F0FDF4',
                  border: `1px solid ${isExpired ? '#FECACA' : isExpiringSoon ? '#FDE68A' : '#BBF7D0'}`,
                  fontSize: 13
                }}>
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 2,
                      color: isExpired ? '#991B1B' : isExpiringSoon ? '#92400E' : '#065F46'
                    }}
                  >
                    📅 Subscription {isExpired ? 'Expired' : `Valid till ${expiryDate.toLocaleDateString('en-IN')}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {student.courseDurationMonths} month course · Joined {new Date(student.joinDate).toLocaleDateString('en-IN')} ·
                    {isExpired ? ` Expired ${Math.abs(daysLeft)} days ago` : ` ${daysLeft} days remaining`}
                  </div>
                </div>
              );
            })()}
            {student.notes && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: '#FFF8E1', borderRadius: 8, fontSize: 13, color: '#92400E' }}>
                📝 {student.notes}
              </div>
            )}
          </div>

          {/* Assessments */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>Assessment Progress</h3>
              {trend !== null && (
                <span style={{ fontSize: 12, color: trend >= 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                  {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% overall
                </span>
              )}
            </div>
            {assessments.length === 0 && <p style={{ color: '#6B7280', fontSize: 13 }}>No assessments yet.</p>}
            {assessments.map((a, i) => (
              <div key={a.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>Test {i + 1} – {a.testName}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: a.percentage >= 60 ? '#10B981' : a.percentage >= 40 ? '#F59E0B' : '#EF4444' }}>
                    {a.percentage}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${a.percentage}%`,
                    background: a.percentage >= 60 ? '#10B981' : a.percentage >= 40 ? '#F59E0B' : '#EF4444'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right col — follow-up history */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Follow-Up History</h3>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{followups.length} records</span>
          </div>

          <div className="timeline" style={{ marginBottom: 20, maxHeight: 420, overflowY: 'auto' }}>
            {followups.length === 0 && <p style={{ color: '#6B7280', fontSize: 13 }}>No follow-ups logged yet.</p>}
            {followups.map((fu, i) => (
              <div key={fu.id} className="tl-item">
                <div className="tl-dot-col">
                  <div className="tl-dot" />
                  {i < followups.length - 1 && <div className="tl-line" />}
                </div>
                <div className="tl-body">
                  <div className="tl-date">{formatDate(fu.createdAt)}</div>
                  <div className="tl-text">{fu.note}</div>
                  {fu.addedBy && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>by {fu.addedBy}</div>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Add Follow-Up Note</label>
            <textarea
              className="form-input" rows={3}
              placeholder="What happened? Called, visited, parent contacted..."
              value={newNote} onChange={e => setNewNote(e.target.value)}
            />
            <button
              className="btn btn-primary" style={{ marginTop: 10, width: '100%' }}
              onClick={handleSaveNote} disabled={savingNote || !newNote.trim()}
            >
              {savingNote ? 'Saving...' : <><Plus size={14} /> Save Note</>}
            </button>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editModal && (
        <Modal title="Edit Student Profile" onClose={() => setEditModal(false)} wide>
          <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Parent Phone</label>
                <input className="form-input" value={editForm.parentPhone || ''} onChange={e => setEditForm({...editForm, parentPhone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={editForm.status || 'active'} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                  {['active','moderate','at-risk','dropped'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Staff Assigned</label>
                <select className="form-input" value={editForm.staffAssigned || ''} onChange={e => setEditForm({...editForm, staffAssigned: e.target.value})}>
                  <option value="">Select</option>
                  {STAFF_LIST.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={editForm.notes || ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assessment modal */}
      {assessModal && (
        <Modal title="Add Assessment Result" onClose={() => setAssessModal(false)}>
          <form onSubmit={handleAddAssessment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Test Name *</label>
              <input className="form-input" required value={assessForm.testName} onChange={e => setAssessForm({...assessForm, testName: e.target.value})} placeholder="e.g. Mid-Term Test 1" />
            </div>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <input className="form-input" value={assessForm.subject} onChange={e => setAssessForm({...assessForm, subject: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={assessForm.date} onChange={e => setAssessForm({...assessForm, date: e.target.value})} />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Marks Scored *</label>
                <input className="form-input" type="number" required value={assessForm.marks} onChange={e => setAssessForm({...assessForm, marks: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Total Marks *</label>
                <input className="form-input" type="number" required value={assessForm.totalMarks} onChange={e => setAssessForm({...assessForm, totalMarks: e.target.value})} />
              </div>
            </FormRow>
            {assessForm.marks && assessForm.totalMarks && (
              <div style={{ padding: '8px 14px', background: '#F0FDF4', borderRadius: 8, fontSize: 13, color: '#065F46' }}>
                Percentage: <strong>{Math.round(Number(assessForm.marks) / Number(assessForm.totalMarks) * 100)}%</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setAssessModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Result</button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
