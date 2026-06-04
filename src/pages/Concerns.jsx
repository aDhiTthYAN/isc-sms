import { useEffect, useState } from 'react';
import {
  getConcerns, addConcern, updateConcern,
  getStudents, getStaffProfiles, addNotification
} from '../firebase/services';
import { sendConcernEmail } from '../firebase/emailService';
import { Modal, Toast, Loading, FormRow } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Mail } from 'lucide-react';

const CONCERN_TYPES = [
  'Fee Issue','Attendance Issue','Technical Issue',
  'Course Doubt','Personal Concern','Weak Subject','Other'
];
const TYPE_COLORS = {
  'Fee Issue':        { bg:'#FEE2E2', color:'#991B1B', emoji:'💳' },
  'Attendance Issue': { bg:'#FEF3C7', color:'#92400E', emoji:'📅' },
  'Technical Issue':  { bg:'#DBEAFE', color:'#1E40AF', emoji:'💻' },
  'Course Doubt':     { bg:'#EDE9FE', color:'#5B21B6', emoji:'📚' },
  'Personal Concern': { bg:'#FCE7F3', color:'#9D174D', emoji:'❤️' },
  'Weak Subject':     { bg:'#FEF3C7', color:'#92400E', emoji:'⚠️' },
  'Other':            { bg:'#F3F4F6', color:'#374151', emoji:'📌' },
};

export default function Concerns() {
  const { profile, user } = useAuth();
  const [concerns, setConcerns]   = useState([]);
  const [students, setStudents]   = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({
    studentId:'', type:'', description:'',
    assignedTo:'', assignedToEmail:'', status:'open'
  });

  const load = async () => {
    const [c, s, st] = await Promise.all([
      getConcerns(), getStudents(), getStaffProfiles()
    ]);
    setConcerns(c);
    setStudents(s);
    setStaffList(st.filter(x => x.active !== false));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = concerns.filter(c => {
    const q = search.toLowerCase();
    const matchQ = !q ||
      c.studentName?.toLowerCase().includes(q) ||
      c.type?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q);
    const matchS = !statusFilter || c.status === statusFilter;
    return matchQ && matchS;
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const stu = students.find(s => s.id === form.studentId);
      const assignedStaff = staffList.find(s => s.id === form.assignedTo);

      await addConcern({
        ...form,
        studentName:     stu?.name || '',
        assignedTo:      assignedStaff?.name || '',
        assignedToEmail: assignedStaff?.email || '',
        raisedBy:        profile?.name || '',
        raisedByEmail:   user?.email || '',
      });

      // Send in-app notification if assigned to a staff
      if (assignedStaff?.email) {
        await addNotification({
          toEmail:  assignedStaff.email,
          toName:   assignedStaff.name,
          fromName: profile?.name,
          type:     'concern',
          message:  `Concern raised for student "${stu?.name}" — ${form.type}: ${form.description.slice(0, 80)}`,
        });

        // Send email notification
        await sendConcernEmail({
          toEmail:     assignedStaff.email,
          toName:      assignedStaff.name,
          studentName: stu?.name || '',
          concernType: form.type,
          description: form.description,
          assignedBy:  profile?.name,
        });
      }

      setToast({
        message: assignedStaff
          ? `Concern logged and ${assignedStaff.name} notified!`
          : 'Concern logged!',
        type:'success'
      });
      setShowModal(false);
      setForm({ studentId:'', type:'', description:'', assignedTo:'', assignedToEmail:'', status:'open' });
      load();
    } catch (err) {
      setToast({ message:'Failed: ' + err.message, type:'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (concern) => {
    const next = concern.status === 'open' ? 'resolved' : 'open';
    await updateConcern(concern.id, { status: next });
    load();
  };

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  };

  // Summary counts
  const counts = {};
  CONCERN_TYPES.forEach(t => { counts[t] = concerns.filter(c => c.type === t).length; });

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h2>Student Concerns
          <span style={{ fontSize:14, color:'#6B7280', fontWeight:400, marginLeft:8 }}>
            ({filtered.length})
          </span>
        </h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Log Concern
        </button>
      </div>

      {/* Summary pills */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
        {CONCERN_TYPES.map(t => {
          const s = TYPE_COLORS[t] || TYPE_COLORS['Other'];
          if (!counts[t]) return null;
          return (
            <div key={t} style={{ padding:'5px 12px', borderRadius:20, background:s.bg, color:s.color, fontSize:12, fontWeight:600, display:'flex', gap:5, alignItems:'center', cursor:'pointer' }}
              onClick={() => setSearch(t.toLowerCase().split(' ')[0])}>
              {s.emoji} {t}
              <span style={{ background:s.color, color:'#fff', borderRadius:10, padding:'0 6px', fontSize:11 }}>{counts[t]}</span>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <div className="search-bar" style={{ flex:1 }}>
          <Search size={15} style={{ color:'var(--muted)', flexShrink:0 }} />
          <input placeholder="Search student, type, description..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width:160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Concern cards */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign:'center', color:'#6B7280', padding:40 }}>
            No concerns found.
          </div>
        )}
        {filtered.map(c => {
          const style = TYPE_COLORS[c.type] || TYPE_COLORS['Other'];
          return (
            <div key={c.id} className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:14 }}>
              <div style={{ width:40, height:40, borderRadius:10, background:style.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                {style.emoji}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontWeight:600, fontSize:14 }}>{c.type} — {c.studentName}</span>
                  <span style={{ fontSize:11, color:'#9CA3AF' }}>{formatDate(c.createdAt)}</span>
                </div>
                <p style={{ fontSize:13, color:'#374151', lineHeight:1.5 }}>{c.description}</p>
                <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap', alignItems:'center' }}>
                  <span className={`badge ${c.status==='resolved'?'badge-green':c.status==='in-progress'?'badge-amber':'badge-red'}`}>
                    {c.status==='in-progress'?'In Progress':c.status.charAt(0).toUpperCase()+c.status.slice(1)}
                  </span>
                  <span className={`badge`} style={{ background:style.bg, color:style.color }}>{c.type}</span>
                  {c.assignedTo && (
                    <span className="badge badge-blue">👤 {c.assignedTo}</span>
                  )}
                  {c.raisedBy && (
                    <span style={{ fontSize:11, color:'#9CA3AF' }}>raised by {c.raisedBy}</span>
                  )}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(c)}>
                {c.status === 'resolved' ? 'Reopen' : 'Resolve'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Log Concern Modal */}
      {showModal && (
        <Modal title="Log Student Concern" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ padding:'8px 12px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', display:'flex', gap:6 }}>
              <Mail size={13} style={{ flexShrink:0, marginTop:1 }} />
              If you assign this to a staff member, they will be notified via email + in-app notification.
            </div>
            <div className="form-group">
              <label className="form-label">Student *</label>
              <select className="form-input" required value={form.studentId}
                onChange={e => setForm({...form, studentId:e.target.value})}>
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Concern Type *</label>
                <select className="form-input" required value={form.type}
                  onChange={e => setForm({...form, type:e.target.value})}>
                  <option value="">Select type</option>
                  {CONCERN_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assign To (Staff)</label>
                <select className="form-input" value={form.assignedTo}
                  onChange={e => setForm({...form, assignedTo:e.target.value})}>
                  <option value="">No assignment</option>
                  {staffList.filter(s => s.role !== 'ceo').map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
                {form.assignedTo && (
                  <div style={{ fontSize:11, color:'#065F46', marginTop:3 }}>
                    📧 Will notify: {staffList.find(s=>s.id===form.assignedTo)?.email}
                  </div>
                )}
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea className="form-input" rows={3} required
                placeholder="Describe the concern in detail..."
                value={form.description} onChange={e => setForm({...form, description:e.target.value})} />
            </div>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status}
                  onChange={e => setForm({...form, status:e.target.value})}>
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </FormRow>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Logging...' : <><Mail size={14}/> Log & Notify</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}