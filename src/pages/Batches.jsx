import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBatches, addBatch, updateBatch, getStudentsPaged, addStudent, bulkAddStudents, getBatchStudentCount, getStaffProfiles } from '../firebase/services';
import { Modal, Toast, Loading, FormRow, Avatar, StatusBadge } from '../components/ui';
import { Plus, Users, Upload, UserPlus, ChevronRight, ArrowLeft, Download } from 'lucide-react';

const COURSES = ['Python', 'Data Science', 'Web Development', 'Machine Learning', 'Digital Marketing', 'UI/UX Design', 'Cyber Security', 'Other'];
const STATUSES = ['active', 'moderate', 'at-risk', 'dropped'];

// Parse CSV text into array of objects
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g,''));
    if (vals.every(v => !v)) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

function downloadTemplate(batchName) {
  const headers = ['name','phone','parentPhone','email','education','location','staffAssigned','classplusId','status'];
  const example = ['Fathima Aysha','+91 98432 11234','+91 94432 98765','fathima@email.com','B.Sc CS','Kochi','Priya S.','CP-2401','active'];
  const csv = headers.join(',') + '\n' + example.join(',');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${batchName || 'batch'}_students_template.csv`;
  a.click();
}

export default function Batches() {
  const navigate = useNavigate();
  const [batches, setBatches]           = useState([]);
  const [staffList, setStaffList]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null); // batch being viewed
  const [batchStudents, setBatchStudents] = useState([]);
  const [batchCounts, setBatchCounts]   = useState({}); // batchId → count
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [toast, setToast]               = useState(null);
  const [saving, setSaving]             = useState(false);
  const [csvPreview, setCsvPreview]     = useState(null);
  const [importing, setImporting]       = useState(false);
  const fileRef = useRef();
  const [createForm, setCreateForm] = useState({
    name: '', course: '', mentor: '', startDate: '', endDate: '', status: 'upcoming', maxSeats: '', courseDurationMonths: ''
  });
  const [studentForm, setStudentForm] = useState({
    name: '', phone: '', parentPhone: '', email: '',
    education: '', location: '', staffAssigned: '',
    classplusId: '', status: 'active',
  });

  const loadBatches = async () => {
    const [b, s] = await Promise.all([getBatches(), getStaffProfiles()]);
    setBatches(b);
    setStaffList(s.filter(s => s.active !== false));
    // Load student counts for each batch
    const counts = {};
    await Promise.all(b.map(async batch => {
      counts[batch.id] = await getBatchStudentCount(batch.id);
    }));
    setBatchCounts(counts);
    setLoading(false);
  };

  const loadBatchStudents = async (batchId) => {
    const result = await getStudentsPaged({ batchId });
    setBatchStudents(result.students);
  };

  useEffect(() => { loadBatches(); }, []);

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setSaving(true);
    await addBatch(createForm);
    setToast({ message: `Batch "${createForm.name}" created! Now add students to it.`, type: 'success' });
    setShowCreateModal(false);
    setCreateForm({ name: '', course: '', mentor: '', startDate: '', endDate: '', status: 'upcoming', maxSeats: '', courseDurationMonths: '' });
    await loadBatches();
    setSaving(false);
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    await addStudent({
      ...studentForm,
      batchId: selectedBatch.id,
      batchName: selectedBatch.name,
      course: selectedBatch.course,
      courseDurationMonths:
      selectedBatch.courseDurationMonths || '',
    });
    setToast({ message: 'Student added to batch!', type: 'success' });
    setShowAddStudentModal(false);
    setStudentForm({ name: '', phone: '', parentPhone: '', email: '', education: '', location: '', staffAssigned: '', classplusId: '', status: 'active' });
    await loadBatchStudents(selectedBatch.id);
    const count = await getBatchStudentCount(selectedBatch.id);
    setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: count }));
    setSaving(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    setCsvPreview(rows);
  };

  const handleBulkImport = async () => {
    if (!csvPreview || !selectedBatch) return;
    setImporting(true);
    const students = csvPreview.map(row => ({
      name:          row.name || '',
      phone:         row.phone || '',
      parentPhone:   row.parentphone || '',
      email:         row.email || '',
      education:     row.education || '',
      location:      row.location || '',
      staffAssigned: row.staffassigned || '',
      classplusId:   row.classplusid || '',
      status:        row.status || 'active',
      batchId:       selectedBatch.id,
      batchName:     selectedBatch.name,
      course:        selectedBatch.course,
    }));
    const results = await bulkAddStudents(students);
    setToast({ message: `Imported ${results.success} students into ${selectedBatch.name}!`, type: 'success' });
    setShowBulkModal(false);
    setCsvPreview(null);
    setImporting(false);
    await loadBatchStudents(selectedBatch.id);
    const count = await getBatchStudentCount(selectedBatch.id);
    setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: count }));
  };

  const openBatch = async (batch) => {
    setSelectedBatch(batch);
    await loadBatchStudents(batch.id);
  };

  const progress = (batch) => {
    const start = batch.startDate ? new Date(batch.startDate) : null;
    const end   = batch.endDate   ? new Date(batch.endDate)   : null;
    if (!start || !end) return 0;
    return Math.min(100, Math.max(0, Math.round((new Date() - start) / (end - start) * 100)));
  };

  if (loading) return <Loading />;

  // ── BATCH DETAIL VIEW ─────────────────────────────────────────
  if (selectedBatch) {
    const count = batchCounts[selectedBatch.id] || 0;
    const pct   = progress(selectedBatch);
    return (
      <div>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedBatch(null)}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2>{selectedBatch.name}</h2>
              <div style={{ fontSize: 13, color: '#6B7280' }}>{selectedBatch.course} · {count} students</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setShowBulkModal(true)}>
              <Upload size={15} /> Bulk Import CSV
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddStudentModal(true)}>
              <UserPlus size={15} /> Add Student
            </button>
          </div>
        </div>

        {/* Batch info strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Students', value: count,                                              color: '#3B82F6', bg: '#DBEAFE' },
            { label: 'Active',         value: batchStudents.filter(s=>s.status==='active').length, color: '#10B981', bg: '#D1FAE5' },
            { label: 'At Risk',        value: batchStudents.filter(s=>s.status==='at-risk').length,color: '#EF4444', bg: '#FEE2E2' },
            { label: 'Progress',       value: `${pct}%`,                                          color: '#E53935', bg: '#FEE2E2' },
          ].map(card => (
            <div key={card.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Students in this batch */}
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Student</th><th>Phone</th><th>Staff Assigned</th><th>ClassPlus ID</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {batchStudents.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 12 }}>
                      No students in this batch yet.
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button className="btn btn-ghost" onClick={() => setShowBulkModal(true)}>
                        <Upload size={14} /> Bulk Import CSV
                      </button>
                      <button className="btn btn-primary" onClick={() => setShowAddStudentModal(true)}>
                        <UserPlus size={14} /> Add Manually
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {batchStudents.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={s.name} size="sm" />
                      <div>
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>{s.location}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>{s.phone || '—'}</td>
                  <td style={{ fontSize: 13 }}>{s.staffAssigned || '—'}</td>
                  <td style={{ fontSize: 13, color: '#6B7280' }}>{s.classplusId || '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>
                      View <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add single student modal */}
        {showAddStudentModal && (
          <Modal title={`Add Student to ${selectedBatch.name}`} onClose={() => setShowAddStudentModal(false)} wide>
            <div style={{ padding: '8px 12px', background: '#EFF6FF', borderRadius: 8, fontSize: 12, color: '#1E40AF', marginBottom: 14 }}>
              This student will be automatically added to <strong>{selectedBatch.name}</strong> ({selectedBatch.course}). No need to select batch.
            </div>
            <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormRow>
                <div className="form-group"><label className="form-label">Full Name *</label><input className="form-input" required value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Phone *</label><input className="form-input" required value={studentForm.phone} onChange={e => setStudentForm({...studentForm, phone: e.target.value})} /></div>
              </FormRow>
              <FormRow>
                <div className="form-group"><label className="form-label">Parent Phone</label><input className="form-input" value={studentForm.parentPhone} onChange={e => setStudentForm({...studentForm, parentPhone: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={studentForm.email} onChange={e => setStudentForm({...studentForm, email: e.target.value})} /></div>
              </FormRow>
              <FormRow>
                <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={studentForm.location} onChange={e => setStudentForm({...studentForm, location: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Education</label><input className="form-input" value={studentForm.education} onChange={e => setStudentForm({...studentForm, education: e.target.value})} /></div>
              </FormRow>
              <FormRow>
                <div className="form-group">
                  <label className="form-label">Staff Assigned</label>
                  <select className="form-input" value={studentForm.staffAssigned} onChange={e => setStudentForm({...studentForm, staffAssigned: e.target.value})}>
                    <option value="">Select staff</option>
                    {staffList.map(s => <option key={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">ClassPlus ID</label><input className="form-input" value={studentForm.classplusId} onChange={e => setStudentForm({...studentForm, classplusId: e.target.value})} /></div>
              </FormRow>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddStudentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding...' : 'Add to Batch'}</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Bulk import modal */}
        {showBulkModal && (
          <Modal title={`Bulk Import into ${selectedBatch.name}`} onClose={() => { setShowBulkModal(false); setCsvPreview(null); }} wide>
            <div style={{ padding: '8px 12px', background: '#EFF6FF', borderRadius: 8, fontSize: 12, color: '#1E40AF', marginBottom: 14 }}>
              All imported students will be automatically placed in <strong>{selectedBatch.name}</strong>. No need to add batch column in CSV.
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }} onClick={() => downloadTemplate(selectedBatch.name)}>
              <Download size={13} /> Download CSV Template
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileSelect} />
            <div
              onClick={() => fileRef.current.click()}
              style={{ border: '2px dashed #E5E7EB', borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#FAFAFA', marginBottom: 14 }}
            >
              <Upload size={24} style={{ color: '#9CA3AF', marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 500 }}>{csvPreview ? `${csvPreview.length} rows loaded — ready to import` : 'Click to upload CSV file'}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Required columns: name, phone — everything else is optional</div>
            </div>
            {csvPreview && (
              <div className="table-container" style={{ maxHeight: 200, overflow: 'auto', marginBottom: 14 }}>
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Staff</th><th>Status</th></tr></thead>
                  <tbody>
                    {csvPreview.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        <td style={{ color: '#9CA3AF' }}>{i+1}</td>
                        <td style={{ fontWeight: 500 }}>{row.name}</td>
                        <td>{row.phone}</td>
                        <td>{row.staffassigned || '—'}</td>
                        <td><span className="badge badge-green">{row.status || 'active'}</span></td>
                      </tr>
                    ))}
                    {csvPreview.length > 10 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6B7280', padding: 8 }}>...and {csvPreview.length - 10} more</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowBulkModal(false); setCsvPreview(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkImport} disabled={!csvPreview || importing}>
                {importing ? 'Importing...' : `Import ${csvPreview?.length || 0} Students`}
              </button>
            </div>
          </Modal>
        )}

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ── BATCH LIST VIEW ──────────────────────────────────────────
  const grouped = { active: [], upcoming: [], completed: [] };
  batches.forEach(b => { (grouped[b.status] || grouped.completed).push(b); });

  return (
    <div>
      <div className="page-header">
        <h2>Batch Management</h2>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> Create Batch
        </button>
      </div>

      <div style={{ padding: '10px 14px', background: '#F0FDF4', borderRadius: 8, fontSize: 12, color: '#065F46', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Users size={14} />
        <strong>New flow:</strong> Create a batch first → then click the batch → add students manually or via CSV import. Students are automatically placed in that batch.
      </div>

      {batches.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>No batches yet. Create your first batch to get started.</div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={16} /> Create First Batch</button>
        </div>
      )}

      {['active', 'upcoming', 'completed'].map(group => {
        if (!grouped[group].length) return null;
        return (
          <div key={group} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              {group} ({grouped[group].length})
            </h3>
            <div className="grid-3">
              {grouped[group].map(b => {
                const count = batchCounts[b.id] || 0;
                const pct   = progress(b);
                return (
                  <div key={b.id} className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                    onClick={() => openBatch(b)}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{b.course}</div>
                      </div>
                      <span className={`badge ${b.status === 'active' ? 'badge-green' : b.status === 'upcoming' ? 'badge-blue' : 'badge-gray'}`}>{b.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 12 }}>
                      <div><span style={{ color: '#6B7280' }}>Students:</span> <strong>{count}</strong></div>
                      <div><span style={{ color: '#6B7280' }}>Mentor:</span> {b.mentor || '—'}</div>
                    </div>
                    {b.startDate && <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>📅 {b.startDate} → {b.endDate || '?'}</div>}
                    {b.status === 'active' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF', marginBottom: 3 }}>
                          <span>Progress</span><span>{pct}%</span>
                        </div>
                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%`, background: '#E53935' }} /></div>
                      </div>
                    )}
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12, color: '#E53935', display: 'flex', alignItems: 'center', gap: 4 }}>
                      Click to view students &amp; add more <ChevronRight size={13} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Create Batch Modal */}
      {showCreateModal && (
        <Modal title="Create New Batch" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Batch Name *</label>
              <input className="form-input" required placeholder="e.g. Python Batch A — June 2026"
                value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} />
            </div>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Course *</label>
                <select className="form-input" required value={createForm.course} onChange={e => setCreateForm({ ...createForm, course: e.target.value })}>
                  <option value="">Select</option>
                  {COURSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Mentor</label>
                <select className="form-input" value={createForm.mentor} onChange={e => setCreateForm({ ...createForm, mentor: e.target.value })}>
                  <option value="">Select staff</option>
                  {staffList.map(s => <option key={s.id}>{s.name}</option>)}
                </select>
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={createForm.startDate} onChange={e => setCreateForm({ ...createForm, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="form-input" type="date" value={createForm.endDate} onChange={e => setCreateForm({ ...createForm, endDate: e.target.value })} />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Max Seats</label>
                <input className="form-input" type="number" placeholder="e.g. 60" value={createForm.maxSeats} onChange={e => setCreateForm({ ...createForm, maxSeats: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={createForm.status} onChange={e => setCreateForm({ ...createForm, status: e.target.value })}>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Course Duration (months) *</label>
              <input
                className="form-input"
                type="number"
                required
                placeholder="e.g. 6 — this sets the default subscription length for all students in this batch"
                value={createForm.courseDurationMonths}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    courseDurationMonths: e.target.value
                  })
                }
              />
              <div
                style={{
                  fontSize: 11,
                  color: '#6B7280',
                  marginTop: 4
                }}
              >
                Each student's subscription validity = their personal join date + this duration
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Batch'}</button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
