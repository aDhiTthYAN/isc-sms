import { useEffect, useState, useRef } from 'react';
import {
  getTopLevelAssessments, addTopLevelAssessment,
  getBatches, getStaffProfiles, getBatchStudents,
  saveAssessmentResult, getAssessmentResults,
  addNotification,
} from '../firebase/services';
import { Modal, Toast, Loading } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Plus, Upload, Search, ClipboardList } from 'lucide-react';

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

export default function Assessments() {
  const { profile } = useAuth();
  const [assessments,  setAssessments]  = useState([]);
  const [batches,      setBatches]      = useState([]);
  const [staffList,    setStaffList]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState(null);
  const [saving,       setSaving]       = useState(false);

  // Create modal
  const [showCreate,   setShowCreate]   = useState(false);
  const [createForm,   setCreateForm]   = useState({
    title: '', batchId: '', date: '', totalMarks: '', conductingStaffIds: [],
  });

  // Import marks modal
  const [showImport,   setShowImport]   = useState(null); // assessment object
  const [importStep,   setImportStep]   = useState(1);
  const [csvRows,      setCsvRows]      = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [batchStudents, setBatchStudents] = useState([]);
  const fileRef = useRef();

  // View results
  const [viewResults,  setViewResults]  = useState(null); // assessment object
  const [results,      setResults]      = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b, s] = await Promise.all([
        getTopLevelAssessments(), getBatches(), getStaffProfiles()
      ]);
      setAssessments(a); setBatches(b); setStaffList(s.filter(x => x.active !== false));
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleConductingStaff = (uid) => {
    setCreateForm(prev => ({
      ...prev,
      conductingStaffIds: prev.conductingStaffIds.includes(uid)
        ? prev.conductingStaffIds.filter(x => x !== uid)
        : [...prev.conductingStaffIds, uid],
    }));
  };

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const batch = batches.find(b => b.id === createForm.batchId);
      const conductingStaff = staffList.filter(s => createForm.conductingStaffIds.includes(s.id));
      await addTopLevelAssessment({
        ...createForm,
        batchName: batch?.name || '',
        conductingStaffNames: conductingStaff.map(s => s.name),
        createdBy: profile?.uid,
        createdByName: profile?.name,
      });
      // Notify conducting staff who are not the creator
      for (const staff of conductingStaff) {
        if (staff.id !== profile?.uid && staff.email) {
          await addNotification({
            toEmail: staff.email, title: 'Assessment Assignment',
            body: `You have been assigned to conduct "${createForm.title}"`,
            type: 'assessment_assignment', read: false,
          });
        }
      }
      setToast({ message: 'Assessment created!', type: 'success' });
      setShowCreate(false);
      setCreateForm({ title: '', batchId: '', date: '', totalMarks: '', conductingStaffIds: [] });
      load();
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  const openImport = async (assessment) => {
    setShowImport(assessment);
    setImportStep(1);
    setCsvRows(null);
    setImportPreview(null);
    setBatchStudents([]);
    if (assessment.batchId) {
      try {
        const res = await getBatchStudents(assessment.batchId);
        setBatchStudents(res.students || []);
      } catch { }
    }
  };

  const handleCSVUpload = async (e) => {
    const text = await e.target.files[0]?.text();
    if (!text) return;
    const rows = parseCSV(text);
    setCsvRows(rows);
    // Match to batch students
    const preview = rows.map(r => {
      const phone = r.phone || r.phonenumber || '';
      const matched = batchStudents.find(s => s.phone === phone || s.whatsappNumber === phone || s.name?.toLowerCase() === (r.name||'').toLowerCase());
      const marks = parseFloat(r.marks || r.score || '0') || 0;
      const totalMarks = parseFloat(showImport?.totalMarks || '100');
      const pass = marks >= totalMarks * 0.4;
      return {
        studentId: matched?.id || null,
        studentName: matched?.name || r.name || '?',
        phone,
        marks,
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
      const totalMarks = parseFloat(showImport.totalMarks || '100');
      for (const row of importPreview) {
        await saveAssessmentResult({
          assessmentId: showImport.id,
          assessmentTitle: showImport.title,
          studentId: row.studentId,
          studentName: row.studentName,
          phone: row.phone,
          marks: row.marks,
          totalMarks,
        });
      }
      setToast({ message: `Saved ${importPreview.length} results!`, type: 'success' });
      setShowImport(null);
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  const openViewResults = async (assessment) => {
    setViewResults(assessment);
    try {
      setResults(await getAssessmentResults(assessment.id));
    } catch { setResults([]); }
  };

  const batchName = (id) => batches.find(b => b.id === id)?.name || '—';
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h2><ClipboardList size={20} style={{ marginRight:8, verticalAlign:'middle' }}/>Assessments</h2>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={14}/> Create Assessment
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Title</th><th>Batch</th><th>Date</th><th>Total Marks</th><th>Conducting Staff</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {assessments.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', color:'#9CA3AF', padding:40 }}>No assessments yet. Create one to get started.</td></tr>
            )}
            {assessments.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight:600 }}>{a.title}</td>
                <td style={{ color:'#6B7280' }}>{a.batchName || batchName(a.batchId)}</td>
                <td style={{ color:'#6B7280' }}>{formatDate(a.date)}</td>
                <td style={{ color:'#6B7280' }}>{a.totalMarks}</td>
                <td style={{ color:'#6B7280', fontSize:12 }}>{(a.conductingStaffNames||[]).join(', ')||'—'}</td>
                <td>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => openViewResults(a)}>View Results</button>
                    <button className="btn btn-sm" style={{ background:'#EDE9FE', color:'#6D28D9', border:'none' }} onClick={() => openImport(a)}>
                      <Upload size={12}/> Import Marks
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Assessment Modal */}
      {showCreate && (
        <Modal title="Create Assessment" onClose={() => setShowCreate(false)} wide>
          <form onSubmit={handleCreateAssessment} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-input" required placeholder="e.g. Mid-term Assessment"
                value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })}/>
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
            <div className="form-group">
              <label className="form-label">Total Marks *</label>
              <input className="form-input" type="number" required placeholder="100" value={createForm.totalMarks}
                onChange={e => setCreateForm({ ...createForm, totalMarks: e.target.value })}/>
            </div>
            <div className="form-group">
              <label className="form-label">Conducting Staff</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:10, background:'#F9FAFB', borderRadius:8, border:'1px solid #E5E7EB', minHeight:48 }}>
                {staffList.filter(s => s.role !== 'ceo').map(s => (
                  <div key={s.id} onClick={() => toggleConductingStaff(s.id)} style={{
                    padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:500,
                    background: createForm.conductingStaffIds.includes(s.id) ? '#E53935' : '#fff',
                    color: createForm.conductingStaffIds.includes(s.id) ? '#fff' : '#374151',
                    border: `1px solid ${createForm.conductingStaffIds.includes(s.id) ? '#E53935' : '#E5E7EB'}`,
                  }}>
                    {s.name} ({s.phone || 'no phone'})
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Assessment'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Import Marks Modal */}
      {showImport && (
        <Modal title={`Import Marks — ${showImport.title}`} onClose={() => setShowImport(null)} wide>
          {importStep === 1 && (
            <div>
              <div style={{ padding:'10px 14px', background:'#EFF6FF', borderRadius:8, fontSize:13, color:'#1E40AF', marginBottom:16 }}>
                <strong>Assessment:</strong> {showImport.title} &nbsp;|&nbsp;
                <strong>Batch:</strong> {showImport.batchName || batchName(showImport.batchId)} &nbsp;|&nbsp;
                <strong>Total Marks:</strong> {showImport.totalMarks} &nbsp;|&nbsp;
                <strong>Pass threshold:</strong> 40%
              </div>
              <p style={{ fontSize:13, color:'#6B7280', marginBottom:16 }}>
                Upload a CSV with columns: <code>Name, Phone, Marks</code>. Students are matched by phone number or name.
              </p>
              <button className="btn btn-primary" onClick={() => setImportStep(2)}>Continue to Upload</button>
            </div>
          )}
          {importStep === 2 && (
            <div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
                onChange={handleCSVUpload} />
              <div onClick={() => fileRef.current.click()} style={{
                border:'2px dashed #E5E7EB', borderRadius:10, padding:'32px 20px', textAlign:'center', cursor:'pointer', background:'#FAFAFA',
              }}>
                <Upload size={28} style={{ color:'#D1D5DB', marginBottom:8 }}/>
                <div style={{ fontSize:13, fontWeight:500, color:'#374151' }}>Click to upload CSV (Name, Phone, Marks)</div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
                <button className="btn btn-ghost" onClick={() => setImportStep(1)}>Back</button>
              </div>
            </div>
          )}
          {importStep === 3 && importPreview && (
            <div>
              <div style={{ marginBottom:12, fontSize:13, color:'#374151' }}>
                <strong>{importPreview.filter(r=>r.pass).length}</strong> Pass &nbsp;|&nbsp;
                <strong>{importPreview.filter(r=>!r.pass).length}</strong> Fail &nbsp;|&nbsp;
                <strong>{importPreview.filter(r=>!r.matched).length}</strong> Unmatched
              </div>
              <div style={{ maxHeight:320, overflowY:'auto', border:'1px solid #E5E7EB', borderRadius:8, marginBottom:16 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#F8FAFC', position:'sticky', top:0 }}>
                      {['Name','Phone','Marks','Pass/Fail','Matched'].map(h => (
                        <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', borderBottom:'1px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((r, i) => (
                      <tr key={i} style={{ background: r.pass ? '#F0FDF4' : '#FFF8F8' }}>
                        <td style={{ padding:'8px 12px', fontWeight:500 }}>{r.studentName}</td>
                        <td style={{ padding:'8px 12px', color:'#6B7280' }}>{r.phone||'—'}</td>
                        <td style={{ padding:'8px 12px' }}>{r.marks}</td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{ fontWeight:600, color: r.pass ? '#10B981' : '#EF4444' }}>
                            {r.pass ? '✅ Pass' : '❌ Fail'}
                          </span>
                        </td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, fontWeight:600,
                            background: r.matched ? '#D1FAE5' : '#FEF3C7', color: r.matched ? '#065F46' : '#92400E' }}>
                            {r.matched ? 'Matched' : 'No match'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setImportStep(2)}>Re-upload</button>
                <button className="btn btn-primary" disabled={saving} onClick={handleSaveResults}>
                  {saving ? 'Saving...' : `Save ${importPreview.length} Results`}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* View Results Modal */}
      {viewResults && (
        <Modal title={`Results — ${viewResults.title}`} onClose={() => setViewResults(null)} wide>
          {results.length === 0 ? (
            <div style={{ textAlign:'center', color:'#9CA3AF', padding:40 }}>No results imported yet.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Student</th><th>Phone</th><th>Marks</th><th>Total</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {results.sort((a,b) => b.marks - a.marks).map((r, i) => (
                    <tr key={r.id || i}>
                      <td style={{ fontWeight:600 }}>{r.studentName}</td>
                      <td style={{ color:'#6B7280' }}>{r.phone||'—'}</td>
                      <td><strong>{r.marks}</strong></td>
                      <td style={{ color:'#6B7280' }}>{r.totalMarks}</td>
                      <td>
                        <span style={{ fontWeight:600, color: r.marks >= r.totalMarks * 0.4 ? '#10B981' : '#EF4444' }}>
                          {r.marks >= r.totalMarks * 0.4 ? 'Pass' : 'Fail'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
