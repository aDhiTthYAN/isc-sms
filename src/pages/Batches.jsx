import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getBatches, addBatch, updateBatch,
  getBatchStudents, addStudent, bulkAddStudents, getBatchStudentCount,
  getStaffProfiles, getBatchSchedules, addBatchSchedule, deleteBatchSchedule,
  getBatchTasks, addBatchTask, markTaskSubmitted
} from '../firebase/services';
import { Modal, Toast, Loading, FormRow, Avatar, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Upload, UserPlus, ChevronRight, ArrowLeft,
  Download, Calendar, CheckSquare, Users, Clock, Trash2, Edit, Settings
} from 'lucide-react';

const COURSES = ['Python','Data Science','Web Development','Machine Learning','Digital Marketing','UI/UX Design','Cyber Security','ISC Level 1','ISC Level 2','AI Batch','Other'];
const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const PHASES  = ['onboarding', 'course'];

const DEFAULT_COURSE_FLOW = [
  { key: 'admission',         label: 'Student Admission',                    phase: 'onboarding' },
  { key: 'parent_onboarding', label: 'Parent Onboarding',                    phase: 'onboarding' },
  { key: 'group_admission',   label: 'Group Admission',                      phase: 'onboarding' },
  { key: 'initial_assess',    label: 'Primary Assessment',                   phase: 'onboarding' },
  { key: 'vark_analysis',     label: 'VARK Analysis',                        phase: 'onboarding' },
  { key: 'kit_dispatch',      label: 'Kit Packing & Dispatch',               phase: 'onboarding' },
  { key: 'instagram_setup',   label: 'Instagram Account Open',               phase: 'onboarding' },
  { key: 'kit_activities',    label: 'Kit Activities',                       phase: 'course'     },
  { key: 'kit_insta',         label: 'Kit Activity on Instagram',            phase: 'course'     },
  { key: 'class_start',       label: 'Classes Started',                      phase: 'course'     },
  { key: 'first_recheck',     label: 'First Recheck on Progress',            phase: 'course'     },
  { key: 'action_plan',       label: 'Action Plan on First Assessment',      phase: 'course'     },
  { key: 'malayalam_activity',label: 'Malayalam Activity',                   phase: 'course'     },
  { key: 'english_activity',  label: 'English Activity',                     phase: 'course'     },
  { key: 'maths_activity',    label: 'Maths Activity',                       phase: 'course'     },
  { key: 'science_activity',  label: 'Science Activity',                     phase: 'course'     },
  { key: 'followup_monitor',  label: 'Regular Follow-up & Progress Monitoring', phase: 'course' },
];

const DEFAULT_STUDENT_FIELDS = [
  { key: 'name',          label: "Student Name (Kid's Name)", required: true,  type: 'text'  },
  { key: 'gender',        label: 'Gender',                    required: false, type: 'text'  },
  { key: 'age',           label: 'Age',                       required: false, type: 'number'},
  { key: 'classStd',      label: 'Class',                     required: false, type: 'text'  },
  { key: 'schoolName',    label: 'School Name',               required: false, type: 'text'  },
  { key: 'fatherName',    label: 'Name of Father',            required: false, type: 'text'  },
  { key: 'motherName',    label: 'Name of Mother',            required: false, type: 'text'  },
  { key: 'phone',         label: 'Phone Number',              required: false, type: 'text'  },
  { key: 'whatsappNumber',label: 'WhatsApp Number',           required: false, type: 'text'  },
  { key: 'email',         label: 'Parent Email',              required: false, type: 'email' },
  { key: 'address',       label: 'Address',                   required: false, type: 'text'  },
  { key: 'occupation',    label: 'Parent Occupation',         required: false, type: 'text'  },
];

function generateKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Math.random().toString(36).slice(2,5);
}

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

function downloadTemplate(batchName, fields) {
  const headers = fields.map(f => f.key);
  const example = fields.map(f => {
    if (f.key === 'name') return 'Fathima Aysha';
    if (f.key === 'phone') return '+91 98432 11234';
    if (f.key === 'parentName') return 'Abdul Raheem';
    if (f.key === 'parentPhone') return '+91 94432 98765';
    if (f.key === 'email') return 'fathima@email.com';
    if (f.key === 'classStd') return 'Class 10';
    if (f.key === 'location') return 'Kochi';
    return '';
  });
  const blob = new Blob([headers.join(',')+'\n'+example.join(',')], { type:'text/csv' });
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
  const [activeTab, setActiveTab]       = useState('students');
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
  const [showFlowConfig,  setShowFlowConfig]  = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [showSubjectConfig, setShowSubjectConfig] = useState(false);

  // Batch create form
  const [createForm, setCreateForm] = useState({
    name:'', course:'', mentor:'', faculties:[], startDate:'', endDate:'',
    status:'upcoming', maxSeats:'', courseDurationMonths:'',
    courseFlow: DEFAULT_COURSE_FLOW,
    studentFields: DEFAULT_STUDENT_FIELDS,
    subjects: [],
  });

  // Dynamic student form based on batch fields
  const [studentForm, setStudentForm] = useState({});

  const [scheduleForm, setScheduleForm] = useState({
    title:'', day:'Monday', time:'', duration:'60', type:'live-class',
    facultyName:'', meetLink:'', notes:''
  });
  const [taskForm, setTaskForm] = useState({
    title:'', subject:'', description:'', dueDate:'', assignedFaculty:''
  });

  // Course flow config editor state
  const [editFlow, setEditFlow] = useState([]);

  // Student fields config editor state
  const [editFields, setEditFields] = useState([]);

  // Subject config editor state
  const [editSubjects, setEditSubjects] = useState([]);

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
        getBatchStudents(batch.id).catch(() => ({ students: [] })),
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
    // Init dynamic student form from batch fields
    const fields = batch.studentFields || DEFAULT_STUDENT_FIELDS;
    const initForm = {};
    fields.forEach(f => { initForm[f.key] = ''; });
    initForm.staffAssigned = '';
    initForm.joinDate = '';
    initForm.status = 'active';
    setStudentForm(initForm);
    await loadBatchDetail(batch);
  };

  // ── Create batch ──────────────────────────────────────────────
  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setSaving(true);
    await addBatch(createForm);
    setToast({ message: `Batch "${createForm.name}" created!`, type:'success' });
    setShowCreate(false);
    setCreateForm({ name:'', course:'', mentor:'', faculties:[], startDate:'', endDate:'', status:'upcoming', maxSeats:'', courseDurationMonths:'', courseFlow: DEFAULT_COURSE_FLOW, studentFields: DEFAULT_STUDENT_FIELDS, subjects: [] });
    await loadBatches();
    setSaving(false);
  };

  const toggleFaculty = (name) => {
    setCreateForm(prev => ({
      ...prev,
      faculties: prev.faculties.includes(name)
        ? prev.faculties.filter(f => f !== name)
        : [...prev.faculties, name]
    }));
  };

  // ── Add single student (dynamic fields) ──────────────────────
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
    const fields = selectedBatch.studentFields || DEFAULT_STUDENT_FIELDS;
    const initForm = {};
    fields.forEach(f => { initForm[f.key] = ''; });
    initForm.staffAssigned = '';
    initForm.joinDate = '';
    initForm.status = 'active';
    setStudentForm(initForm);
    await loadBatchDetail(selectedBatch);
    const c = await getBatchStudentCount(selectedBatch.id);
    setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: c }));
    setSaving(false);
  };

  // ── Bulk import (dynamic fields) ─────────────────────────────
  const handleBulkImport = async () => {
    if (!csvPreview) return;
    setImporting(true);
    const fields = selectedBatch.studentFields || DEFAULT_STUDENT_FIELDS;
    const students = csvPreview.map(row => {
      const obj = {
        batchId: selectedBatch.id,
        batchName: selectedBatch.name,
        course: selectedBatch.course,
        courseDurationMonths: selectedBatch.courseDurationMonths || '',
        status: row.status || 'active',
      };
      fields.forEach(f => {
        const csvKey = f.key.toLowerCase().replace(/[^a-z0-9]/g, '');
        obj[f.key] = row[csvKey] || row[f.key] || '';
      });
      return obj;
    });
    const res = await bulkAddStudents(students);
    setToast({ message:`Imported ${res.success} students into ${selectedBatch.name}!`, type:'success' });
    setShowBulk(false);
    setCsvPreview(null);
    setImporting(false);
    await loadBatchDetail(selectedBatch);
    const c = await getBatchStudentCount(selectedBatch.id);
    setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: c }));
  };

  // ── Save course flow config ───────────────────────────────────
  const handleSaveFlowConfig = async () => {
    setSaving(true);
    await updateBatch(selectedBatch.id, { courseFlow: editFlow });
    const updated = { ...selectedBatch, courseFlow: editFlow };
    setSelectedBatch(updated);
    setBatches(prev => prev.map(b => b.id === selectedBatch.id ? updated : b));
    setShowFlowConfig(false);
    setToast({ message:'Course flow updated!', type:'success' });
    setSaving(false);
  };

  // ── Save student fields config ────────────────────────────────
  const handleSaveFieldConfig = async () => {
    setSaving(true);
    await updateBatch(selectedBatch.id, { studentFields: editFields });
    const updated = { ...selectedBatch, studentFields: editFields };
    setSelectedBatch(updated);
    setBatches(prev => prev.map(b => b.id === selectedBatch.id ? updated : b));
    setShowFieldConfig(false);
    setToast({ message:'Student fields updated!', type:'success' });
    setSaving(false);
  };

  // ── Save subject config ───────────────────────────────────────
  const handleSaveSubjectConfig = async () => {
    setSaving(true);
    await updateBatch(selectedBatch.id, { subjects: editSubjects });
    const updated = { ...selectedBatch, subjects: editSubjects };
    setSelectedBatch(updated);
    setBatches(prev => prev.map(b => b.id === selectedBatch.id ? updated : b));
    setShowSubjectConfig(false);
    setToast({ message:'Subjects updated!', type:'success' });
    setSaving(false);
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

  // ── Course flow analytics ─────────────────────────────────────
  const getFlowAnalytics = () => {
    const flow = selectedBatch?.courseFlow || DEFAULT_COURSE_FLOW;
    const analytics = flow.map(step => {
      const completed = batchStudents.filter(s => s.courseFlow?.[step.key]?.done);
      const notCompleted = batchStudents.filter(s => !s.courseFlow?.[step.key]?.done);
      return {
        ...step,
        completed: completed.length,
        notCompleted: notCompleted.length,
        total: batchStudents.length,
        pct: batchStudents.length > 0 ? Math.round(completed.length / batchStudents.length * 100) : 0,
        completedStudents: completed,
        notCompletedStudents: notCompleted,
      };
    });
    return analytics;
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
    const batchFlow = selectedBatch.courseFlow || DEFAULT_COURSE_FLOW;
    const batchFields = selectedBatch.studentFields || DEFAULT_STUDENT_FIELDS;
    const batchSubjects = selectedBatch.subjects || [];
    const flowAnalytics = getFlowAnalytics();
    const fullyOnboarded = batchStudents.filter(s =>
      batchFlow.every(step => s.courseFlow?.[step.key]?.done)
    ).length;

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
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {isCEOorAdmin && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditFlow([...batchFlow]); setShowFlowConfig(true); }}>
                  <Settings size={13}/> Course Flow
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditFields([...batchFields]); setShowFieldConfig(true); }}>
                  <Settings size={13}/> Student Fields
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditSubjects([...batchSubjects]); setShowSubjectConfig(true); }}>
                  <Settings size={13}/> Subjects
                </button>
              </>
            )}
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
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'Total Students',   value:count,                                                color:'#3B82F6', bg:'#DBEAFE' },
            { label:'Active',           value:batchStudents.filter(s=>s.status==='active').length,  color:'#10B981', bg:'#D1FAE5' },
            { label:'At Risk',          value:batchStudents.filter(s=>s.status==='at-risk').length, color:'#EF4444', bg:'#FEE2E2' },
            { label:'Onboarding Done',  value:fullyOnboarded,                                        color:'#8B5CF6', bg:'#EDE9FE' },
            { label:'Course Progress',  value:`${pct}%`,                                             color:'#E53935', bg:'#FEE2E2' },
          ].map(c => (
            <div key={c.label} style={{ background:'#fff', borderRadius:10, border:'1px solid #E5E7EB', padding:'10px 14px' }}>
              <div style={{ fontSize:11, color:'#6B7280', marginBottom:3 }}>{c.label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Faculties + subjects */}
        <div style={{ marginBottom:14, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {batchSubjects.length > 0 && batchSubjects.map((s,i) => (
            <span key={i} style={{ fontSize:11, padding:'3px 10px', borderRadius:10, background:'#EDE9FE', color:'#6D28D9', fontWeight:600 }}>
              📚 {s.name}{s.facultyName ? ` → ${s.facultyName}` : ''}
            </span>
          ))}
          {selectedBatch.faculties?.length > 0 && selectedBatch.faculties.map((f,i) => (
            <span key={i} className="badge badge-blue">{f}</span>
          ))}
        </div>

        {/* Tab bar */}
        <div className="tab-bar" style={{ marginBottom:16 }}>
          {[
            { key:'students',  label:`Students (${count})`                      },
            { key:'onboarding',label:`Onboarding Analytics`                     },
            { key:'schedule',  label:`Weekly Schedule (${schedules.length})`    },
            { key:'tasks',     label:`Assignments (${batchTasks.length})`       },
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
                <tr>
                  {batchFields.map(f => <th key={f.key}>{f.label}</th>)}
                  <th>Staff</th><th>Status</th><th>Onboarding</th><th></th>
                </tr>
              </thead>
              <tbody>
                {batchStudents.length === 0 && (
                  <tr><td colSpan={batchFields.length + 4} style={{ textAlign:'center', padding:40 }}>
                    <div style={{ color:'#6B7280', fontSize:13, marginBottom:12 }}>No students yet.</div>
                    <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                      <button className="btn btn-ghost" onClick={() => setShowBulk(true)}><Upload size={13}/> Import CSV</button>
                      {isCEOorAdmin && <button className="btn btn-primary" onClick={() => setShowAddStudent(true)}><UserPlus size={13}/> Add Manually</button>}
                    </div>
                  </td></tr>
                )}
                {batchStudents.map(s => {
                  const flowDone = batchFlow.filter(step => s.courseFlow?.[step.key]?.done).length;
                  const onboardDone = batchFlow.length > 0 && flowDone === batchFlow.length;
                  return (
                    <tr key={s.id}>
                      {batchFields.map(f => (
                        <td key={f.key} style={{ fontSize:13 }}>
                          {f.key === 'name'
                            ? <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <Avatar name={s[f.key]||'?'} size="sm"/>
                                <div style={{ fontWeight:500 }}>{s[f.key]||'—'}</div>
                              </div>
                            : s[f.key]||'—'}
                        </td>
                      ))}
                      <td style={{ fontSize:13 }}>{s.staffAssigned||'—'}</td>
                      <td><StatusBadge status={s.status}/></td>
                      <td>
                        <span style={{
                          fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600,
                          background: onboardDone ? '#D1FAE5' : '#FEF3C7',
                          color: onboardDone ? '#065F46' : '#92400E',
                        }}>
                          {flowDone}/{batchFlow.length} {onboardDone ? '✅' : '⏳'}
                        </span>
                      </td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>View <ChevronRight size={12}/></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── ONBOARDING ANALYTICS TAB ── */}
        {activeTab === 'onboarding' && (
          <div>
            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
              {[
                { label:'Fully Onboarded',    value:fullyOnboarded,          color:'#10B981', bg:'#D1FAE5' },
                { label:'In Progress',         value:count - fullyOnboarded,  color:'#F59E0B', bg:'#FEF3C7' },
                { label:'Total Flow Steps',    value:batchFlow.length,        color:'#3B82F6', bg:'#DBEAFE' },
              ].map(c => (
                <div key={c.label} style={{ background:'#fff', borderRadius:10, border:'1px solid #E5E7EB', padding:'14px 18px', textAlign:'center' }}>
                  <div style={{ fontSize:28, fontWeight:700, color:c.color }}>{c.value}</div>
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Per-step breakdown */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {flowAnalytics.map((step, idx) => (
                <div key={step.key} className="card">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ width:24, height:24, borderRadius:'50%', background:'#E53935', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{idx+1}</span>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>{step.label}</div>
                        <div style={{ fontSize:11, color:'#6B7280', textTransform:'capitalize' }}>{step.phase} phase</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:18, fontWeight:700, color: step.pct===100?'#10B981':step.pct>50?'#F59E0B':'#EF4444' }}>{step.pct}%</div>
                      <div style={{ fontSize:11, color:'#6B7280' }}>{step.completed}/{step.total} done</div>
                    </div>
                  </div>
                  <div className="progress-bar" style={{ marginBottom:10 }}>
                    <div className="progress-fill" style={{ width:`${step.pct}%`, background: step.pct===100?'#10B981':step.pct>50?'#F59E0B':'#EF4444' }}/>
                  </div>

                  {/* Not completed students */}
                  {step.notCompleted > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:600, color:'#EF4444', marginBottom:4 }}>
                        ⏳ {step.notCompleted} student{step.notCompleted>1?'s':''} yet to complete:
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {step.notCompletedStudents.map(s => (
                          <span key={s.id} style={{ fontSize:11, padding:'2px 8px', background:'#FEE2E2', color:'#991B1B', borderRadius:10 }}>
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Not onboarded students list */}
            {count - fullyOnboarded > 0 && (
              <div className="card" style={{ marginTop:16 }}>
                <h3 style={{ fontSize:14, fontWeight:600, marginBottom:12, color:'#EF4444' }}>
                  ⚠️ Students Not Fully Onboarded ({count - fullyOnboarded})
                </h3>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {batchStudents.filter(s => !batchFlow.every(step => s.courseFlow?.[step.key]?.done)).map(s => {
                    const done = batchFlow.filter(step => s.courseFlow?.[step.key]?.done).length;
                    const pending = batchFlow.filter(step => !s.courseFlow?.[step.key]?.done).map(st => st.label);
                    return (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'#FFF8F8', borderRadius:8, border:'1px solid #FEE2E2' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <Avatar name={s.name} size="sm"/>
                          <div>
                            <div style={{ fontSize:13, fontWeight:500 }}>{s.name}</div>
                            <div style={{ fontSize:11, color:'#6B7280' }}>
                              {done}/{batchFlow.length} steps · Pending: {pending.slice(0,2).join(', ')}{pending.length>2?` +${pending.length-2} more`:''}
                            </div>
                          </div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>
                          View <ChevronRight size={12}/>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!window.confirm('Delete this schedule slot?')) return;
                                await deleteBatchSchedule(slot.id);
                                const sch = await getBatchSchedules(selectedBatch.id);
                                setSchedules(sch);
                              }}
                              style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', padding:'4px' }}
                            >
                              <Trash2 size={14}/>
                            </button>
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

        {/* ── TASKS / ASSIGNMENTS TAB ── */}
        {activeTab === 'tasks' && (
          <div>
            {/* Subject filter tabs */}
            {batchSubjects.length > 0 && (
              <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, color:'#6B7280', alignSelf:'center' }}>Filter by subject:</span>
                {batchSubjects.map((sub,i) => (
                  <span key={i} style={{
                    fontSize:12, padding:'4px 12px', borderRadius:20, cursor:'pointer',
                    background:'#EDE9FE', color:'#6D28D9', fontWeight:500,
                  }}>
                    📚 {sub.name}
                    {sub.facultyName && <span style={{ fontSize:10, opacity:0.7, marginLeft:4 }}>({sub.facultyName})</span>}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {batchTasks.length === 0 && (
                <div className="card" style={{ textAlign:'center', color:'#6B7280', padding:40 }}>
                  No assignments created yet. Click "Add Task" to assign work to students.
                </div>
              )}
              {batchTasks.map(task => {
                const submitted   = task.submittedBy?.length || 0;
                const total       = batchStudents.length || 1;
                const pctDone     = Math.round(submitted/total*100);
                const notSubmitted = batchStudents.filter(s => !task.submittedBy?.find(x => x.studentId === s.id));
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && submitted < total;
                return (
                  <div key={task.id} className="card" style={{ cursor:'pointer', border: isOverdue ? '1px solid #FECACA' : '1px solid #E5E7EB' }} onClick={() => setShowTaskDetail(task)}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14 }}>{task.title}</div>
                        <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                          {task.subject && <span style={{ background:'#EDE9FE', color:'#6D28D9', padding:'1px 7px', borderRadius:10, marginRight:6, fontSize:11 }}>📚 {task.subject}</span>}
                          {task.assignedFaculty && `👤 ${task.assignedFaculty}`}
                          {task.dueDate && ` · Due: ${task.dueDate}`}
                          {isOverdue && <span style={{ color:'#EF4444', fontWeight:600, marginLeft:6 }}>⚠️ Overdue</span>}
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
                      {notSubmitted.length>0 ? `${notSubmitted.length} not submitted — click to see` : '✅ All submitted!'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MODALS ── */}

        {/* Add Student — dynamic fields */}
        {showAddStudent && (
          <Modal title={`Add Student to ${selectedBatch.name}`} onClose={() => setShowAddStudent(false)} wide>
            <div style={{ padding:'8px 12px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:14 }}>
              Student will be placed in <strong>{selectedBatch.name}</strong> ({selectedBatch.course}).
            </div>
            <form onSubmit={handleAddStudent} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {batchFields.map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">{f.label}{f.required?' *':''}</label>
                    <input
                      className="form-input"
                      type={f.type || 'text'}
                      required={f.required}
                      value={studentForm[f.key] || ''}
                      onChange={e => setStudentForm({...studentForm, [f.key]: e.target.value})}
                    />
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Staff Assigned</label>
                  <select className="form-input" value={studentForm.staffAssigned||''} onChange={e => setStudentForm({...studentForm, staffAssigned: e.target.value})}>
                    <option value="">Select</option>
                    {staffList.map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Join Date</label>
                  <input className="form-input" type="date" value={studentForm.joinDate||''} onChange={e => setStudentForm({...studentForm, joinDate: e.target.value})}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddStudent(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Adding...':'Add to Batch'}</button>
              </div>
            </form>
          </Modal>
        )}

        {/* Bulk Import — dynamic fields */}
        {showBulk && (
          <Modal title={`Bulk Import into ${selectedBatch.name}`} onClose={() => { setShowBulk(false); setCsvPreview(null); }} wide>
            <div style={{ padding:'8px 12px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:14 }}>
              CSV columns for this batch: <strong>{batchFields.map(f=>f.key).join(', ')}</strong>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:14 }} onClick={() => downloadTemplate(selectedBatch.name, batchFields)}>
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
            </div>
            {csvPreview && (
              <div className="table-container" style={{ maxHeight:180, overflow:'auto', marginBottom:12 }}>
                <table>
                  <thead><tr><th>#</th>{batchFields.slice(0,4).map(f=><th key={f.key}>{f.label}</th>)}</tr></thead>
                  <tbody>
                    {csvPreview.slice(0,6).map((r,i)=>(
                      <tr key={i}>
                        <td style={{ color:'#9CA3AF' }}>{i+1}</td>
                        {batchFields.slice(0,4).map(f=><td key={f.key} style={{ fontSize:12 }}>{r[f.key]||r[f.key.toLowerCase().replace(/[^a-z0-9]/g,'')]||'—'}</td>)}
                      </tr>
                    ))}
                    {csvPreview.length>6&&<tr><td colSpan={5} style={{ textAlign:'center', color:'#6B7280', padding:8 }}>...and {csvPreview.length-6} more</td></tr>}
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

        {/* Course Flow Config Modal */}
        {showFlowConfig && (
          <Modal title={`Configure Course Flow — ${selectedBatch.name}`} onClose={() => setShowFlowConfig(false)} wide>
            <div style={{ fontSize:12, color:'#6B7280', marginBottom:14 }}>
              Define the onboarding and course steps for this batch. Students will track their progress through these steps.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {editFlow.map((step, idx) => (
                <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background:'#F9FAFB', borderRadius:8 }}>
                  <span style={{ width:24, height:24, borderRadius:'50%', background:'#E53935', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{idx+1}</span>
                  <input className="form-input" style={{ flex:2 }} value={step.label}
                    onChange={e => {
                      const updated = [...editFlow];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setEditFlow(updated);
                    }}/>
                  <select className="form-input" style={{ flex:1 }} value={step.phase}
                    onChange={e => {
                      const updated = [...editFlow];
                      updated[idx] = { ...updated[idx], phase: e.target.value };
                      setEditFlow(updated);
                    }}>
                    {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" style={{ color:'#EF4444' }}
                    onClick={() => setEditFlow(editFlow.filter((_,i) => i !== idx))}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }}
              onClick={() => setEditFlow([...editFlow, { key: generateKey('step'), label: 'New Step', phase: 'course' }])}>
              <Plus size={13}/> Add Step
            </button>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowFlowConfig(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveFlowConfig} disabled={saving}>{saving?'Saving...':'Save Flow'}</button>
            </div>
          </Modal>
        )}

        {/* Student Fields Config Modal */}
        {showFieldConfig && (
          <Modal title={`Configure Student Fields — ${selectedBatch.name}`} onClose={() => setShowFieldConfig(false)} wide>
            <div style={{ fontSize:12, color:'#6B7280', marginBottom:14 }}>
              Define what data to collect for students in this batch. These fields appear in the Add Student form and CSV import template.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {editFields.map((field, idx) => (
                <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background:'#F9FAFB', borderRadius:8 }}>
                  <input className="form-input" style={{ flex:2 }} placeholder="Label (e.g. Parent Name)"
                    value={field.label}
                    onChange={e => {
                      const updated = [...editFields];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      setEditFields(updated);
                    }}/>
                  <select className="form-input" style={{ flex:1 }} value={field.type||'text'}
                    onChange={e => {
                      const updated = [...editFields];
                      updated[idx] = { ...updated[idx], type: e.target.value };
                      setEditFields(updated);
                    }}>
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                  </select>
                  <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, whiteSpace:'nowrap' }}>
                    <input type="checkbox" checked={field.required||false}
                      onChange={e => {
                        const updated = [...editFields];
                        updated[idx] = { ...updated[idx], required: e.target.checked };
                        setEditFields(updated);
                      }}/> Required
                  </label>
                  <button className="btn btn-ghost btn-sm" style={{ color:'#EF4444' }}
                    onClick={() => setEditFields(editFields.filter((_,i) => i !== idx))}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }}
              onClick={() => setEditFields([...editFields, { key: generateKey('field'), label: 'New Field', required: false, type: 'text' }])}>
              <Plus size={13}/> Add Field
            </button>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowFieldConfig(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveFieldConfig} disabled={saving}>{saving?'Saving...':'Save Fields'}</button>
            </div>
          </Modal>
        )}

        {/* Subject-Faculty Config Modal */}
        {showSubjectConfig && (
          <Modal title={`Configure Subjects — ${selectedBatch.name}`} onClose={() => setShowSubjectConfig(false)} wide>
            <div style={{ fontSize:12, color:'#6B7280', marginBottom:14 }}>
              Assign subjects to faculties. Faculty can then create subject-specific tasks for students.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {editSubjects.map((sub, idx) => (
                <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background:'#F9FAFB', borderRadius:8 }}>
                  <input className="form-input" style={{ flex:2 }} placeholder="Subject name (e.g. Python, Mathematics)"
                    value={sub.name}
                    onChange={e => {
                      const updated = [...editSubjects];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      setEditSubjects(updated);
                    }}/>
                  <select className="form-input" style={{ flex:2 }} value={sub.facultyName||''}
                    onChange={e => {
                      const updated = [...editSubjects];
                      updated[idx] = { ...updated[idx], facultyName: e.target.value };
                      setEditSubjects(updated);
                    }}>
                    <option value="">Select Faculty</option>
                    {(selectedBatch.faculties||[]).map((f,i)=><option key={i}>{f}</option>)}
                    {staffList.map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" style={{ color:'#EF4444' }}
                    onClick={() => setEditSubjects(editSubjects.filter((_,i) => i !== idx))}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }}
              onClick={() => setEditSubjects([...editSubjects, { name: '', facultyName: '' }])}>
              <Plus size={13}/> Add Subject
            </button>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowSubjectConfig(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSubjectConfig} disabled={saving}>{saving?'Saving...':'Save Subjects'}</button>
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
                <div className="form-group"><label className="form-label">Duration (min)</label><input className="form-input" type="number" value={scheduleForm.duration} onChange={e=>setScheduleForm({...scheduleForm,duration:e.target.value})}/></div>
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
          <Modal title="Create Assignment / Task" onClose={() => setShowTask(false)}>
            <form onSubmit={handleAddTask} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="form-group"><label className="form-label">Task Title *</label><input className="form-input" required placeholder="e.g. Complete Chapter 3 exercises" value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})}/></div>
              <FormRow>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select className="form-input" value={taskForm.subject} onChange={e=>setTaskForm({...taskForm,subject:e.target.value})}>
                    <option value="">Select subject</option>
                    {batchSubjects.map((s,i)=><option key={i} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Assigned Faculty</label>
                  <select className="form-input" value={taskForm.assignedFaculty} onChange={e=>setTaskForm({...taskForm,assignedFaculty:e.target.value})}>
                    <option value="">Select faculty</option>
                    {(selectedBatch.faculties||[]).map((f,i)=><option key={i}>{f}</option>)}
                    {staffList.map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </FormRow>
              <div className="form-group"><label className="form-label">Description / Instructions</label><textarea className="form-input" rows={3} value={taskForm.description} onChange={e=>setTaskForm({...taskForm,description:e.target.value})}/></div>
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
              {showTaskDetail.subject && <span style={{ background:'#EDE9FE', color:'#6D28D9', padding:'2px 10px', borderRadius:10, fontSize:12, marginRight:8 }}>📚 {showTaskDetail.subject}</span>}
              {showTaskDetail.assignedFaculty && <span style={{ background:'#DBEAFE', color:'#1E40AF', padding:'2px 10px', borderRadius:10, fontSize:12 }}>👤 {showTaskDetail.assignedFaculty}</span>}
              {showTaskDetail.description && <div style={{ fontSize:13, lineHeight:1.6, marginTop:10 }}>{showTaskDetail.description}</div>}
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
        <strong>Flow:</strong> Create batch → configure course flow &amp; student fields → assign subjects to faculties → add students → track onboarding analytics
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
                  {b.subjects?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
                      {b.subjects.slice(0,3).map((s,i)=>(
                        <span key={i} style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:'#EDE9FE', color:'#6D28D9', fontWeight:600 }}>{s.name}</span>
                      ))}
                      {b.subjects.length>3 && <span style={{ fontSize:10, color:'#6B7280' }}>+{b.subjects.length-3}</span>}
                    </div>
                  )}
                  {b.faculties?.length>0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                      {b.faculties.map((f,i)=>(
                        <span key={i} style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:'#DBEAFE', color:'#1E40AF', fontWeight:600 }}>{f}</span>
                      ))}
                    </div>
                  )}
                  {b.status==='active' && (
                    <div className="progress-bar" style={{ marginTop:4 }}>
                      <div className="progress-fill" style={{ width:`${progress(b)}%`, background:'#E53935' }}/>
                    </div>
                  )}
                  <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid var(--border)', fontSize:12, color:'#E53935', display:'flex', alignItems:'center', gap:4 }}>
                    {b.courseFlow?.length || DEFAULT_COURSE_FLOW.length} flow steps · {b.studentFields?.length || DEFAULT_STUDENT_FIELDS.length} fields <ChevronRight size={12}/>
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
            <div className="form-group"><label className="form-label">Batch Name *</label><input className="form-input" required placeholder="e.g. ISC Level 1 — June 2026" value={createForm.name} onChange={e=>setCreateForm({...createForm,name:e.target.value})}/></div>
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
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={createForm.startDate} onChange={e=>setCreateForm({...createForm,startDate:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={createForm.endDate} onChange={e=>setCreateForm({...createForm,endDate:e.target.value})}/></div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Assign Faculties / Staff</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'10px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)', minHeight:48 }}>
                {staffList.filter(s=>s.role!=='ceo').map(s=>(
                  <div key={s.id} onClick={() => toggleFaculty(s.name)} style={{
                    padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:500,
                    background: createForm.faculties.includes(s.name)?'#E53935':'var(--white)',
                    color:      createForm.faculties.includes(s.name)?'#fff':'var(--text)',
                    border:     `1px solid ${createForm.faculties.includes(s.name)?'#E53935':'var(--border)'}`,
                  }}>
                    {s.name} <span style={{ fontSize:10, opacity:0.7 }}>({s.role})</span>
                  </div>
                ))}
              </div>
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
            <div style={{ padding:'10px 12px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF' }}>
              💡 After creating the batch, click "Course Flow", "Student Fields", and "Subjects" buttons inside the batch to customize them.
            </div>
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
