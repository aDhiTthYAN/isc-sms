import { useEffect, useState, useRef } from 'react';
import {
  getAssessments, addAssessment, deleteAssessment,
  getBatches, getStaffProfiles, getBatchStudents,
  saveAssessmentResults, getAssessmentResults,
  addNotification, createRequest,
} from '../firebase/services';
import { Modal, Toast, Loading } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Plus, Upload, Search, ClipboardList, Trash2, Eye } from 'lucide-react';

// ── RFC-4180 CSV parser ────────────────────────────────────────
function parseCsvLine(line) {
  const fields = []; let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { fields.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
  }
  fields.push(cur.trim()); return fields;
}
function parseMarksCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g,'').trim().toLowerCase().replace(/\s+/g,''));
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line).map(v => v.replace(/^"|"$/g,'').trim());
    const obj = {};
    headers.forEach((h,i) => obj[h] = vals[i]||'');
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

// ── Helpers ────────────────────────────────────────────────────
const formatDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

const statusBadge = (status) => {
  const map = {
    upcoming:  { cls:'badge-blue',  label:'Upcoming' },
    completed: { cls:'badge-green', label:'Completed' },
  };
  const s = map[status] || { cls:'badge-gray', label: status || '—' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

// ── Component ──────────────────────────────────────────────────
export default function Assessments({ filterBatchId = null }) {
  const { profile } = useAuth();
  const isCeo = profile?.role === 'ceo';

  const [assessments,   setAssessments]   = useState([]);
  const [batches,       setBatches]       = useState([]);
  const [staffList,     setStaffList]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);
  const [saving,        setSaving]        = useState(false);
  const [resultCounts,  setResultCounts]  = useState({}); // assessmentId → count

  // Filters
  const [filterBatch,   setFilterBatch]   = useState(filterBatchId || '');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [searchTitle,   setSearchTitle]   = useState('');
  const [filterScope,   setFilterScope]   = useState('all'); // 'all' | 'batch' | 'student'

  // Create modal
  const [showCreate,    setShowCreate]    = useState(false);
  const [createForm,    setCreateForm]    = useState({
    title: '', batchId: filterBatchId || '', date: '', totalMarks: '',
    conductingStaff: [], status: 'upcoming', notes: '',
  });

  // Import marks modal
  const [showImport,    setShowImport]    = useState(null);
  const [importStep,    setImportStep]    = useState(1);
  const [importPreview, setImportPreview] = useState(null);
  const [batchStudents, setBatchStudents] = useState([]);
  const fileRef = useRef();

  // View results modal
  const [viewResults,   setViewResults]   = useState(null);
  const [results,       setResults]       = useState([]);

  // Delete confirm
  const [deleteTarget,  setDeleteTarget]  = useState(null);

  // Removal request modal
  const [removalTarget, setRemovalTarget] = useState(null); // { assessment }
  const [removalReason, setRemovalReason] = useState('');

  // ── Load ──────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const [a, b, s] = await Promise.all([
        getAssessments(filterBatchId || undefined),
        getBatches(),
        getStaffProfiles(),
      ]);
      setAssessments(a);
      setBatches(b);
      setStaffList(s.filter(x => x.active !== false));

      // Fetch result counts for all assessments in parallel
      const counts = {};
      await Promise.all(
        a.map(async (assessment) => {
          try {
            const res = await getAssessmentResults(assessment.id);
            counts[assessment.id] = res.length;
          } catch {
            counts[assessment.id] = 0;
          }
        })
      );
      setResultCounts(counts);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterBatchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived list ──────────────────────────────────────────────
  const visible = assessments.filter(a => {
    if (filterBatch  && a.batchId !== filterBatch)                              return false;
    if (filterStatus && a.status  !== filterStatus)                             return false;
    if (searchTitle  && !a.title?.toLowerCase().includes(searchTitle.toLowerCase())) return false;
    if (filterScope === 'batch'   && a.studentId)                               return false;
    if (filterScope === 'student' && !a.studentId)                              return false;
    return true;
  });

  // ── Create ────────────────────────────────────────────────────
  const toggleConductingStaff = (staffObj) => {
    setCreateForm(prev => {
      const exists = prev.conductingStaff.find(s => s.uid === staffObj.uid);
      return {
        ...prev,
        conductingStaff: exists
          ? prev.conductingStaff.filter(s => s.uid !== staffObj.uid)
          : [...prev.conductingStaff, staffObj],
      };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const batch = batches.find(b => b.id === createForm.batchId);
      const payload = {
        title:          createForm.title,
        batchId:        createForm.batchId,
        batchName:      batch?.name || '',
        date:           createForm.date,
        totalMarks:     parseFloat(createForm.totalMarks) || 0,
        conductingStaff: createForm.conductingStaff,
        status:         createForm.status,
        notes:          createForm.notes,
        createdBy:      profile?.uid || profile?.email || 'unknown',
      };
      await addAssessment(payload);

      // Notify assigned staff who are not the creator
      for (const staff of createForm.conductingStaff) {
        if (staff.uid !== profile?.uid && staff.email) {
          await addNotification({
            toEmail: staff.email,
            title:   'Assessment Assignment',
            body:    `You have been assigned to conduct "${createForm.title}" on ${createForm.date}`,
            type:    'assessment_assignment',
            read:    false,
          });
        }
      }

      setToast({ message: 'Assessment created!', type: 'success' });
      setShowCreate(false);
      setCreateForm({ title:'', batchId: filterBatchId||'', date:'', totalMarks:'', conductingStaff:[], status:'upcoming', notes:'' });
      load();
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  // ── Import marks ──────────────────────────────────────────────
  const openImport = async (assessment) => {
    setShowImport(assessment);
    setImportStep(1);
    setImportPreview(null);
    setBatchStudents([]);
    if (assessment.batchId) {
      try {
        const res = await getBatchStudents(assessment.batchId);
        setBatchStudents(res.students || []);
      } catch { }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseMarksCSV(text);
    if (!rows.length) { setToast({ message: 'CSV is empty or could not be parsed.', type: 'error' }); return; }

    const totalMarks = parseFloat(showImport?.totalMarks || '100');
    const preview = rows.map(r => {
      const phone    = (r.phone || r.phonenumber || r.mobilenumber || '').replace(/\D/g,'').slice(-10);
      const nameRaw  = r.name || r.studentname || '';
      const matched  = batchStudents.find(s => {
        const sPhone = (s.phone || s.whatsappNumber || '').replace(/\D/g,'').slice(-10);
        return (phone && sPhone === phone) || s.name?.toLowerCase() === nameRaw.toLowerCase();
      });
      const marks      = parseFloat(r.marks || r.markscored || r.score || '0') || 0;
      const percentage = totalMarks > 0 ? Math.round((marks / totalMarks) * 100 * 10) / 10 : 0;
      const pass       = marks >= totalMarks * 0.4;
      return {
        studentId:   matched?.id    || null,
        studentName: matched?.name  || nameRaw || '?',
        phone:       matched?.phone || phone   || '',
        marks,
        totalMarks,
        percentage,
        pass,
        matched: !!matched,
      };
    });
    setImportPreview(preview);
    setImportStep(3);
  };

  const handleSaveResults = async () => {
    if (!importPreview || !showImport) return;
    setSaving(true);
    try {
      const toSave = importPreview.map(r => ({
        assessmentId: showImport.id,
        batchId:      showImport.batchId,
        studentId:    r.studentId,
        studentName:  r.studentName,
        phone:        r.phone,
        marks:        r.marks,
        totalMarks:   r.totalMarks,
        percentage:   r.percentage,
        pass:         r.pass,
      }));
      await saveAssessmentResults(toSave);
      setToast({ message: `Saved ${toSave.length} results!`, type: 'success' });
      setShowImport(null);
      // Refresh result counts
      setResultCounts(prev => ({ ...prev, [showImport.id]: toSave.length }));
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  // ── View results ──────────────────────────────────────────────
  const openViewResults = async (assessment) => {
    setViewResults(assessment);
    try {
      setResults(await getAssessmentResults(assessment.id));
    } catch { setResults([]); }
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteAssessment(deleteTarget.id);
      setToast({ message: 'Assessment deleted.', type: 'success' });
      setDeleteTarget(null);
      load();
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  // ── Removal request ───────────────────────────────────────────
  const handleRemovalRequest = async () => {
    if (!removalTarget || !removalReason.trim()) return;
    setSaving(true);
    try {
      const ceoStaff = staffList.find(s => s.role === 'ceo');
      await createRequest({
        type:              'removal',
        requestedBy:       profile?.uid,
        requestedByName:   profile?.name,
        targetType:        'assessment',
        targetId:          removalTarget.assessment.id,
        targetName:        removalTarget.assessment.title,
        reason:            removalReason.trim(),
        status:            'pending',
      });
      if (ceoStaff?.email) {
        await addNotification({
          toEmail: ceoStaff.email,
          title:   'Staff Removal Request',
          body:    `${profile?.name} requested removal from assessment "${removalTarget.assessment.title}"`,
          type:    'removal_request',
          read:    false,
        });
      }
      setToast({ message: 'Removal request submitted.', type: 'success' });
      setRemovalTarget(null);
      setRemovalReason('');
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  // ── Batch name helper ─────────────────────────────────────────
  const batchName = (id) => batches.find(b => b.id === id)?.name || '—';

  // ── Staff names for a row ──────────────────────────────────────
  const staffNames = (conductingStaff) => {
    if (!conductingStaff?.length) return '—';
    return conductingStaff.map(s => s.name).join(', ');
  };

  if (loading) return <Loading />;

  return (
    <div>
      {/* Header */}
      {!filterBatchId && (
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:18 }}>
          <div>
            <h2 style={{ fontSize:24, fontWeight:700 }}>Assessments</h2>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>Manage exams, quizzes and evaluation records across all batches.</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16}/> Add Assessment
          </button>
        </div>
      )}
      {filterBatchId && (
        <div className="page-header">
          <h2><ClipboardList size={20} style={{ marginRight:8, verticalAlign:'middle' }}/>Assessments</h2>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14}/> Add Assessment</button>
        </div>
      )}

      {/* KPI tiles */}
      {!filterBatchId && (() => {
        const total = assessments.length;
        const completed = assessments.filter(a => a.status === 'completed').length;
        const scheduled = assessments.filter(a => a.status === 'upcoming').length;
        const withResults = Object.keys(resultCounts).filter(k => resultCounts[k] > 0).length;
        const tiles = [
          { label:'Total Assessments', value: total,       hero: true },
          { label:'Completed',         value: completed,   color:'var(--green-ink)' },
          { label:'Scheduled',         value: scheduled,   color:'var(--blue-ink)' },
          { label:'With Results',      value: withResults, color:'var(--amber-ink)' },
        ];
        return (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:18 }}>
            {tiles.map(t => (
              <div key={t.label} className={t.hero ? '' : 'card'} style={t.hero
                ? { background:'var(--grad-brand)', borderRadius:14, padding:'16px 20px', color:'#fff', boxShadow:'var(--shadow-md)' }
                : { padding:'16px 20px' }}>
                <div style={{ fontSize:12, color: t.hero ? 'rgba(255,255,255,.85)' : 'var(--text-muted)' }}>{t.label}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:700, lineHeight:1, marginTop:8, color: t.hero ? '#fff' : t.color }}>{t.value}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Scope pills */}
      {!filterBatchId && (
        <div className="segmented" style={{ marginBottom:14 }}>
          {[
            { key:'all',     label:'All' },
            { key:'batch',   label:'Batch' },
            { key:'student', label:'Student' },
          ].map(t => (
            <button key={t.key} className={filterScope === t.key ? 'active' : ''} onClick={() => setFilterScope(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
        <div style={{ position:'relative', flex:'1 1 200px', minWidth:160 }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF' }}/>
          <input
            className="form-input"
            style={{ paddingLeft:32, height:36 }}
            placeholder="Search by title…"
            value={searchTitle}
            onChange={e => setSearchTitle(e.target.value)}
          />
        </div>
        {!filterBatchId && (
          <select className="form-input" style={{ flex:'1 1 160px', minWidth:140, height:36 }}
            value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
            <option value="">All Batches</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select className="form-input" style={{ flex:'0 0 140px', height:36 }}
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Batch / Student</th>
              <th>Date</th>
              <th>Total Marks</th>
              <th>Conducting Staff</th>
              <th>Status</th>
              <th>Results</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign:'center', color:'#9CA3AF', padding:40 }}>
                  No assessments found.
                </td>
              </tr>
            )}
            {visible.map(a => {
              const myEntry = a.conductingStaff?.find(s => s.uid === profile?.uid);
              return (
                <tr key={a.id}>
                  <td style={{ fontWeight:600 }}>{a.title}</td>
                  <td>
                    <span className={`badge ${a.studentId ? 'badge-violet' : 'badge-blue'}`} style={{ fontSize:10 }}>
                      {a.studentId ? 'Student' : 'Batch'}
                    </span>
                  </td>
                  <td style={{ color:'#6B7280', fontSize:12 }}>
                    {a.studentId ? (a.studentName || '—') : (a.batchName || batchName(a.batchId))}
                  </td>
                  <td style={{ color:'#6B7280' }}>{formatDate(a.date)}</td>
                  <td style={{ color:'#6B7280' }}>{a.totalMarks}</td>
                  <td style={{ color:'#6B7280', fontSize:12, maxWidth:180 }}>
                    {a.conductingStaff?.length ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {a.conductingStaff.map(s => (
                          <span key={s.uid} style={{ display:'flex', alignItems:'center', gap:4 }}>
                            {s.name}
                            {s.uid === profile?.uid && (
                              <button
                                title="Request removal from this assessment"
                                onClick={() => setRemovalTarget({ assessment: a })}
                                style={{ fontSize:10, padding:'1px 6px', background:'#FEE2E2', color:'#B91C1C',
                                  border:'none', borderRadius:10, cursor:'pointer', fontWeight:600, lineHeight:1.4 }}>
                                Remove me
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : '—'}
                  </td>
                  <td>{statusBadge(a.status)}</td>
                  <td style={{ color:'#6B7280', fontSize:13 }}>
                    {resultCounts[a.id] !== undefined ? resultCounts[a.id] : '—'}
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => openViewResults(a)}>
                        <Eye size={12}/> Results
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background:'#EDE9FE', color:'#6D28D9', border:'none' }}
                        onClick={() => openImport(a)}>
                        <Upload size={12}/> Import
                      </button>
                      {isCeo && (
                        <button
                          className="btn btn-sm"
                          style={{ background:'#FEE2E2', color:'#B91C1C', border:'none' }}
                          onClick={() => setDeleteTarget(a)}>
                          <Trash2 size={12}/>
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

      {/* ── Create Assessment Modal ── */}
      {showCreate && (
        <Modal title="Create Assessment" onClose={() => setShowCreate(false)} wide>
          <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" required placeholder="e.g. Mid-term Assessment"
                value={createForm.title}
                onChange={e => setCreateForm({ ...createForm, title: e.target.value })}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Batch *</label>
                <select className="form-input" required value={createForm.batchId}
                  onChange={e => setCreateForm({ ...createForm, batchId: e.target.value })}>
                  <option value="">Select Batch</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input className="form-input" type="date" required value={createForm.date}
                  onChange={e => setCreateForm({ ...createForm, date: e.target.value })}/>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Total Marks *</label>
                <input className="form-input" type="number" required min="1" placeholder="100"
                  value={createForm.totalMarks}
                  onChange={e => setCreateForm({ ...createForm, totalMarks: e.target.value })}/>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={createForm.status}
                  onChange={e => setCreateForm({ ...createForm, status: e.target.value })}>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Conducting Staff</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:10, background:'#F9FAFB',
                borderRadius:8, border:'1px solid #E5E7EB', minHeight:48 }}>
                {staffList.filter(s => s.role !== 'ceo').map(s => {
                  const selected = createForm.conductingStaff.some(x => x.uid === s.id);
                  return (
                    <div key={s.id}
                      onClick={() => toggleConductingStaff({ uid: s.id, name: s.name, phone: s.phone||'', email: s.email||'' })}
                      style={{
                        padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:500,
                        background: selected ? '#E53935' : '#fff',
                        color:      selected ? '#fff'    : '#374151',
                        border: `1px solid ${selected ? '#E53935' : '#E5E7EB'}`,
                      }}>
                      {s.name} ({s.phone || 'no phone'})
                    </div>
                  );
                })}
                {staffList.filter(s => s.role !== 'ceo').length === 0 && (
                  <span style={{ fontSize:12, color:'#9CA3AF' }}>No staff available.</span>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={3} placeholder="Any additional notes…"
                value={createForm.notes}
                onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}/>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create Assessment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Import Marks Modal ── */}
      {showImport && (
        <Modal title={`Import Marks — ${showImport.title}`} onClose={() => setShowImport(null)} wide>
          {/* Step indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20 }}>
            {[1,2,3].map(n => (
              <span key={n} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{
                  width:26, height:26, borderRadius:'50%', display:'inline-flex',
                  alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700,
                  background: importStep >= n ? '#E53935' : '#E5E7EB',
                  color:      importStep >= n ? '#fff'    : '#9CA3AF',
                }}>
                  {n}
                </span>
                <span style={{ fontSize:12, color: importStep >= n ? '#111827' : '#9CA3AF' }}>
                  {['Confirm', 'Upload CSV', 'Preview & Save'][n-1]}
                </span>
                {n < 3 && <span style={{ color:'#D1D5DB', fontSize:16 }}>›</span>}
              </span>
            ))}
          </div>

          {/* Step 1 – Confirm */}
          {importStep === 1 && (
            <div>
              <div style={{ padding:'12px 16px', background:'#EFF6FF', borderRadius:8, fontSize:13,
                color:'#1E40AF', marginBottom:16, lineHeight:1.7 }}>
                <strong>Assessment:</strong> {showImport.title}<br/>
                <strong>Batch:</strong> {showImport.batchName || batchName(showImport.batchId)}<br/>
                <strong>Total Marks:</strong> {showImport.totalMarks} &nbsp;|&nbsp;
                <strong>Pass threshold:</strong> 40%
              </div>
              <p style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>
                Upload a CSV with columns: <code>Name, Phone, Marks</code>.<br/>
                Students will be matched by phone number first, then by name.
              </p>
              <button className="btn btn-primary" onClick={() => setImportStep(2)}>Continue to Upload</button>
            </div>
          )}

          {/* Step 2 – Upload */}
          {importStep === 2 && (
            <div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
                onChange={handleCSVUpload}/>
              <div onClick={() => fileRef.current?.click()} style={{
                border:'2px dashed #E5E7EB', borderRadius:10, padding:'40px 20px',
                textAlign:'center', cursor:'pointer', background:'#FAFAFA',
              }}>
                <Upload size={32} style={{ color:'#D1D5DB', marginBottom:10 }}/>
                <div style={{ fontSize:13, fontWeight:600, color:'#374151' }}>
                  Click to choose a CSV file
                </div>
                <div style={{ fontSize:12, color:'#9CA3AF', marginTop:4 }}>
                  Columns: Name, Phone, Marks
                </div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
                <button className="btn btn-ghost" onClick={() => setImportStep(1)}>Back</button>
              </div>
            </div>
          )}

          {/* Step 3 – Preview */}
          {importStep === 3 && importPreview && (
            <div>
              <div style={{ marginBottom:12, fontSize:13, color:'#374151', display:'flex', gap:16 }}>
                <span><strong>{importPreview.filter(r => r.pass).length}</strong> Pass</span>
                <span><strong>{importPreview.filter(r => !r.pass).length}</strong> Fail</span>
                <span><strong>{importPreview.filter(r => !r.matched).length}</strong> Unmatched</span>
                <span><strong>{importPreview.length}</strong> Total</span>
              </div>
              <div style={{ maxHeight:340, overflowY:'auto', border:'1px solid #E5E7EB', borderRadius:8, marginBottom:16 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#F8FAFC', position:'sticky', top:0 }}>
                      {['Name','Phone','Marks','%','Pass/Fail','Matched'].map(h => (
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700,
                          color:'#6B7280', textTransform:'uppercase', borderBottom:'1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r, i) => (
                      <tr key={i} style={{ background: r.matched ? (r.pass ? '#F0FDF4' : '#FFF8F8') : '#FFFBEB' }}>
                        <td style={{ padding:'8px 12px', fontWeight:500 }}>{r.studentName}</td>
                        <td style={{ padding:'8px 12px', color:'#6B7280' }}>{r.phone||'—'}</td>
                        <td style={{ padding:'8px 12px', fontWeight:600 }}>{r.marks}</td>
                        <td style={{ padding:'8px 12px', color:'#6B7280' }}>{r.percentage}%</td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{ fontWeight:700, color: r.pass ? '#10B981' : '#EF4444' }}>
                            {r.pass ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:600,
                            background: r.matched ? '#D1FAE5' : '#FEF3C7',
                            color:      r.matched ? '#065F46' : '#92400E' }}>
                            {r.matched ? 'Matched' : 'No match'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => { setImportStep(2); if (fileRef.current) fileRef.current.value=''; }}>
                  Re-upload
                </button>
                <button className="btn btn-primary" disabled={saving} onClick={handleSaveResults}>
                  {saving ? 'Saving…' : `Save ${importPreview.length} Results`}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── View Results Modal ── */}
      {viewResults && (
        <Modal title={`Results — ${viewResults.title}`} onClose={() => setViewResults(null)} wide>
          {results.length === 0 ? (
            <div style={{ textAlign:'center', color:'#9CA3AF', padding:40 }}>
              No results imported yet.
            </div>
          ) : (
            <>
              <div style={{ marginBottom:12, fontSize:13, color:'#374151', display:'flex', gap:16 }}>
                <span><strong>{results.filter(r => r.pass).length}</strong> Pass</span>
                <span><strong>{results.filter(r => !r.pass).length}</strong> Fail</span>
                <span><strong>{results.length}</strong> Total</span>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Phone</th>
                      <th>Marks</th>
                      <th>%</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={r.id || i}>
                        <td style={{ color:'#9CA3AF', fontSize:12 }}>{i + 1}</td>
                        <td style={{ fontWeight:600 }}>{r.studentName}</td>
                        <td style={{ color:'#6B7280' }}>{r.phone || '—'}</td>
                        <td><strong>{r.marks}</strong> / {r.totalMarks}</td>
                        <td style={{ color:'#6B7280' }}>{r.percentage !== undefined ? r.percentage + '%' : Math.round((r.marks / r.totalMarks) * 100) + '%'}</td>
                        <td>
                          <span style={{ fontWeight:700, color: r.pass ? '#10B981' : '#EF4444' }}>
                            {r.pass ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <Modal title="Delete Assessment" onClose={() => setDeleteTarget(null)}>
          <p style={{ fontSize:14, color:'#374151', marginBottom:20 }}>
            Are you sure you want to delete <strong>"{deleteTarget.title}"</strong>? This cannot be undone.
          </p>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="btn" style={{ background:'#EF4444', color:'#fff', border:'none' }}
              disabled={saving} onClick={handleDelete}>
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Staff Removal Request Modal ── */}
      {removalTarget && (
        <Modal title="Request Removal from Assessment" onClose={() => { setRemovalTarget(null); setRemovalReason(''); }}>
          <p style={{ fontSize:14, color:'#374151', marginBottom:12 }}>
            Request to be removed from conducting <strong>"{removalTarget.assessment.title}"</strong>.
          </p>
          <div className="form-group">
            <label className="form-label">Reason *</label>
            <textarea className="form-input" rows={3} required
              placeholder="Briefly explain why you need to be removed…"
              value={removalReason}
              onChange={e => setRemovalReason(e.target.value)}/>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
            <button className="btn btn-ghost" onClick={() => { setRemovalTarget(null); setRemovalReason(''); }}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !removalReason.trim()} onClick={handleRemovalRequest}>
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
