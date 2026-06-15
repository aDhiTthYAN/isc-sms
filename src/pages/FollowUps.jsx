import { useEffect, useState } from 'react';
import { getAllFollowUps, getStudents, addFollowUp, completeFollowUp, addNotification, getStaffProfiles } from '../firebase/services';
import { sendFollowUpEmail } from '../firebase/emailService';
import { Modal, Toast, Loading, Avatar, FormRow } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Mail, CheckCircle, Clock } from 'lucide-react';

export default function FollowUps() {
  const { profile, user } = useAuth();
  const [followups, setFollowups]   = useState([]);
  const [students, setStudents]     = useState([]);
  const [staff, setStaff]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [showModal, setShowModal]   = useState(false);
  const [completing, setCompleting] = useState(null);
  const [completionNote, setCompletionNote] = useState('');
  const [toast, setToast]           = useState(null);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({
    studentId: '', studentName: '',
    staffIds: [],
    note: '', nextAction: '', priority: 'normal'
  });

  const toggleStaff = (id) => {
    setForm(prev => ({
      ...prev,
      staffIds: prev.staffIds.includes(id)
        ? prev.staffIds.filter(x => x !== id)
        : [...prev.staffIds, id],
    }));
  };

  const isCEOorAdmin = profile?.role === 'ceo' || profile?.role === 'admin';

  const load = async () => {
    const [f, s, st] = await Promise.all([getAllFollowUps(), getStudents(), getStaffProfiles()]);
    // Staff see only their assigned follow-ups
    setFollowups(isCEOorAdmin ? f : f.filter(fu => fu.assignedToEmail === user?.email));
    setStudents(s);
    setStaff(st.filter(s => s.active !== false && s.role !== 'ceo'));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = followups.filter(f => {
    const q = search.toLowerCase();
    const matchQ = !q || f.studentName?.toLowerCase().includes(q) || f.note?.toLowerCase().includes(q) || f.assignedTo?.toLowerCase().includes(q);
    if (filter === 'pending')   return matchQ && !f.completed;
    if (filter === 'completed') return matchQ && f.completed;
    if (filter === 'urgent')    return matchQ && f.priority === 'urgent' && !f.completed;
    return matchQ;
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const selectedStaff = staff.filter(s => form.staffIds.includes(s.id));
      if (selectedStaff.length === 0) {
        setToast({ message: 'Please select at least one staff member.', type: 'error' });
        setSaving(false);
        return;
      }

      const fullMessage = `Follow-up assigned by ${profile?.name}: "${form.studentName}" — ${form.note}`;

      await Promise.all(selectedStaff.map(async (s) => {
        await addFollowUp({
          studentId:       form.studentId,
          studentName:     form.studentName,
          assignedTo:      s.name,
          assignedToEmail: s.email,
          note:            form.note,
          nextAction:      form.nextAction,
          priority:        form.priority,
          assignedBy:      profile?.name,
          assignedByEmail: user?.email,
        });

        addNotification({
          toEmail:  s.email,
          toName:   s.name,
          fromName: profile?.name,
          type:     'followup',
          message:  fullMessage,
        }).catch(() => {});

        sendFollowUpEmail({
          toEmail:     s.email,
          toName:      s.name,
          studentName: form.studentName,
          note:        form.note,
          priority:    form.priority,
          assignedBy:  profile?.name,
        }).catch(() => {});
      }));

      const names = selectedStaff.map(s => s.name).join(', ');
      setToast({ message: `Follow-up assigned to ${names}!`, type: 'success' });
      setShowModal(false);
      setForm({ studentId: '', studentName: '', staffIds: [], note: '', nextAction: '', priority: 'normal' });
      load();
    } catch (err) {
      setToast({ message: 'Failed: ' + err.message, type: 'error' });
    } finally { setSaving(false); }
  };

  const handleComplete = async () => {
    await completeFollowUp(completing.id, completionNote);
    setCompleting(null);
    setCompletionNote('');
    setToast({ message: 'Follow-up completed!', type: 'success' });
    load();
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  if (loading) return <Loading />;

  const pendingCount = followups.filter(f => !f.completed).length;
  const urgentCount  = followups.filter(f => f.priority === 'urgent' && !f.completed).length;

  return (
    <div>
      <div className="page-header">
        <h2>Follow-Up Tracker
          <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>
            ({pendingCount} pending)
          </span>
        </h2>
        {isCEOorAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Assign Follow-Up
          </button>
        )}
      </div>

      {isCEOorAdmin && (
        <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, fontSize: 12, color: '#1E40AF', marginBottom: 16, display: 'flex', gap: 8 }}>
          <Mail size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Select a staff member — their email is fetched automatically. No manual email entry needed.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input placeholder="Search student, staff, note..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-bar">
          {[
            { key: 'all',       label: 'All' },
            { key: 'pending',   label: `Pending (${pendingCount})` },
            { key: 'urgent',    label: `Urgent (${urgentCount})` },
            { key: 'completed', label: 'Completed' },
          ].map(t => (
            <div key={t.key} className={`tab ${filter === t.key ? 'active' : ''}`} onClick={() => setFilter(t.key)}>{t.label}</div>
          ))}
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              {isCEOorAdmin && <th>Assigned To</th>}
              <th>Note</th>
              <th>Priority</th>
              <th>Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>No follow-ups found.</td></tr>
            )}
            {filtered.map(f => (
              <tr key={f.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={f.studentName || '?'} size="sm" />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{f.studentName}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>by {f.assignedBy}</div>
                    </div>
                  </div>
                </td>
                {isCEOorAdmin && <td style={{ fontSize: 13 }}>{f.assignedTo || '—'}</td>}
                <td style={{ fontSize: 13, maxWidth: 220 }}>{f.note}</td>
                <td>
                  {f.priority === 'urgent' ? <span className="badge badge-red">🔴 Urgent</span>
                   : f.priority === 'high' ? <span className="badge badge-amber">🟡 High</span>
                   : <span className="badge badge-gray">Normal</span>}
                </td>
                <td style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(f.createdAt)}</td>
                <td>
                  {f.completed
                    ? <span className="badge badge-green"><CheckCircle size={11} style={{ marginRight: 3 }} />Done</span>
                    : <span className="badge badge-amber"><Clock size={11} style={{ marginRight: 3 }} />Pending</span>}
                </td>
                <td>
                  {!f.completed && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setCompleting(f)}>Log & Close</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Modal */}
      {showModal && (
        <Modal title="Assign Follow-Up" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 12, color: '#065F46' }}>
              ✅ Select a student and staff member — email is auto-fetched from their account.
            </div>
            <div className="form-group">
              <label className="form-label">Student *</label>
              <select className="form-input" required value={form.studentId}
                onChange={e => {
                  const s = students.find(s => s.id === e.target.value);
                  setForm({ ...form, studentId: e.target.value, studentName: s?.name || '' });
                }}>
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.course || ''}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assign To * <span style={{ fontWeight: 400, color: '#6B7280' }}>(select one or more)</span></label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {staff.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.staffIds.includes(s.id)} onChange={() => toggleStaff(s.id)} />
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{s.role}</span>
                  </label>
                ))}
              </div>
              {form.staffIds.length > 0 && (
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                  📧 Notifying {form.staffIds.length} staff member{form.staffIds.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Instructions *</label>
              <textarea className="form-input" rows={3} required
                placeholder="What should the staff member do?"
                value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Next Action</label>
                <input className="form-input" placeholder="e.g. Call again tomorrow"
                  value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </FormRow>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Assigning...' : <><Mail size={14} /> Assign & Notify</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Complete Modal */}
      {completing && (
        <Modal title="Log & Complete Follow-Up" onClose={() => setCompleting(null)}>
          <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontWeight: 500 }}>{completing.studentName}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{completing.note}</div>
          </div>
          <div className="form-group">
            <label className="form-label">What did you do? *</label>
            <textarea className="form-input" rows={3}
              placeholder="Called student — answered, said will attend. / Visited home — parent confirmed enrolled..."
              value={completionNote} onChange={e => setCompletionNote(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => setCompleting(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleComplete} disabled={!completionNote.trim()}>
              <CheckCircle size={14} /> Mark Complete
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}