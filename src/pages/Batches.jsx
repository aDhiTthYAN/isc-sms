import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getBatches, addBatch, updateBatch,
  getStudentsPaged, addStudent, bulkAddStudents, getBatchStudentCount,
  getStaffProfiles, getBatchSchedules, addBatchSchedule, deleteBatchSchedule,
  getBatchTasks, addBatchTask, markTaskSubmitted
} from '../firebase/services';
import { Modal, Toast, Loading, FormRow, Avatar, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Upload, UserPlus, ChevronRight, ArrowLeft,
  Download, Calendar, CheckSquare, Users, Clock, Trash2
} from 'lucide-react';

const COURSES = ['Python','Data Science','Web Development','Machine Learning','Digital Marketing','UI/UX Design','Cyber Security','Other'];
const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

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
  const headers = ['name','phone','parentName','parentPhone','email','classStd','education','location','staffAssigned','classplusId','status'];
  const ex = ['Fathima Aysha','+91 98432 11234','Abdul Raheem','+91 94432 98765','fathima@email.com','Class 10','B.Sc CS','Kochi','Priya S.','CP-2401','active'];
  const blob = new Blob([headers.join(',')+'\n'+ex.join(',')], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${batchName||'batch'}_template.csv`;
  a.click();
}

export default function Batches() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const isCEOorAdmin = profile?.role === 'ceo' || profile?.role === 'admin';

  const [batches, setBatches]           = useState([]);
  const [staffList, setStaffList]       = useState([]);
  const [batchCounts, setBatchCounts]   = useState({});
  const [loading, setLoading]           = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchStudents, setBatchStudents] = useState([]);
  const [schedules, setSchedules]       = useState([]);
  const [batchTasks, setBatchTasks]     = useState([]);
  const [activeTab, setActiveTab]       = useState('students'); // students | schedule | tasks
  const [toast, setToast]               = useState(null);
  const [saving, setSaving]             = useState(false);
  const [csvPreview, setCsvPreview]     = useState(null);
  const [importing, setImporting]       = useState(false);
  const fileRef = useRef();

  // Modals
  const [showCreate,      setShowCreate]      = useState(false);
  const [showAddStudent,  setShowAddStudent]  = useState(false);
  const [showBulk,        setShowBulk]        = useState(false);
  const [showSchedule,    setShowSchedule]    = useState(false);
  const [showTask,        setShowTask]        = useState(false);
  const [showTaskDetail,  setShowTaskDetail]  = useState(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    name:'', course:'', mentor:'', faculties:[], startDate:'', endDate:'',
    status:'upcoming', maxSeats:'', courseDurationMonths:''
  });
  const [studentForm, setStudentForm] = useState({
    name:'', phone:'', parentName:'', parentPhone:'', email:'',
    classStd:'', education:'', location:'', staffAssigned:'', classplusId:'', status:'active',
  });
  const [scheduleForm, setScheduleForm] = useState({
    title:'', day:'Monday', time:'', duration:'60', type:'live-class',
    facultyName:'', meetLink:'', notes:''
  });
  const [taskForm, setTaskForm] = useState({
    title:'', subject:'', description:'', dueDate:'', assignedFaculty:''
  });

  const loadBatches = async () => {
    const [b, s] = await Promise.all([getBatches(), getStaffProfiles()]);
    setBatches(b);
    setStaffList(s.filter(x => x.active !== false));
    const counts = {};
    await Promise.all(b.map(async batch => { counts[batch.id] = await getBatchStudentCount(batch.id); }));
    setBatchCounts(counts);
    setLoading(false);
  };

  const loadBatchDetail = async (batch) => {
    try {
      const [res, sch, tasks] = await Promise.all([
        getStudentsPaged({ batchId: batch.id }).catch(() => ({ students: [] })),
        getBatchSchedules(batch.id).catch(() => []),
        getBatchTasks(batch.id).catch(() => []),
      ]);
      setBatchStudents(res.students || []);
      setSchedules(sch || []);
      setBatchTasks(tasks || []);
    } catch (err) {
      console.error('loadBatchDetail error:', err);
      setBatchStudents([]);
      setSchedules([]);
      setBatchTasks([]);
    }
  };

  useEffect(() => { loadBatches(); }, []);

  const openBatch = async (batch) => {
    setSelectedBatch(batch);
    setActiveTab('students');
    await loadBatchDetail(batch);
  };

  // ── Create batch ──────────────────────────────────────────────
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setSaving(true);
    await addBatch(createForm);
    setToast({ message: `Batch "${createForm.name}" created!`, type:'success' });
    setShowCreate(false);
    setCreateForm({ name:'', course:'', mentor:'', faculties:[], startDate:'', endDate:'', status:'upcoming', maxSeats:'', courseDurationMonths:'' });
    await loadBatches();
    setSaving(false);
  };

  // ── Toggle faculty in createForm ──────────────────────────────
  const toggleFaculty = (name) => {
    setCreateForm(prev => ({
      ...prev,
      faculties: prev.faculties.includes(name)
        ? prev.faculties.filter(f => f !== name)
        : [...prev.faculties, name]
    }));
  };

  // ── Add single student ────────────────────────────────────────
  const handleAddStudent = async (e) => {
    e.preventDefault();
    setSaving(true);
    await addStudent({
      ...studentForm,
      batchId:             selectedBatch.id,
      batchName:           selectedBatch.name,
      course:              selectedBatch.course,
      courseDurationMonths:selectedBatch.courseDurationMonths || '',
    });
    setToast({ message:'Student added to batch!', type:'success' });
    setShowAddStudent(false);
    setStudentForm({ name:'', phone:'', parentName:'', parentPhone:'', email:'', classStd:'', education:'', location:'', staffAssigned:'', classplusId:'', status:'active' });
    await loadBatchDetail(selectedBatch);
    const c = await getBatchStudentCount(selectedBatch.id);
    setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: c }));
    setSaving(false);
  };

  // ── Bulk import ───────────────────────────────────────────────
  const handleBulkImport = async () => {
    if (!csvPreview) return;
    setImporting(true);
    const students = csvPreview.map(row => ({
      name:             row.name||'',
      phone:            row.phone||'',
      parentName:       row.parentname||'',
      parentPhone:      row.parentphone||'',
      email:            row.email||'',
      classStd:         row.classstd||row.class||'',
      education:        row.education||'',
      location:         row.location||'',
      staffAssigned:    row.staffassigned||'',
      classplusId:      row.classplusid||'',
      status:           row.status||'active',
      batchId:          selectedBatch.id,
      batchName:        selectedBatch.name,
      course:           selectedBatch.course,
      courseDurationMonths: selectedBatch.courseDurationMonths||'',
    }));
    const res = await bulkAddStudents(students);
    setToast({ message:`Imported ${res.success} students into ${selectedBatch.name}!`, type:'success' });
    setShowBulk(false);
    setCsvPreview(null);
    setImporting(false);
    await loadBatchDetail(selectedBatch);
    const c = await getBatchStudentCount(selectedBatch.id);
    setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: c }));
  };

  // ── Add schedule slot ─────────────────────────────────────────
  const handleAddSchedule = async (e) => {
    e.preventDefault();
    setSaving(true);
    await addBatchSchedule({ ...scheduleForm, batchId: selectedBatch.id, batchName: selectedBatch.name });
    setToast({ message:'Schedule added!', type:'success' });
    setShowSchedule(false);
    setScheduleForm({ title:'', day:'Monday', time:'', duration:'60', type:'live-class', facultyName:'', meetLink:'', notes:'' });
    const sch = await getBatchSchedules(selectedBatch.id);
    setSchedules(sch);
    setSaving(false);
  };

  // ── Add batch task ────────────────────────────────────────────
  const handleAddTask = async (e) => {
    e.preventDefault();
    setSaving(true);
    await addBatchTask({
      ...taskForm,
      batchId:   selectedBatch.id,
      batchName: selectedBatch.name,
      createdBy: profile?.name,
    });
    setToast({ message:'Task created for batch!', type:'success' });
    setShowTask(false);
    setTaskForm({ title:'', subject:'', description:'', dueDate:'', assignedFaculty:'' });
    const tasks = await getBatchTasks(selectedBatch.id);
    setBatchTasks(tasks);
    setSaving(false);
  };

  const progress = (batch) => {
    const s = batch.startDate ? new Date(batch.startDate) : null;
    const e = batch.endDate   ? new Date(batch.endDate)   : null;
    if (!s || !e) return 0;
    return Math.min(100, Math.max(0, Math.round((Date.now()-s)/(e-s)*100)));
  };

  const typeColor = (t) => {
    if (t==='live-class') return { bg:'#DBEAFE', col:'#1E40AF', label:'🔴 Live Class' };
    if (t==='recorded')   return { bg:'#D1FAE5', col:'#065F46', label:'📹 Recorded' };
    if (t==='assignment') return { bg:'#FEF3C7', col:'#92400E', label:'📝 Assignment' };
    return { bg:'#F3F4F6', col:'#374151', label: t };
  };

  if (loading) return <Loading/>;

  // ════════════════════════════════════════════════════════════
  // BATCH DETAIL VIEW
  // ════════════════════════════════════════════════════════════
  if (selectedBatch) {
    const count = batchCounts[selectedBatch.id] || batchStudents.length;
    const pct   = progress(selectedBatch);
    const schedByDay = {};
    DAYS.forEach(d => { schedByDay[d] = schedules.filter(s => s.day === d); });

    return (
      <div>
        {/* Header */}
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedBatch(null)}>
              <ArrowLeft size={16}/>
            </button>
            <div>
              <h2>{selectedBatch.name}</h2>
              <div style={{ fontSize:13, color:'#6B7280' }}>
                {selectedBatch.course}
                {selectedBatch.courseDurationMonths ? ` · ${selectedBatch.courseDurationMonths} months` : ''}
                {' · '}{count} students
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {activeTab === 'students' && (
              <>
                <button className="btn btn-ghost" onClick={() => setShowBulk(true)}><Upload size={14}/> Bulk CSV</button>
                {isCEOorAdmin && <button className="btn btn-primary" onClick={() => setShowAddStudent(true)}><UserPlus size={14}/> Add Student</button>}
              </>
            )}
            {activeTab === 'schedule' && (
              <button className="btn btn-primary" onClick={() => setShowSchedule(true)}><Plus size={14}/> Add Class</button>
            )}
            {activeTab === 'tasks' && (
              <button className="btn btn-primary" onClick={() => setShowTask(true)}><Plus size={14}/> Add Task</button>
            )}
          </div>
        </div>

        {/* Batch info strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'Total Students', value:count,                                                color:'#3B82F6', bg:'#DBEAFE' },
            { label:'Active',         value:batchStudents.filter(s=>s.status==='active').length,  color:'#10B981', bg:'#D1FAE5' },
            { label:'At Risk',        value:batchStudents.filter(s=>s.status==='at-risk').length, color:'#EF4444', bg:'#FEE2E2' },
            { label:'Progress',       value:`${pct}%`,                                            color:'#E53935', bg:'#FEE2E2' },
          ].map(c => (
            <div key={c.label} style={{ background:'#fff', borderRadius:10, border:'1px solid #E5E7EB', padding:'10px 14px' }}>
              <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>{c.label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Faculties assigned */}
        {selectedBatch.faculties?.length > 0 && (
          <div style={{ marginBottom:14, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'#6B7280' }}>Faculties:</span>
            {selectedBatch.faculties.map((f,i) => (
              <span key={i} className="badge badge-blue">{f}</span>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div className="tab-bar" style={{ marginBottom:16 }}>
          {[
            { key:'students', label:`Students (${count})`           },
            { key:'schedule', label:`Weekly Schedule (${schedules.length})` },
            { key:'tasks',    label:`Tasks (${batchTasks.length})`  },
          ].map(t => (
            <div key={t.key} className={`tab ${activeTab===t.key?'active':''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </div>
          ))}
        </div>

        {/* ── STUDENTS TAB ── */}
        {activeTab === 'students' && (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Child Name</th><th>Parent</th><th>Phone</th><th>Class/Std</th><th>Staff</th><th>Status</th><th>Subscription</th><th></th></tr>
              </thead>
              <tbody>
                {batchStudents.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', padding:40 }}>
                    <div style={{ color:'#6B7280', fontSize:13, marginBottom:12 }}>No students yet.</div>
                    <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                      <button className="btn btn-ghost" onClick={() => setShowBulk(true)}><Upload size={13}/> Import CSV</button>
                      {isCEOorAdmin && <button className="btn btn-primary" onClick={() => setShowAddStudent(true)}><UserPlus size={13}/> Add Manually</button>}
                    </div>
                  </td></tr>
                )}
                {batchStudents.map(s => {
                  let dl = null;
                  if (s.joinDate && s.courseDurationMonths) {
                    const exp = new Date(s.joinDate);
                    exp.setMonth(exp.getMonth() + Number(s.courseDurationMonths));
                    dl = Math.ceil((exp - Date.now()) / 86400000);
                  }
                  return (
                    <tr key={s.id}>
                      <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Avatar name={s.name} size="sm"/><div style={{ fontWeight:500 }}>{s.name}</div></div></td>
                      <td style={{ fontSize:13 }}>{s.parentName||'—'}</td>
                      <td>
                        <div style={{ fontSize:13 }}>{s.phone||'—'}</div>
                        {s.parentPhone && <div style={{ fontSize:11, color:'#6B7280' }}>P: {s.parentPhone}</div>}
                      </td>
                      <td style={{ fontSize:13 }}>{s.classStd||'—'}</td>
                      <td style={{ fontSize:13 }}>{s.staffAssigned||'—'}</td>
                      <td><StatusBadge status={s.status}/></td>
                      <td>
                        {dl!==null ? (
                          <span style={{ fontSize:11, padding:'2px 7px', borderRadius:10, fontWeight:600,
                            background:dl<0?'#FEE2E2':dl<=30?'#FEF3C7':'#D1FAE5',
                            color:dl<0?'#991B1B':dl<=30?'#92400E':'#065F46' }}>
                            {dl<0?'Expired':`${dl}d left`}
                          </span>
                        ) : '—'}
                      </td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>View <ChevronRight size={12}/></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── SCHEDULE TAB ── */}
        {activeTab === 'schedule' && (
          <div>
            {schedules.length === 0 && (
              <div className="card" style={{ textAlign:'center', color:'#6B7280', padding:40 }}>
                No schedule added yet. Click "Add Class" to create the weekly timetable.
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {DAYS.map(day => {
                const daySlots = schedByDay[day] || [];
                if (!daySlots.length) return null;
                return (
                  <div key={day} className="card">
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:10, color:'#1A1A2E' }}>{day}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {daySlots.map(slot => {
                        const tc = typeColor(slot.type);
                        return (
                          <div key={slot.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:tc.bg, borderRadius:9, border:`1px solid ${tc.col}20` }}>
                            <div style={{ flexShrink:0, textAlign:'center', minWidth:52 }}>
                              <div style={{ fontWeight:700, fontSize:13, color:tc.col }}>{slot.time}</div>
                              <div style={{ fontSize:10, color:'#6B7280' }}>{slot.duration}min</div>
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:500, fontSize:13 }}>{slot.title}</div>
                              <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                                {slot.facultyName && `👤 ${slot.facultyName}`}
                                {slot.meetLink && <a href={slot.meetLink} target="_blank" rel="noreferrer" style={{ color:'#E53935', marginLeft:8 }}>Join Link →</a>}
                              </div>
                              {slot.notes && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{slot.notes}</div>}
                            </div>
                            <span style={{ padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:tc.bg, color:tc.col, border:`1px solid ${tc.col}40` }}>
                              {tc.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {activeTab === 'tasks' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {batchTasks.length === 0 && (
              <div className="card" style={{ textAlign:'center', color:'#6B7280', padding:40 }}>
                No tasks created yet. Click "Add Task" to assign work to students.
              </div>
            )}
            {batchTasks.map(task => {
              const submitted   = task.submittedBy?.length || 0;
              const total       = batchStudents.length || 1;
              const pctDone     = Math.round(submitted/total*100);
              const notSubmitted = batchStudents.filter(s => !task.submittedBy?.find(x => x.studentId === s.id));
              return (
                <div key={task.id} className="card" style={{ cursor:'pointer' }} onClick={() => setShowTaskDetail(task)}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14 }}>{task.title}</div>
                      <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                        {task.subject && `📚 ${task.subject}`}
                        {task.assignedFaculty && ` · 👤 ${task.assignedFaculty}`}
                        {task.dueDate && ` · Due: ${task.dueDate}`}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontWeight:700, fontSize:16, color: pctDone===100?'#10B981':'#F59E0B' }}>{submitted}/{total}</div>
                      <div style={{ fontSize:11, color:'#6B7280' }}>submitted</div>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width:`${pctDone}%`, background:pctDone===100?'#10B981':'#F59E0B' }}/>
                  </div>
                  {task.description && <div style={{ fontSize:13, color:'#6B7280', marginTop:8 }}>{task.description}</div>}
                  <div style={{ fontSize:12, color:'#E53935', marginTop:8 }}>
                    {notSubmitted.length>0 ? `${notSubmitted.length} not submitted yet — click to see` : '✅ All submitted!'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── MODALS ── */}

        {/* Add Student */}
        {showAddStudent && (
          <Modal title={`Add Student to ${selectedBatch.name}`} onClose={() => setShowAddStudent(false)} wide>
            <div style={{ padding:'8px 12px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:14 }}>
              Student will be automatically placed in <strong>{selectedBatch.name}</strong> ({selectedBatch.course}).
            </div>
            <form onSubmit={handleAddStudent} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <FormRow>
                <div className="form-group"><label className="form-label">Child Name *</label><input className="form-input" required value={studentForm.name} onChange={e => setStudentForm({...studentForm,name:e.target.value})}/></div>
                <div className="form-group"><label className="form-label">Child Phone</label><input className="form-input" value={studentForm.phone} onChange={e => setStudentForm({...studentForm,phone:e.target.value})}/></div>
              </FormRow>
              <FormRow>
                <div className="form-group"><label className="form-label">Parent Name *</label><input className="form-input" required value={studentForm.parentName} onChange={e => setStudentForm({...studentForm,parentName:e.target.value})}/></div>
                <div className="form-group"><label className="form-label">Parent Phone *</label><input className="form-input" required value={studentForm.parentPhone} onChange={e => setStudentForm({...studentForm,parentPhone:e.target.value})}/></div>
              </FormRow>
              <FormRow>
                <div className="form-group"><label className="form-label">Class / Std</label><input className="form-input" placeholder="Class 10, Grade 8..." value={studentForm.classStd} onChange={e => setStudentForm({...studentForm,classStd:e.target.value})}/></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={studentForm.email} onChange={e => setStudentForm({...studentForm,email:e.target.value})}/></div>
              </FormRow>
              <FormRow>
                <div className="form-group"><label className="form-label">Location</label><input className="form-input" value={studentForm.location} onChange={e => setStudentForm({...studentForm,location:e.target.value})}/></div>
                <div className="form-group">
                  <label className="form-label">Staff Assigned</label>
                  <select className="form-input" value={studentForm.staffAssigned} onChange={e => setStudentForm({...studentForm,staffAssigned:e.target.value})}>
                    <option value="">Select</option>
                    {staffList.map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </FormRow>
              <FormRow>
                <div className="form-group"><label className="form-label">ClassPlus ID</label><input className="form-input" value={studentForm.classplusId} onChange={e => setStudentForm({...studentForm,classplusId:e.target.value})}/></div>
                <div className="form-group"><label className="form-label">Join Date</label><input className="form-input" type="date" value={studentForm.joinDate} onChange={e => setStudentForm({...studentForm,joinDate:e.target.value})}/></div>
              </FormRow>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddStudent(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Adding...':'Add to Batch'}</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Bulk Import */}
        {showBulk && (
          <Modal title={`Bulk Import into ${selectedBatch.name}`} onClose={() => { setShowBulk(false); setCsvPreview(null); }} wide>
            <div style={{ padding:'8px 12px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:14 }}>
              All students will be placed in <strong>{selectedBatch.name}</strong> automatically.
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:14 }} onClick={() => downloadTemplate(selectedBatch.name)}>
              <Download size={13}/> Download CSV Template
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
              onChange={async e => { const t = await e.target.files[0]?.text(); if(t) setCsvPreview(parseCSV(t)); }}/>
            <div onClick={() => fileRef.current.click()} style={{
              border:'2px dashed #E5E7EB', borderRadius:10, padding:'24px', textAlign:'center',
              cursor:'pointer', background:'#FAFAFA', marginBottom:14
            }}>
              <Upload size={22} style={{ color:'#9CA3AF', marginBottom:6 }}/>
              <div style={{ fontSize:13, fontWeight:500 }}>{csvPreview?`${csvPreview.length} rows loaded — ready to import`:'Click to upload CSV'}</div>
              <div style={{ fontSize:11, color:'#6B7280', marginTop:3 }}>Required: name, phone — everything else optional</div>
            </div>
            {csvPreview && (
              <div className="table-container" style={{ maxHeight:180, overflow:'auto', marginBottom:12 }}>
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>Parent Name</th><th>Phone</th><th>Class</th></tr></thead>
                  <tbody>
                    {csvPreview.slice(0,8).map((r,i)=>(
                      <tr key={i}>
                        <td style={{ color:'#9CA3AF' }}>{i+1}</td>
                        <td style={{ fontWeight:500 }}>{r.name}</td>
                        <td>{r.parentname||'—'}</td>
                        <td>{r.phone}</td>
                        <td>{r.classstd||r.class||'—'}</td>
                      </tr>
                    ))}
                    {csvPreview.length>8&&<tr><td colSpan={5} style={{ textAlign:'center', color:'#6B7280', padding:8 }}>...and {csvPreview.length-8} more</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowBulk(false); setCsvPreview(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleBulkImport} disabled={!csvPreview||importing}>
                {importing?'Importing...':`Import ${csvPreview?.length||0} Students`}
              </button>
            </div>
          </Modal>
        )}

        {/* Add Schedule */}
        {showSchedule && (
          <Modal title="Add to Weekly Schedule" onClose={() => setShowSchedule(false)}>
            <form onSubmit={handleAddSchedule} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="form-group"><label className="form-label">Title *</label><input className="form-input" required placeholder="e.g. Python Basics — Chapter 3" value={scheduleForm.title} onChange={e=>setScheduleForm({...scheduleForm,title:e.target.value})}/></div>
              <FormRow>
                <div className="form-group">
                  <label className="form-label">Day *</label>
                  <select className="form-input" value={scheduleForm.day} onChange={e=>setScheduleForm({...scheduleForm,day:e.target.value})}>
                    {DAYS.map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Time *</label><input className="form-input" type="time" required value={scheduleForm.time} onChange={e=>setScheduleForm({...scheduleForm,time:e.target.value})}/></div>
              </FormRow>
              <FormRow>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={scheduleForm.type} onChange={e=>setScheduleForm({...scheduleForm,type:e.target.value})}>
                    <option value="live-class">🔴 Live Class</option>
                    <option value="recorded">📹 Recorded Session</option>
                    <option value="assignment">📝 Assignment</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Duration (minutes)</label><input className="form-input" type="number" value={scheduleForm.duration} onChange={e=>setScheduleForm({...scheduleForm,duration:e.target.value})}/></div>
              </FormRow>
              <FormRow>
                <div className="form-group">
                  <label className="form-label">Faculty</label>
                  <select className="form-input" value={scheduleForm.facultyName} onChange={e=>setScheduleForm({...scheduleForm,facultyName:e.target.value})}>
                    <option value="">Select faculty</option>
                    {(selectedBatch.faculties||[]).map((f,i)=><option key={i}>{f}</option>)}
                    {staffList.map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Meet / Zoom Link</label><input className="form-input" type="url" placeholder="https://meet.google.com/..." value={scheduleForm.meetLink} onChange={e=>setScheduleForm({...scheduleForm,meetLink:e.target.value})}/></div>
              </FormRow>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={scheduleForm.notes} onChange={e=>setScheduleForm({...scheduleForm,notes:e.target.value})}/></div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowSchedule(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving...':'Add to Schedule'}</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Add Task */}
        {showTask && (
          <Modal title="Create Student Task" onClose={() => setShowTask(false)}>
            <form onSubmit={handleAddTask} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="form-group"><label className="form-label">Task Title *</label><input className="form-input" required placeholder="e.g. Complete Chapter 3 exercises" value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})}/></div>
              <FormRow>
                <div className="form-group"><label className="form-label">Subject / Topic</label><input className="form-input" placeholder="e.g. Python Functions" value={taskForm.subject} onChange={e=>setTaskForm({...taskForm,subject:e.target.value})}/></div>
                <div className="form-group">
                  <label className="form-label">Assigned Faculty</label>
                  <select className="form-input" value={taskForm.assignedFaculty} onChange={e=>setTaskForm({...taskForm,assignedFaculty:e.target.value})}>
                    <option value="">Select faculty</option>
                    {(selectedBatch.faculties||[]).map((f,i)=><option key={i}>{f}</option>)}
                    {staffList.map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </FormRow>
              <div className="form-group"><label className="form-label">Description / Instructions</label><textarea className="form-input" rows={3} placeholder="What should students do? What is the expected output?" value={taskForm.description} onChange={e=>setTaskForm({...taskForm,description:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" type="date" value={taskForm.dueDate} onChange={e=>setTaskForm({...taskForm,dueDate:e.target.value})}/></div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowTask(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Creating...':'Create Task'}</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Task detail — who submitted */}
        {showTaskDetail && (
          <Modal title={showTaskDetail.title} onClose={() => setShowTaskDetail(null)} wide>
            <div style={{ marginBottom:14 }}>
              {showTaskDetail.subject && <div style={{ fontSize:13, color:'#6B7280', marginBottom:4 }}>📚 {showTaskDetail.subject}</div>}
              {showTaskDetail.description && <div style={{ fontSize:13, lineHeight:1.6 }}>{showTaskDetail.description}</div>}
              {showTaskDetail.dueDate && <div style={{ fontSize:12, color:'#9CA3AF', marginTop:6 }}>Due: {showTaskDetail.dueDate}</div>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:8, color:'#10B981' }}>
                  ✅ Submitted ({showTaskDetail.submittedBy?.length||0})
                </div>
                {(showTaskDetail.submittedBy||[]).map((s,i)=>(
                  <div key={i} style={{ padding:'6px 10px', background:'#F0FDF4', borderRadius:7, marginBottom:4, fontSize:13 }}>
                    {s.studentName}
                    <span style={{ fontSize:11, color:'#6B7280', marginLeft:8 }}>{s.submittedAt?.slice(0,10)}</span>
                  </div>
                ))}
                {!showTaskDetail.submittedBy?.length && <div style={{ fontSize:12, color:'#9CA3AF' }}>Nobody yet</div>}
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:8, color:'#EF4444' }}>
                  ⏳ Not Submitted ({batchStudents.filter(s=>!showTaskDetail.submittedBy?.find(x=>x.studentId===s.id)).length})
                </div>
                {batchStudents.filter(s=>!showTaskDetail.submittedBy?.find(x=>x.studentId===s.id)).map(s=>(
                  <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', background:'#FFF8F8', borderRadius:7, marginBottom:4 }}>
                    <span style={{ fontSize:13 }}>{s.name}</span>
                    <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }}
                      onClick={async () => {
                        await markTaskSubmitted(showTaskDetail.id, s.id, s.name);
                        const tasks = await getBatchTasks(selectedBatch.id);
                        setBatchTasks(tasks);
                        setShowTaskDetail(tasks.find(t=>t.id===showTaskDetail.id)||null);
                      }}>
                      Mark Done
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Modal>
        )}

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // BATCH LIST VIEW
  // ════════════════════════════════════════════════════════════
  const grouped = { active:[], upcoming:[], completed:[] };
  batches.forEach(b => { (grouped[b.status]||grouped.completed).push(b); });

  return (
    <div>
      <div className="page-header">
        <h2>Batch Management</h2>
        {isCEOorAdmin && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16}/> Create Batch
          </button>
        )}
      </div>

      <div style={{ padding:'10px 14px', background:'#F0FDF4', borderRadius:8, fontSize:12, color:'#065F46', marginBottom:20 }}>
        <strong>Flow:</strong> Create batch → assign faculties → click batch → add students or import CSV → create weekly schedule and tasks inside the batch.
      </div>

      {batches.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:14, color:'#6B7280', marginBottom:16 }}>No batches yet.</div>
          {isCEOorAdmin && <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16}/> Create First Batch</button>}
        </div>
      )}

      {['active','upcoming','completed'].map(group => {
        if (!grouped[group].length) return null;
        return (
          <div key={group} style={{ marginBottom:24 }}>
            <h3 style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
              {group} ({grouped[group].length})
            </h3>
            <div className="grid-3">
              {grouped[group].map(b => (
                <div key={b.id} className="card" style={{ cursor:'pointer' }}
                  onClick={() => openBatch(b)}
                  onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow=''}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:14 }}>{b.name}</div>
                      <div style={{ fontSize:12, color:'#6B7280' }}>{b.course}{b.courseDurationMonths?` · ${b.courseDurationMonths}mo`:''}</div>
                    </div>
                    <span className={`badge ${b.status==='active'?'badge-green':b.status==='upcoming'?'badge-blue':'badge-gray'}`}>{b.status}</span>
                  </div>
                  <div style={{ fontSize:13, marginBottom:8 }}>
                    <span style={{ color:'#6B7280' }}>Students: </span><strong>{batchCounts[b.id]||0}</strong>
                    {b.mentor && <><span style={{ color:'#6B7280', marginLeft:10 }}>Mentor: </span>{b.mentor}</>}
                  </div>
                  {/* Faculty tags */}
                  {b.faculties?.length>0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                      {b.faculties.map((f,i)=>(
                        <span key={i} style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:'#DBEAFE', color:'#1E40AF', fontWeight:600 }}>{f}</span>
                      ))}
                    </div>
                  )}
                  {b.status==='active' && (
                    <div>
                      <div className="progress-bar" style={{ marginTop:4 }}>
                        <div className="progress-fill" style={{ width:`${progress(b)}%`, background:'#E53935' }}/>
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid var(--border)', fontSize:12, color:'#E53935', display:'flex', alignItems:'center', gap:4 }}>
                    Click to open — students, schedule, tasks <ChevronRight size={12}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Create Batch Modal */}
      {showCreate && (
        <Modal title="Create New Batch" onClose={() => setShowCreate(false)} wide>
          <form onSubmit={handleCreateBatch} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group"><label className="form-label">Batch Name *</label><input className="form-input" required placeholder="e.g. Python Batch A — June 2026" value={createForm.name} onChange={e=>setCreateForm({...createForm,name:e.target.value})}/></div>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Course *</label>
                <select className="form-input" required value={createForm.course} onChange={e=>setCreateForm({...createForm,course:e.target.value})}>
                  <option value="">Select</option>{COURSES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Course Duration (months) *</label>
                <input className="form-input" type="number" required placeholder="e.g. 6" value={createForm.courseDurationMonths} onChange={e=>setCreateForm({...createForm,courseDurationMonths:e.target.value})}/>
                <div style={{ fontSize:11, color:'#6B7280', marginTop:3 }}>Each student's subscription = their join date + this duration</div>
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={createForm.startDate} onChange={e=>setCreateForm({...createForm,startDate:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={createForm.endDate} onChange={e=>setCreateForm({...createForm,endDate:e.target.value})}/></div>
            </FormRow>
            {/* Faculty multi-select */}
            <div className="form-group">
              <label className="form-label">Assign Faculties / Staff to this Batch</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'10px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)', minHeight:48 }}>
                {staffList.filter(s=>s.role!=='ceo').map(s=>(
                  <div key={s.id} onClick={() => toggleFaculty(s.name)} style={{
                    padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:500,
                    background: createForm.faculties.includes(s.name)?'#E53935':'var(--white)',
                    color:      createForm.faculties.includes(s.name)?'#fff':'var(--text)',
                    border:     `1px solid ${createForm.faculties.includes(s.name)?'#E53935':'var(--border)'}`,
                    transition: 'all 0.15s',
                  }}>
                    {s.name} <span style={{ fontSize:10, opacity:0.7 }}>({s.role})</span>
                  </div>
                ))}
                {staffList.length===0 && <span style={{ fontSize:12, color:'#9CA3AF' }}>No staff added yet — add staff first then create batches</span>}
              </div>
              {createForm.faculties.length>0 && (
                <div style={{ fontSize:11, color:'#065F46', marginTop:4 }}>
                  Selected: {createForm.faculties.join(', ')}
                </div>
              )}
            </div>
            <FormRow>
              <div className="form-group"><label className="form-label">Max Seats</label><input className="form-input" type="number" placeholder="60" value={createForm.maxSeats} onChange={e=>setCreateForm({...createForm,maxSeats:e.target.value})}/></div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={createForm.status} onChange={e=>setCreateForm({...createForm,status:e.target.value})}>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </FormRow>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Creating...':'Create Batch'}</button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  );
}