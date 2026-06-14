import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getBatches, addBatch, updateBatch,
  getBatchStudents, addStudent, bulkAddStudents, getBatchStudentCount, updateStudent,
  getStaffProfiles, getBatchSchedules, addBatchSchedule, deleteBatchSchedule,
  getBatchTasks, addBatchTask, markTaskSubmitted, updateBatchTask, deleteBatchTask,
  updateScheduleStatus, saveAttendance, getSessionAttendance,
  addNotification, getTrashItems, permanentDelete,
  createRequest,
  getAssessments, addAssessment, deleteAssessment, getAssessmentResults, saveAssessmentResults,
} from '../firebase/services';
import {
  collection, addDoc, deleteDoc, doc, setDoc, serverTimestamp, getDocs, query, where, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Modal, Toast, Loading, FormRow, Avatar, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { sendAssignmentEmail } from '../firebase/emailService';
import {
  Plus, Upload, UserPlus, ChevronRight, ArrowLeft,
  Download, CheckSquare, Users, Trash2, Settings,
  AlertTriangle, CheckCircle, X, Search, Pencil
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

// Fields match the Google Form CSV columns in order:
// Timestamp(→joinDate), Name of Father, Name of Mother, Email, Address,
// Phone number, Whatsapp Number, Occupation, Kids Name(→name), Gender, Age, Class, School Name
const DEFAULT_STUDENT_FIELDS = [
  { key: 'fatherName',    label: 'Name of Father',            required: false, type: 'text'  },
  { key: 'motherName',    label: 'Name of Mother',            required: false, type: 'text'  },
  { key: 'email',         label: 'Email',                     required: false, type: 'email' },
  { key: 'address',       label: 'Address',                   required: false, type: 'text'  },
  { key: 'phone',         label: 'Phone Number',              required: false, type: 'text'  },
  { key: 'whatsappNumber',label: 'Whatsapp Number',           required: false, type: 'text'  },
  { key: 'occupation',    label: 'Occupation',                required: false, type: 'text'  },
  { key: 'name',          label: "Kids Name",                 required: true,  type: 'text'  },
  { key: 'gender',        label: 'Gender',                    required: false, type: 'text'  },
  { key: 'age',           label: 'Age',                       required: false, type: 'number'},
  { key: 'classStd',      label: 'Class',                     required: false, type: 'text'  },
  { key: 'schoolName',    label: 'School Name',               required: false, type: 'text'  },
  { key: 'varkResult',    label: 'VARK Learning Style',       required: false, type: 'text'  },
  { key: 'syllabus',      label: 'Syllabus (CBSE/STATE/ICSE)',required: false, type: 'text'  },
];

function generateKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Math.random().toString(36).slice(2,5);
}

function normalize(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }

// Fuzzy-match a CSV header to a field key or label
function matchCsvHeader(csvHeader, fields) {
  const n = normalize(csvHeader);
  // Exact key match
  let f = fields.find(f => normalize(f.key) === n);
  if (f) return f.key;
  // Exact label match
  f = fields.find(f => normalize(f.label) === n);
  if (f) return f.key;
  // Partial key match
  f = fields.find(f => n.includes(normalize(f.key)) || normalize(f.key).includes(n));
  if (f) return f.key;
  // Partial label match
  f = fields.find(f => n.includes(normalize(f.label)) || normalize(f.label).includes(n));
  if (f) return f.key;
  return n; // fallback to normalized header
}

// Proper RFC-4180 CSV parser — handles quoted fields with commas and newlines inside
function parseCsvLine(line) {
  const fields = [];
  let cur = '', inQuote = false;
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
  fields.push(cur.trim());
  return fields;
}

function parseCSVText(text) {
  // Split into lines but respect quoted newlines
  const rows = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuote = !inQuote; cur += ch; }
    else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (cur.trim()) rows.push(cur);
      cur = '';
      if (ch === '\r' && text[i+1] === '\n') i++;
    } else { cur += ch; }
  }
  if (cur.trim()) rows.push(cur);
  return rows;
}

function parseCSV(text, fields) {
  const lines = parseCSVText(text);
  if (lines.length === 0) return [];
  const rawHeaders = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g,'').trim());
  const colKeys = rawHeaders.map(h => fields ? matchCsvHeader(h, fields) : normalize(h));
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]).map(v => v.replace(/^"|"$/g,'').trim());
    if (vals.every(v => !v)) continue;
    const obj = {};
    colKeys.forEach((key, idx) => { obj[key] = vals[idx] || ''; });
    result.push(obj);
  }
  return result;
}

function downloadTemplate(batchName, fields) {
  const headers = fields.map(f => f.key);
  const example = fields.map(f => {
    if (f.key === 'name') return 'Fathima Aysha';
    if (f.key === 'phone') return '+91 98432 11234';
    if (f.key === 'email') return 'fathima@email.com';
    if (f.key === 'classStd') return 'Class 10';
    return '';
  });
  const blob = new Blob([headers.join(',')+'\n'+example.join(',')], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${batchName||'batch'}_template.csv`;
  a.click();
}

// ─── Onboarding Step Side Panel ───────────────────────────────────────────────
const VARK_OPTIONS = ['Visual', 'Auditory', 'Read/Write', 'Kinesthetic', 'Visual-Auditory', 'Visual-Kinesthetic', 'Auditory-Kinesthetic', 'Multimodal'];

function OnboardingStepPanel({ step, onClose, onMarkComplete, onMarkVark, onRevoke }) {
  const [tab, setTab] = useState('not');
  const [search, setSearch] = useState('');
  const [varkSelections, setVarkSelections] = useState({});
  const [assessNotes, setAssessNotes] = useState({}); // studentId → note (for initial_assess)
  const [marking, setMarking] = useState({});
  // Local lists for instant UI update (optimistic)
  const [localCompleted, setLocalCompleted]       = useState([]);
  const [localNotCompleted, setLocalNotCompleted] = useState([]);

  useEffect(() => {
    setLocalCompleted(step?.completedStudents || []);
    setLocalNotCompleted(step?.notCompletedStudents || []);
    setSearch('');
    setAssessNotes({});
  }, [step?.key]);

  if (!step) return null;

  const isVark    = step.key === 'vark_analysis';
  const isAssess  = step.key === 'initial_assess';

  const filteredNot = localNotCompleted.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
  );
  const filteredDone = localCompleted.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
  );

  const doMark = async (s) => {
    if (s.status === 'dropped') { alert(`${s.name} is a dropped student — cannot mark steps.`); return; }
    if (isVark && !varkSelections[s.id]) return;
    setMarking(prev => ({ ...prev, [s.id]: true }));
    // Optimistic update
    setLocalNotCompleted(prev => prev.filter(x => x.id !== s.id));
    setLocalCompleted(prev => [...prev, { ...s, varkResult: isVark ? varkSelections[s.id] : s.varkResult }]);
    try {
      if (isVark) await onMarkVark(s.id, step.key, varkSelections[s.id]);
      else await onMarkComplete(s.id, step.key, isAssess ? (assessNotes[s.id] || '') : undefined);
    } catch {
      // Revert on error
      setLocalCompleted(prev => prev.filter(x => x.id !== s.id));
      setLocalNotCompleted(prev => [...prev, s]);
    }
    setMarking(prev => ({ ...prev, [s.id]: false }));
  };

  const doRevoke = async (s) => {
    setMarking(prev => ({ ...prev, [s.id]: true }));
    setLocalCompleted(prev => prev.filter(x => x.id !== s.id));
    setLocalNotCompleted(prev => [...prev, s]);
    try {
      await onRevoke(s.id, step.key);
    } catch {
      setLocalCompleted(prev => [...prev, s]);
      setLocalNotCompleted(prev => prev.filter(x => x.id !== s.id));
    }
    setMarking(prev => ({ ...prev, [s.id]: false }));
  };

  return (
    <div style={{ position:'fixed', top:0, right:0, width:440, height:'100vh', background:'#fff', boxShadow:'-4px 0 24px rgba(0,0,0,0.12)', zIndex:1000, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'18px 20px', borderBottom:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:15, color:'#1A1A2E' }}>{step.label}</div>
          <div style={{ fontSize:12, color:'#9CA3AF', textTransform:'capitalize' }}>{step.phase} phase</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:4 }}><X size={18}/></button>
      </div>
      {/* Search */}
      <div style={{ padding:'10px 16px', borderBottom:'1px solid #F3F4F6' }}>
        <input className="form-input" placeholder="Search student by name or phone..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ fontSize:12 }}/>
      </div>
      <div style={{ display:'flex', borderBottom:'1px solid #E5E7EB' }}>
        {[
          { key:'not',       label:`Not Completed (${localNotCompleted.length})`, color:'#EF4444' },
          { key:'completed', label:`Completed (${localCompleted.length})`,         color:'#10B981' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex:1, padding:'10px 0', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none',
              borderBottom: tab===t.key ? `2px solid ${t.color}` : '2px solid transparent',
              color: tab===t.key ? t.color : '#9CA3AF', transition:'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
        {tab === 'not' && (
          <>
            {filteredNot.length === 0 && <div style={{ color:'#9CA3AF', fontSize:13, textAlign:'center', paddingTop:40 }}>{search ? 'No match.' : 'All students completed this step!'}</div>}
            {filteredNot.map(s => {
              const isDropped = s.status === 'dropped';
              return (
                <div key={s.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:10, borderRadius:8, marginBottom:6, background: isDropped ? '#F9FAFB' : '#FFF8F8', border:`1px solid ${isDropped ? '#E5E7EB' : '#FEE2E2'}` }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background: isDropped ? '#E5E7EB' : '#FEE2E2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: isDropped ? '#9CA3AF' : '#E53935', flexShrink:0, marginTop:2 }}>
                    {(s.name||'?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
                      {s.name}
                      {isDropped && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background:'#E5E7EB', color:'#6B7280', fontWeight:600 }}>Dropped</span>}
                    </div>
                    <div style={{ fontSize:11, color:'#9CA3AF', marginBottom: isVark ? 6 : 0 }}>{s.phone||'—'}</div>
                    {!isDropped && isVark && (
                      <select value={varkSelections[s.id]||''} onChange={e => setVarkSelections(p => ({ ...p, [s.id]:e.target.value }))}
                        style={{ fontSize:11, padding:'3px 6px', borderRadius:6, border:'1px solid #E5E7EB', width:'100%', marginBottom:6 }}>
                        <option value="">Select VARK result...</option>
                        {VARK_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    )}
                    {!isDropped && isAssess && (
                      <textarea
                        rows={2}
                        value={assessNotes[s.id] || ''}
                        onChange={e => setAssessNotes(p => ({ ...p, [s.id]: e.target.value }))}
                        placeholder="Add assessment notes (optional)…"
                        style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:'1px solid #E5E7EB', width:'100%', marginBottom:6, resize:'vertical', fontFamily:'inherit' }}
                      />
                    )}
                    {!isDropped && (
                      <button disabled={marking[s.id] || (isVark && !varkSelections[s.id])}
                        onClick={() => doMark(s)}
                        style={{ fontSize:11, padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer', fontWeight:600,
                          background: marking[s.id] ? '#E5E7EB' : '#D1FAE5', color: marking[s.id] ? '#9CA3AF' : '#065F46',
                          opacity: isVark && !varkSelections[s.id] ? 0.5 : 1 }}>
                        {marking[s.id] ? 'Saving...' : isVark ? '✓ Mark Complete + Save VARK' : '✓ Mark Complete'}
                      </button>
                    )}
                    {isDropped && <div style={{ fontSize:11, color:'#9CA3AF', fontStyle:'italic' }}>Cannot mark — student is dropped</div>}
                  </div>
                </div>
              );
            })}
          </>
        )}
        {tab === 'completed' && (
          <>
            {filteredDone.length === 0 && <div style={{ color:'#9CA3AF', fontSize:13, textAlign:'center', paddingTop:40 }}>{search ? 'No match.' : 'No students completed yet.'}</div>}
            {filteredDone.map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:8, marginBottom:4, background:'#F0FDF4', border:'1px solid #BBF7D0' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'#D1FAE5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#065F46', flexShrink:0 }}>
                  {(s.name||'?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'#9CA3AF' }}>
                    {s.phone||'—'}
                    {isVark && s.varkResult && <span style={{ marginLeft:6, fontWeight:600, color:'#6D28D9' }}>· {s.varkResult}</span>}
                  </div>
                  {isAssess && s.assessmentNote && (
                    <div style={{ fontSize:11, color:'#64748B', marginTop:2, fontStyle:'italic' }}>Note: {s.assessmentNote}</div>
                  )}
                </div>
                <CheckCircle size={14} style={{ color:'#10B981', flexShrink:0 }}/>
                <button disabled={marking[s.id]} onClick={() => doRevoke(s)}
                  style={{ fontSize:10, padding:'2px 8px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', color:'#9CA3AF', cursor:'pointer', flexShrink:0 }}>
                  {marking[s.id] ? '...' : 'Undo'}
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
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
  const [showFlowConfig,  setShowFlowConfig]  = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);
  const [showSubjectConfig, setShowSubjectConfig] = useState(false);
  const [showAttendance,  setShowAttendance]  = useState(null);
  const [confirmDialog,   setConfirmDialog]   = useState(null); // { message, onConfirm }
  const [attendanceCsv,   setAttendanceCsv]   = useState(null);
  const [attendancePreview, setAttendancePreview] = useState(null);
  const [attendanceSaved, setAttendanceSaved] = useState({});
  const attendanceFileRef = useRef();

  // Staff tab state
  const [showAddStaff,    setShowAddStaff]    = useState(false);
  const [staffSearch,     setStaffSearch]     = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [removalReason,   setRemovalReason]   = useState('');
  const [showRemovalModal, setShowRemovalModal] = useState(null); // { uid, name, targetType, targetId, targetName }

  // Delete batch / student confirmation
  const [deleteStudentConfirm, setDeleteStudentConfirm] = useState(null); // student object

  // Onboarding analytics side panel
  const [selectedStep, setSelectedStep]     = useState(null);

  // Task split panel
  const [selectedTask, setSelectedTask]     = useState(null);
  const [taskFilter, setTaskFilter]         = useState('all');
  const [editingTask, setEditingTask]       = useState(null); // { id, title }
  const [taskKpiFilter, setTaskKpiFilter]   = useState('all'); // 'all'|'pending'|'submitted'
  const [taskSearch, setTaskSearch]         = useState('');

  // Overdue class confirmation dialog
  const [overdueConfirm, setOverdueConfirm] = useState(null);

  // Calendar schedule view state
  const [calendarView, setCalendarView] = useState('week'); // 'week' | 'month'
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarSlotDetail, setCalendarSlotDetail] = useState(null); // slot shown in popover

  // Share schedule modal
  const [showShareSchedule, setShowShareSchedule] = useState(false);

  // Assessments tab
  const [batchAssessments, setBatchAssessments]     = useState([]);
  const [showCreateAssessment, setShowCreateAssessment] = useState(false);
  const [assessmentForm, setAssessmentForm]         = useState({ title:'', date:'', totalMarks:'', conductingStaff:[] });
  const [assessmentResults, setAssessmentResults]   = useState({}); // assessmentId → results[]
  const [showViewResults, setShowViewResults]       = useState(null); // assessment object
  const [showImportMarks, setShowImportMarks]       = useState(null); // assessment object
  const [marksPreview, setMarksPreview]             = useState(null);
  const [importingMarks, setImportingMarks]         = useState(false);
  const marksFileRef = useRef();

  // Batch create form
  const [createForm, setCreateForm] = useState({
    name:'', course:'', mentorId:'', mentorName:'', faculties:[], startDate:'', endDate:'',
    status:'upcoming', maxSeats:'', courseDurationMonths:'',
    courseFlow: DEFAULT_COURSE_FLOW,
    studentFields: DEFAULT_STUDENT_FIELDS,
    subjects: [], staffIds: [], staffDetails: [],
  });

  const [studentForm, setStudentForm] = useState({});

  const [scheduleForm, setScheduleForm] = useState({
    title:'', day:'Monday', scheduledDate:'', time:'', duration:'60', type:'live-class',
    facultyName:'', meetLink:'', notes:''
  });
  const [taskForm, setTaskForm] = useState({
    title:'', subject:'', description:'', dueDate:'', assignedFaculty:''
  });

  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('');
  const [studentPage, setStudentPage] = useState(0);

  const [editFlow, setEditFlow]         = useState([]);
  const [editFields, setEditFields]     = useState([]);
  const [editSubjects, setEditSubjects] = useState([]);

  const loadBatches = async () => {
    const [b, s] = await Promise.all([getBatches(), getStaffProfiles()]);
    // Staff only see batches they are assigned to (as mentor or staff member)
    const uid = profile?.uid;
    const isStaff = !isCEOorAdmin;
    const filtered = isStaff
      ? b.filter(batch => batch.mentorId === uid || (batch.staffIds || []).includes(uid))
      : b;
    setBatches(filtered);
    setStaffList(s.filter(x => x.active !== false));
    const counts = {};
    await Promise.all(filtered.map(async batch => { counts[batch.id] = await getBatchStudentCount(batch.id); }));
    setBatchCounts(counts);
    setLoading(false);
  };

  const loadBatchDetail = async (batch) => {
    try {
      const [res, sch, tasks, asmts] = await Promise.all([
        getBatchStudents(batch.id).catch(() => ({ students: [] })),
        getBatchSchedules(batch.id).catch(() => []),
        getBatchTasks(batch.id).catch(() => []),
        getAssessments(batch.id).catch(() => []),
      ]);
      setBatchStudents(res.students || []);
      setSchedules(sch || []);
      setBatchTasks(tasks || []);
      setBatchAssessments(asmts || []);
    } catch (err) {
      console.error('loadBatchDetail error:', err);
      setBatchStudents([]); setSchedules([]); setBatchTasks([]); setBatchAssessments([]);
    }
  };

  useEffect(() => { loadBatches(); }, []);

  const openBatch = async (batch) => {
    setSelectedBatch(batch);
    setActiveTab('students');
    setStudentSearch('');
    setStudentStatusFilter('');
    setStudentPage(0);
    setSelectedTask(null);
    const fields = batch.studentFields || DEFAULT_STUDENT_FIELDS;
    const initForm = {};
    fields.forEach(f => { initForm[f.key] = ''; });
    initForm.staffAssigned = '';
    initForm.joinDate = '';
    initForm.status = 'active';
    setStudentForm(initForm);
    await loadBatchDetail(batch);
  };

  // ── CRUD handlers ─────────────────────────────────────────────
  const handleCreateBatch = async (e) => {
    e.preventDefault(); setSaving(true);
    await addBatch(createForm);
    setToast({ message:`Batch "${createForm.name}" created!`, type:'success' });
    setShowCreate(false);
    setCreateForm({ name:'', course:'', mentorId:'', mentorName:'', faculties:[], startDate:'', endDate:'', status:'upcoming', maxSeats:'', courseDurationMonths:'', courseFlow:DEFAULT_COURSE_FLOW, studentFields:DEFAULT_STUDENT_FIELDS, subjects:[], staffIds:[], staffDetails:[] });
    await loadBatches(); setSaving(false);
  };

  const toggleFaculty = (name) => {
    setCreateForm(prev => ({
      ...prev,
      faculties: prev.faculties.includes(name)
        ? prev.faculties.filter(f => f !== name)
        : [...prev.faculties, name]
    }));
  };

  const handleAddStudent = async (e) => {
    e.preventDefault(); setSaving(true);
    await addStudent({ ...studentForm, batchId:selectedBatch.id, batchName:selectedBatch.name, course:selectedBatch.course, courseDurationMonths:selectedBatch.courseDurationMonths||'' });
    setToast({ message:'Student added!', type:'success' });
    setShowAddStudent(false);
    const fields = selectedBatch.studentFields || DEFAULT_STUDENT_FIELDS;
    const initForm = {};
    fields.forEach(f => { initForm[f.key] = ''; });
    initForm.staffAssigned = ''; initForm.joinDate = ''; initForm.status = 'active';
    setStudentForm(initForm);
    await loadBatchDetail(selectedBatch);
    const c = await getBatchStudentCount(selectedBatch.id);
    setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: c }));
    setSaving(false);
  };

  const handleBulkImport = async () => {
    if (!csvPreview) return; setImporting(true);
    const fields = selectedBatch.studentFields || DEFAULT_STUDENT_FIELDS;
    const students = csvPreview.map(row => {
      const obj = { batchId:selectedBatch.id, batchName:selectedBatch.name, course:selectedBatch.course, courseDurationMonths:selectedBatch.courseDurationMonths||'', status:row.status||'active' };
      // Extract join date from Timestamp column if present
      const ts = row['timestamp'] || row['Timestamp'] || row['timestamp'];
      if (ts) {
        try {
          const d = new Date(ts);
          if (!isNaN(d)) obj.joinDate = d.toISOString().split('T')[0];
        } catch {}
      }
      fields.forEach(f => { obj[f.key] = row[f.key] || ''; });
      return obj;
    });
    const res = await bulkAddStudents(students);
    setToast({ message:`Imported ${res.success} students!`, type:'success' });
    setShowBulk(false); setCsvPreview(null); setImporting(false);
    await loadBatchDetail(selectedBatch);
    const c = await getBatchStudentCount(selectedBatch.id);
    setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: c }));
  };

  const handleSaveFlowConfig = async () => {
    setSaving(true);
    await updateBatch(selectedBatch.id, { courseFlow:editFlow });
    const updated = { ...selectedBatch, courseFlow:editFlow };
    setSelectedBatch(updated); setBatches(prev => prev.map(b => b.id===selectedBatch.id?updated:b));
    setShowFlowConfig(false); setToast({ message:'Course flow updated!', type:'success' }); setSaving(false);
  };

  const handleSaveFieldConfig = async () => {
    setSaving(true);
    await updateBatch(selectedBatch.id, { studentFields:editFields });
    const updated = { ...selectedBatch, studentFields:editFields };
    setSelectedBatch(updated); setBatches(prev => prev.map(b => b.id===selectedBatch.id?updated:b));
    setShowFieldConfig(false); setToast({ message:'Student fields updated!', type:'success' }); setSaving(false);
  };

  const handleSaveSubjectConfig = async () => {
    setSaving(true);
    await updateBatch(selectedBatch.id, { subjects:editSubjects });
    const updated = { ...selectedBatch, subjects:editSubjects };
    setSelectedBatch(updated); setBatches(prev => prev.map(b => b.id===selectedBatch.id?updated:b));
    setShowSubjectConfig(false); setToast({ message:'Subjects updated!', type:'success' }); setSaving(false);
  };

  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;
    setSaving(true);
    try {
      // Move to trash
      await addDoc(collection(db,'trash'), {
        type: 'batch', originalId: selectedBatch.id, data: selectedBatch,
        deletedAt: serverTimestamp(), deletedBy: profile?.uid || profile?.email || 'unknown',
      });
      // Mark all students as deleted
      const studentsSnap = await getDocs(query(collection(db,'students'), where('batchId','==',selectedBatch.id)));
      await Promise.all(studentsSnap.docs.map(d =>
        updateDoc(doc(db, 'students', d.id), { deleted: true, deletedAt: serverTimestamp(), batchId: selectedBatch.id })
      ));
      // Delete batch
      await deleteDoc(doc(db,'batches', selectedBatch.id));
      setToast({ message:'Batch deleted and archived to trash.', type:'success' });
      setSelectedBatch(null);
      await loadBatches();
    } catch (err) {
      setToast({ message:'Error deleting batch: ' + err.message, type:'error' });
    }
    setSaving(false);
  };

  const handleDeleteStudent = async (student) => {
    setSaving(true);
    try {
      await addDoc(collection(db,'trash'), {
        type: 'student', originalId: student.id, data: student,
        deletedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db,'students', student.id));
      setToast({ message:`${student.name} moved to trash.`, type:'success' });
      setDeleteStudentConfirm(null);
      await loadBatchDetail(selectedBatch);
      const c = await getBatchStudentCount(selectedBatch.id);
      setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: c }));
    } catch (err) {
      setToast({ message:'Error: ' + err.message, type:'error' });
    }
    setSaving(false);
  };

  const handleAddStaffToBatch = async () => {
    if (!selectedStaffIds.length) return;
    setSaving(true);
    try {
      const currentStaffIds = selectedBatch.staffIds || [];
      const currentStaffDetails = selectedBatch.staffDetails || [];
      const newStaffToAdd = staffList.filter(s => selectedStaffIds.includes(s.id) && !currentStaffIds.includes(s.id));
      const updatedStaffIds = [...currentStaffIds, ...newStaffToAdd.map(s => s.id)];
      const updatedStaffDetails = [...currentStaffDetails, ...newStaffToAdd.map(s => ({
        uid: s.id, name: s.name, phone: s.phone || '', email: s.email || '', subjects: s.subjects || [],
      }))];
      await updateBatch(selectedBatch.id, { staffIds: updatedStaffIds, staffDetails: updatedStaffDetails });
      // Send notifications
      for (const staff of newStaffToAdd) {
        if (staff.email) {
          await addNotification({
            toEmail: staff.email, title: 'New Batch Assignment',
            body: `You have been added to batch ${selectedBatch.name}`,
            type: 'batch_assignment', read: false,
          });
          sendAssignmentEmail({
            toEmail: staff.email, toName: staff.name,
            title: 'New Batch Assignment',
            detail: `You have been added to batch ${selectedBatch.name}`,
            assignedBy: profile?.name || 'ISC SMS',
          }).catch(()=>{});
        }
      }
      const updated = { ...selectedBatch, staffIds: updatedStaffIds, staffDetails: updatedStaffDetails };
      setSelectedBatch(updated);
      setBatches(prev => prev.map(b => b.id === selectedBatch.id ? updated : b));
      setShowAddStaff(false);
      setSelectedStaffIds([]);
      setToast({ message:'Staff added to batch!', type:'success' });
    } catch (err) {
      setToast({ message:'Error: ' + err.message, type:'error' });
    }
    setSaving(false);
  };

  const handleRemoveStaffFromBatch = async (staffUid) => {
    setSaving(true);
    try {
      const updatedStaffIds = (selectedBatch.staffIds || []).filter(id => id !== staffUid);
      const updatedStaffDetails = (selectedBatch.staffDetails || []).filter(s => s.uid !== staffUid);
      await updateBatch(selectedBatch.id, { staffIds: updatedStaffIds, staffDetails: updatedStaffDetails });
      const updated = { ...selectedBatch, staffIds: updatedStaffIds, staffDetails: updatedStaffDetails };
      setSelectedBatch(updated);
      setBatches(prev => prev.map(b => b.id === selectedBatch.id ? updated : b));
      setToast({ message:'Staff removed from batch.', type:'success' });
    } catch (err) {
      setToast({ message:'Error: ' + err.message, type:'error' });
    }
    setSaving(false);
  };

  const handleSubmitRemovalRequest = async () => {
    if (!showRemovalModal || !removalReason.trim()) return;
    setSaving(true);
    try {
      await createRequest({
        type: 'removal',
        requestedBy: profile?.uid, requestedByName: profile?.name,
        targetType: showRemovalModal.targetType,
        targetId: showRemovalModal.targetId,
        targetName: showRemovalModal.targetName,
        reason: removalReason, status: 'pending',
      });
      // Notify CEO
      const ceoSnap = await getDocs(query(collection(db,'staff'), where('role','==','ceo')));
      for (const ceoDoc of ceoSnap.docs) {
        const ceo = ceoDoc.data();
        if (ceo.email) {
          await addNotification({
            toEmail: ceo.email, title: 'Staff Removal Request',
            body: `${profile?.name} requested removal from ${showRemovalModal.targetName}`,
            type: 'removal_request', read: false,
          });
          sendAssignmentEmail({
            toEmail: ceo.email, toName: ceo.name || 'CEO',
            title: 'Staff Removal Request',
            detail: `${profile?.name} requested removal from ${showRemovalModal.targetName}. Reason: ${removalReason}`,
            assignedBy: profile?.name || 'Staff',
          }).catch(()=>{});
        }
      }
      setShowRemovalModal(null);
      setRemovalReason('');
      setToast({ message:'Removal request submitted.', type:'success' });
    } catch (err) {
      setToast({ message:'Error: ' + err.message, type:'error' });
    }
    setSaving(false);
  };

  const handleCreateAssessment = async () => {
    if (!assessmentForm.title || !assessmentForm.totalMarks) return;
    setSaving(true);
    try {
      await addAssessment({
        ...assessmentForm,
        batchId: selectedBatch.id, batchName: selectedBatch.name,
        createdBy: profile?.uid || profile?.email || 'unknown', createdByName: profile?.name || '',
        totalMarks: Number(assessmentForm.totalMarks),
      });
      // Notify other conducting staff
      for (const staffDetail of (assessmentForm.conductingStaff || [])) {
        if (staffDetail.uid !== profile?.uid && staffDetail.email) {
          await addNotification({
            toEmail: staffDetail.email, title: 'New Assessment Added',
            body: `${profile?.name} created assessment "${assessmentForm.title}" for ${selectedBatch.name} — you are listed as conducting staff.`,
            type: 'assessment_added', read: false,
          });
          sendAssignmentEmail({
            toEmail: staffDetail.email, toName: staffDetail.name,
            title: `New Assessment: ${assessmentForm.title}`,
            detail: `${profile?.name} created assessment "${assessmentForm.title}" for ${selectedBatch.name} — you are listed as conducting staff.`,
            assignedBy: profile?.name || 'ISC SMS',
          }).catch(()=>{});
        }
      }
      const asmts = await getAssessments(selectedBatch.id);
      setBatchAssessments(asmts);
      setShowCreateAssessment(false);
      setAssessmentForm({ title:'', date:'', totalMarks:'', conductingStaff:[] });
      setToast({ message:'Assessment created!', type:'success' });
    } catch (err) {
      setToast({ message:'Error: ' + err.message, type:'error' });
    }
    setSaving(false);
  };

  const handleImportMarks = async () => {
    if (!marksPreview || !showImportMarks) return;
    setImportingMarks(true);
    try {
      const results = marksPreview.map(row => {
        const scored = Number(row.marks || row.marksScored || row.score || row.marks_scored || 0);
        const total = showImportMarks.totalMarks || 100;
        const pct = Math.round(scored / total * 100);
        return {
          assessmentId: showImportMarks.id,
          assessmentTitle: showImportMarks.title,
          batchId: selectedBatch.id,
          studentName: row.name || row.studentName || row.student_name || '',
          phone: row.phone || row.number || row.phoneNumber || row.phone_number || '',
          marksScored: scored,
          totalMarks: total,
          percentage: pct,
          passed: pct >= 40,
        };
      }).filter(r => r.studentName);
      await saveAssessmentResults(results);
      setMarksPreview(null);
      setShowImportMarks(null);
      setToast({ message:`Imported marks for ${results.length} students!`, type:'success' });
    } catch (err) {
      setToast({ message:'Error: ' + err.message, type:'error' });
    }
    setImportingMarks(false);
  };

  const handleDeleteAssessment = async (asmt) => {
    setSaving(true);
    try {
      await deleteAssessment(asmt.id);
      const asmts = await getAssessments(selectedBatch.id);
      setBatchAssessments(asmts);
      setToast({ message:'Assessment deleted.', type:'success' });
    } catch (err) {
      setToast({ message:'Error: ' + err.message, type:'error' });
    }
    setSaving(false);
  };

  const handleMarkStepComplete = async (studentId, stepKey, note) => {
    const update = {
      [`courseFlow.${stepKey}.done`]: true,
      [`courseFlow.${stepKey}.doneAt`]: new Date().toISOString(),
    };
    if (note !== undefined && note !== '') update[`courseFlow.${stepKey}.note`] = note;
    await updateStudent(studentId, update);
    loadBatchDetail(selectedBatch);
  };

  const handleMarkVark = async (studentId, stepKey, varkResult) => {
    await updateStudent(studentId, {
      [`courseFlow.${stepKey}.done`]: true,
      [`courseFlow.${stepKey}.doneAt`]: new Date().toISOString(),
      varkResult,
    });
    loadBatchDetail(selectedBatch);
  };

  const handleRevokeStep = async (studentId, stepKey) => {
    await updateStudent(studentId, { [`courseFlow.${stepKey}.done`]: false, [`courseFlow.${stepKey}.doneAt`]: null });
    loadBatchDetail(selectedBatch);
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault(); setSaving(true);
    await addBatchSchedule({ ...scheduleForm, batchId:selectedBatch.id, batchName:selectedBatch.name });
    setToast({ message:'Schedule added!', type:'success' });
    setShowSchedule(false);
    setScheduleForm({ title:'', day:'Monday', scheduledDate:'', time:'', duration:'60', type:'live-class', facultyName:'', meetLink:'', notes:'' });
    const sch = await getBatchSchedules(selectedBatch.id);
    setSchedules(sch); setSaving(false);
  };

  const handleAddTask = async (e) => {
    e.preventDefault(); setSaving(true);
    await addBatchTask({ ...taskForm, batchId:selectedBatch.id, batchName:selectedBatch.name, createdBy:profile?.name });
    // Notify the assigned faculty (in-app + email)
    if (taskForm.assignedFaculty) {
      const staff = staffList.find(s => s.name === taskForm.assignedFaculty);
      if (staff?.email) {
        await addNotification({
          toEmail: staff.email, title: 'New Task Assigned',
          body: `${profile?.name} assigned you "${taskForm.title}" in batch ${selectedBatch.name}${taskForm.dueDate ? ` (due ${taskForm.dueDate})` : ''}`,
          type: 'task_assigned', read: false,
        }).catch(()=>{});
        sendAssignmentEmail({
          toEmail: staff.email, toName: staff.name,
          title: `New Task: ${taskForm.title}`,
          detail: `Batch ${selectedBatch.name}${taskForm.dueDate ? ` — due ${taskForm.dueDate}` : ''}`,
          assignedBy: profile?.name || 'ISC SMS',
        }).catch(()=>{});
      }
    }
    setToast({ message:'Task created!', type:'success' });
    setShowTask(false);
    setTaskForm({ title:'', subject:'', description:'', dueDate:'', assignedFaculty:'' });
    const tasks = await getBatchTasks(selectedBatch.id);
    setBatchTasks(tasks); setSaving(false);
  };

  const handleSaveTaskEdit = async () => {
    if (!editingTask?.title?.trim()) return;
    await updateBatchTask(editingTask.id, { title: editingTask.title });
    setBatchTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, title: editingTask.title } : t));
    setEditingTask(null);
    setToast({ message: 'Assignment renamed!', type: 'success' });
  };

  const handleDeleteTask = (task) => {
    setConfirmDialog({
      message: `Delete assignment "${task.title}"? This cannot be undone.`,
      onConfirm: async () => {
        await deleteBatchTask(task.id);
        setBatchTasks(prev => prev.filter(t => t.id !== task.id));
        if (selectedTask === task.id) setSelectedTask(null);
        setToast({ message: 'Assignment deleted.', type: 'success' });
      },
    });
  };

  // ── Helpers ───────────────────────────────────────────────────
  const progress = (batch) => {
    const s = batch.startDate ? new Date(batch.startDate) : null;
    const e = batch.endDate   ? new Date(batch.endDate)   : null;
    if (!s || !e) return 0;
    return Math.min(100, Math.max(0, Math.round((Date.now()-s)/(e-s)*100)));
  };

  const typeColor = (t) => {
    if (t==='live-class') return { bg:'#DBEAFE', col:'#1E40AF', label:'Live Class' };
    if (t==='recorded')   return { bg:'#D1FAE5', col:'#065F46', label:'Recorded' };
    if (t==='assignment') return { bg:'#FEF3C7', col:'#92400E', label:'Assignment' };
    return { bg:'#F3F4F6', col:'#374151', label: t };
  };

  const getFlowAnalytics = () => {
    const flow = selectedBatch?.courseFlow || DEFAULT_COURSE_FLOW;
    return flow.map(step => {
      const completed = batchStudents.filter(s => s.courseFlow?.[step.key]?.done)
        .map(s => ({ ...s, assessmentNote: s.courseFlow?.[step.key]?.note || '' }));
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
  };

  // detect overdue sessions (scheduled but date/time passed — using schedules with no date we check time vs now)
  const getOverdueSessions = () => {
    const now = new Date();
    return schedules.filter(slot => {
      if (slot.status && slot.status !== 'scheduled') return false; // already marked
      if (!slot.scheduledDate && !slot.date) return false; // no date set, can't determine
      const d = new Date(slot.scheduledDate || slot.date);
      return d < now;
    });
  };

  // Calendar helpers
  const ALL_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const getSlotsForDate = (date, scheds) => {
    // Use local date to avoid UTC shift (toISOString shifts timezone)
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    const dateStr = `${y}-${m}-${d}`;
    const dayName = ALL_DAYS[date.getDay()];
    return scheds.filter(s => {
      if (s.scheduledDate) return s.scheduledDate === dateStr;
      return s.day === dayName;
    }).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  };

  const getWeekDates = (refDate) => {
    const d = new Date(refDate);
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      return dd;
    });
  };

  const getMonthDates = (refDate) => {
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Mon=0
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, 1 - (startOffset - i));
      cells.push({ date: d, inMonth: false });
    }
    for (let i = 1; i <= totalDays; i++) {
      cells.push({ date: new Date(year, month, i), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(last.getDate() + 1);
      cells.push({ date: d, inMonth: false });
    }
    return cells;
  };

  const slotPillColor = (slot) => {
    if (slot.status === 'completed')   return { bg:'#D1FAE5', col:'#065F46' };
    if (slot.status === 'cancelled')   return { bg:'#FEE2E2', col:'#991B1B' };
    if (slot.status === 'rescheduled') return { bg:'#FEF3C7', col:'#92400E' };
    return { bg:'#DBEAFE', col:'#0F3460' };
  };

  if (loading) return <Loading/>;

  // ══════════════════════════════════════════════════════════════
  // BATCH DETAIL VIEW
  // ══════════════════════════════════════════════════════════════
  if (selectedBatch) {
    const count = batchCounts[selectedBatch.id] || batchStudents.length;
    const pct   = progress(selectedBatch);
    const schedByDay = {};
    DAYS.forEach(d => { schedByDay[d] = schedules.filter(s => s.day === d); });
    const batchFlow = selectedBatch.courseFlow || DEFAULT_COURSE_FLOW;
    const batchFields = selectedBatch.studentFields || DEFAULT_STUDENT_FIELDS;
    const batchSubjects = selectedBatch.subjects || [];
    const batchStaffDetails = selectedBatch.staffDetails || [];
    const flowAnalytics = getFlowAnalytics();
    const fullyOnboarded = batchStudents.filter(s => batchFlow.every(step => s.courseFlow?.[step.key]?.done)).length;
    const overdueSessions = getOverdueSessions();
    const isExpired = selectedBatch.endDate && new Date(selectedBatch.endDate) < new Date();
    const isMentorOrCEOAdmin = isCEOorAdmin || selectedBatch.mentorId === profile?.uid;

    // Task split panel data
    const currentTask = selectedTask ? batchTasks.find(t => t.id === selectedTask) : null;
    const taskStudents = batchStudents.filter(s => {
      if (!currentTask) return false;
      const submitted = currentTask.submittedBy?.find(x => x.studentId === s.id);
      if (taskFilter === 'submitted') return !!submitted;
      if (taskFilter === 'pending')   return !submitted;
      return true;
    }).filter(s => !taskSearch || s.name?.toLowerCase().includes(taskSearch.toLowerCase()) || s.phone?.includes(taskSearch));

    return (
      <div style={{ position: 'relative' }}>
        {/* Backdrop for step panel */}
        {selectedStep && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 999 }} onClick={() => setSelectedStep(null)} />
        )}
        <OnboardingStepPanel step={selectedStep} onClose={() => setSelectedStep(null)} onMarkComplete={handleMarkStepComplete} onMarkVark={handleMarkVark} onRevoke={handleRevokeStep} />

        {/* Header */}
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setSelectedBatch(null); setConfirmDialog(null); }}><ArrowLeft size={16}/></button>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selectedBatch.name}</h2>
                {isCEOorAdmin ? (
                  <select
                    value={selectedBatch.status || 'upcoming'}
                    onChange={async e => {
                      const newStatus = e.target.value;
                      await updateBatch(selectedBatch.id, { status: newStatus });
                      const updated = { ...selectedBatch, status: newStatus };
                      setSelectedBatch(updated);
                      setBatches(prev => prev.map(b => b.id === updated.id ? updated : b));
                      setToast({ message: `Batch marked as ${newStatus}`, type: 'success' });
                    }}
                    style={{
                      fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600,
                      border:'1px solid #E5E7EB', cursor:'pointer',
                      background: selectedBatch.status==='active' ? '#D1FAE5' : selectedBatch.status==='completed' ? '#E5E7EB' : '#DBEAFE',
                      color: selectedBatch.status==='active' ? '#065F46' : selectedBatch.status==='completed' ? '#6B7280' : '#1E40AF',
                    }}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                ) : (
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background: selectedBatch.status==='active'?'#D1FAE5':'#DBEAFE', color: selectedBatch.status==='active'?'#065F46':'#1E40AF', fontWeight:600 }}>
                    {selectedBatch.status || 'upcoming'}
                  </span>
                )}
                {isExpired && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'#E5E7EB', color:'#6B7280', fontWeight:600 }}>Expired</span>}
              </div>
              <div style={{ fontSize:13, color:'#6B7280' }}>
                {selectedBatch.course}
                {selectedBatch.courseDurationMonths ? ` · ${selectedBatch.courseDurationMonths} months` : ''}
                {selectedBatch.startDate ? ` · ${new Date(selectedBatch.startDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})} →` : ''}
                {selectedBatch.endDate   ? ` ${new Date(selectedBatch.endDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}` : ''}
                {' · '}{count} students
                {selectedBatch.mentorName ? ` · Mentor: ${selectedBatch.mentorName}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {isCEOorAdmin && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditFlow([...batchFlow]); setShowFlowConfig(true); }}><Settings size={13}/> Course Flow</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditFields([...batchFields]); setShowFieldConfig(true); }}><Settings size={13}/> Student Fields</button>
              </>
            )}
            {activeTab === 'assessments' && !isExpired && (
              <button className="btn btn-primary" onClick={() => setShowCreateAssessment(true)}><Plus size={14}/> Add Assessment</button>
            )}
            {activeTab === 'students' && !isExpired && (
              <>
                <button className="btn btn-ghost" onClick={() => setShowBulk(true)}><Upload size={14}/> Bulk CSV</button>
                {isCEOorAdmin && <button className="btn btn-primary" onClick={() => setShowAddStudent(true)}><UserPlus size={14}/> Add Student</button>}
                {profile?.role === 'ceo' && batchStudents.length > 0 && (
                  <button
                    className="btn btn-sm"
                    style={{ background:'#FEF3C7', color:'#92400E', border:'1px solid #FDE68A' }}
                    onClick={() => setConfirmDialog({ message: `Delete ALL ${batchStudents.length} students from this batch? They will be moved to Trash and can be restored.`, onConfirm: async () => {
                      setSaving(true);
                      try {
                        for (const s of batchStudents) {
                          await addDoc(collection(db,'trash'), { type:'student', originalId:s.id, data:s, deletedAt:serverTimestamp(), deletedBy:profile?.uid||profile?.email||'unknown' });
                          await deleteDoc(doc(db,'students', s.id));
                        }
                        setToast({ message:`${batchStudents.length} students moved to trash.`, type:'success' });
                        await loadBatchDetail(selectedBatch);
                        const c = await getBatchStudentCount(selectedBatch.id);
                        setBatchCounts(prev => ({ ...prev, [selectedBatch.id]: c }));
                      } catch (err) {
                        setToast({ message:'Error: ' + err.message, type:'error' });
                      }
                      setSaving(false);
                    }})}
                  >
                    <Trash2 size={13}/> Delete All
                  </button>
                )}
              </>
            )}
            {activeTab === 'schedule' && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowShareSchedule(true)}>🔗 Share</button>
                {!isExpired && <button className="btn btn-primary" onClick={() => setShowSchedule(true)}><Plus size={14}/> Add Class</button>}
              </>
            )}
            {activeTab === 'tasks' && !isExpired && (
              <button className="btn btn-primary" onClick={() => setShowTask(true)}><Plus size={14}/> Add Task</button>
            )}
            {profile?.role === 'ceo' && (
              <button
                className="btn btn-sm"
                style={{ background:'#EF4444', color:'#fff', border:'none' }}
                onClick={() => setConfirmDialog({ message: 'Delete this batch? All student data will be archived and can be restored from Trash.', onConfirm: handleDeleteBatch })}
              >
                <Trash2 size={13}/> Delete Batch
              </button>
            )}
          </div>
        </div>

        {/* Batch info strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'Total Students',  value:count,                                                 color:'#0F3460', bg:'#DBEAFE' },
            { label:'Active',          value:batchStudents.filter(s=>s.status==='active').length,   color:'#10B981', bg:'#D1FAE5' },
            { label:'At Risk',         value:batchStudents.filter(s=>s.status==='at-risk').length,  color:'#EF4444', bg:'#FEE2E2' },
            { label:'Onboarding Done', value:fullyOnboarded,                                         color:'#8B5CF6', bg:'#EDE9FE' },
            { label:'Course Progress', value:`${pct}%`,                                              color:'#E53935', bg:'#FEE2E2' },
          ].map(c => (
            <div key={c.label} style={{ background:'#fff', borderRadius:10, border:'1px solid #E5E7EB', padding:'12px 16px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:11, color:'#6B7280', marginBottom:4, fontWeight:500 }}>{c.label}</div>
              <div style={{ fontSize:22, fontWeight:700, color:c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="tab-bar" style={{ marginBottom:16 }}>
          {[
            { key:'students',    label:`Students (${count})`               },
            { key:'onboarding',  label:'Onboarding Analytics'              },
            { key:'schedule',    label:`Schedule (${schedules.length})`    },
            { key:'tasks',       label:`Assignments (${batchTasks.length})` },
            { key:'assessments', label:`Assessments (${batchAssessments.length})` },
            { key:'staff',       label:`Staff (${batchStaffDetails.length + (selectedBatch.mentorId ? 1 : 0)})` },
          ].map(t => (
            <div key={t.key} className={`tab ${activeTab===t.key?'active':''}`} onClick={() => { setActiveTab(t.key); setSelectedTask(null); }}>
              {t.label}
            </div>
          ))}
        </div>

        {/* ── STUDENTS TAB ── */}
        {activeTab === 'students' && (() => {
          const PAGE = 20;
          const filtered = batchStudents.filter(s => {
            if (studentStatusFilter && s.status !== studentStatusFilter) return false;
            if (!studentSearch) return true;
            const q = studentSearch.toLowerCase();
            return (
              s.name?.toLowerCase().includes(q) ||
              s.phone?.includes(studentSearch) ||
              s.whatsappNumber?.includes(studentSearch) ||
              s.fatherName?.toLowerCase().includes(q) ||
              s.motherName?.toLowerCase().includes(q) ||
              s.email?.toLowerCase().includes(q) ||
              s.address?.toLowerCase().includes(q) ||
              s.occupation?.toLowerCase().includes(q) ||
              s.classStd?.toLowerCase().includes(q) ||
              s.schoolName?.toLowerCase().includes(q) ||
              s.varkResult?.toLowerCase().includes(q) ||
              s.syllabus?.toLowerCase().includes(q) ||
              s.gender?.toLowerCase().includes(q) ||
              String(s.age||'').includes(studentSearch)
            );
          });
          const pages = Math.ceil(filtered.length / PAGE);
          const paginated = filtered.slice(studentPage * PAGE, (studentPage + 1) * PAGE);

          return (
            <div>
              <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                <input className="form-input" style={{ flex:2, minWidth:200 }} placeholder="Search by name, phone, parent, VARK, class, school..."
                  value={studentSearch} onChange={e => { setStudentSearch(e.target.value); setStudentPage(0); }}/>
                <select className="form-input" style={{ flex:1, minWidth:140 }}
                  value={studentStatusFilter} onChange={e => { setStudentStatusFilter(e.target.value); setStudentPage(0); }}>
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="moderate">Moderate</option>
                  <option value="at-risk">At Risk</option>
                  <option value="dropped">Dropped</option>
                </select>
                <div style={{ display:'flex', alignItems:'center', fontSize:12, color:'#6B7280', whiteSpace:'nowrap' }}>
                  {filtered.length} of {batchStudents.length} students
                </div>
                <button className="btn btn-secondary" style={{ whiteSpace:'nowrap' }} onClick={() => {
                  const cols = ['name','fatherName','motherName','phone','whatsappNumber','email','classStd','schoolName','varkResult','syllabus','gender','age','status'];
                  const esc = (v) => {
                    const s = v == null ? '' : String(v);
                    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
                  };
                  const csv = [cols.join(','), ...filtered.map(s => cols.map(c => esc(s[c])).join(','))].join('\r\n');
                  const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `students-${selectedBatch.name}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}>
                  <Download size={14}/> Export CSV
                </button>
              </div>

              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>Kids Name</th>
                      <th>Father Name</th>
                      <th>Mother Name</th>
                      <th>Phone</th>
                      <th>WhatsApp</th>
                      <th>Class</th>
                      <th>VARK</th>
                      <th>Syllabus</th>
                      <th>Status</th>
                      <th>Onboarding</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 && (
                      <tr><td colSpan={11} style={{ textAlign:'center', padding:40, color:'#6B7280' }}>
                        {studentSearch || studentStatusFilter ? 'No students match your filter.' : 'No students yet.'}
                        {!studentSearch && !studentStatusFilter && (
                          <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:12 }}>
                            <button className="btn btn-ghost" onClick={() => setShowBulk(true)}><Upload size={13}/> Import CSV</button>
                            {isCEOorAdmin && <button className="btn btn-primary" onClick={() => setShowAddStudent(true)}><UserPlus size={13}/> Add Manually</button>}
                          </div>
                        )}
                      </td></tr>
                    )}
                    {paginated.map(s => {
                      const flowDone = batchFlow.filter(step => s.courseFlow?.[step.key]?.done).length;
                      const onboardDone = batchFlow.length > 0 && flowDone === batchFlow.length;
                      return (
                        <tr key={s.id}>
                          <td style={{ fontSize:13 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <Avatar name={s.name||'?'} size="sm"/>
                              <div style={{ fontWeight:500 }}>{s.name||'—'}</div>
                            </div>
                          </td>
                          <td style={{ fontSize:13 }}>{s.fatherName||'—'}</td>
                          <td style={{ fontSize:13 }}>{s.motherName||'—'}</td>
                          <td style={{ fontSize:13 }}>{s.phone||'—'}</td>
                          <td style={{ fontSize:13 }}>{s.whatsappNumber||'—'}</td>
                          <td style={{ fontSize:13 }}>{s.classStd||'—'}</td>
                          <td style={{ fontSize:12 }}>{s.varkResult||'—'}</td>
                          <td style={{ fontSize:12 }}>{s.syllabus||'—'}</td>
                          <td>
                            <select
                              value={s.status||'active'}
                              onChange={async e => {
                                await updateStudent(s.id, { status: e.target.value });
                                await loadBatchDetail(selectedBatch);
                              }}
                              style={{ fontSize:11, padding:'2px 6px', borderRadius:8, border:'1px solid #E5E7EB', fontWeight:600, cursor:'pointer',
                                background: s.status==='active'?'#D1FAE5':s.status==='at-risk'?'#FEE2E2':s.status==='dropped'?'#F3F4F6':'#FEF3C7',
                                color: s.status==='active'?'#065F46':s.status==='at-risk'?'#991B1B':s.status==='dropped'?'#6B7280':'#92400E' }}>
                              <option value="active">🟢 Active</option>
                              <option value="moderate">🟡 Moderate</option>
                              <option value="at-risk">🔴 At Risk</option>
                              <option value="dropped">⚫ Dropped</option>
                            </select>
                          </td>
                          <td>
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600, background:onboardDone?'#D1FAE5':'#FEF3C7', color:onboardDone?'#065F46':'#92400E' }}>
                              {flowDone}/{batchFlow.length} {onboardDone ? '✅' : '⏳'}
                            </span>
                          </td>
                          <td style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>View <ChevronRight size={12}/></button>
                            {(profile?.role === 'ceo' || profile?.role === 'staff') && (
                              <button className="btn btn-sm" style={{ background:'#FEE2E2', color:'#EF4444', border:'none', padding:'4px 8px' }}
                                onClick={() => setDeleteStudentConfirm(s)}><Trash2 size={12}/></button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:14 }}>
                  <button className="btn btn-ghost btn-sm" disabled={studentPage===0} onClick={() => setStudentPage(p => p-1)}>← Prev</button>
                  {Array.from({length:Math.min(pages, 7)}, (_,i) => (
                    <button key={i} className={`btn btn-sm ${studentPage===i?'btn-primary':'btn-ghost'}`} onClick={() => setStudentPage(i)}>{i+1}</button>
                  ))}
                  {pages > 7 && <span style={{ alignSelf:'center', fontSize:12, color:'#9CA3AF' }}>...{pages} total</span>}
                  <button className="btn btn-ghost btn-sm" disabled={studentPage===pages-1} onClick={() => setStudentPage(p => p+1)}>Next →</button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── ONBOARDING ANALYTICS TAB ── */}
        {activeTab === 'onboarding' && (
          <div>
            {/* Summary Banner */}
            <div style={{ background: 'linear-gradient(135deg, #1A1A2E 0%, #0F3460 100%)', borderRadius: 14, padding: '22px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24 }}>
              {/* Progress Ring */}
              <div style={{ flexShrink: 0 }}>
                <svg width="90" height="90" viewBox="0 0 90 90">
                  <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9"/>
                  <circle cx="45" cy="45" r="38" fill="none" stroke={count > 0 && fullyOnboarded === count ? '#10B981' : '#E53935'}
                    strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 38}`}
                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - (count > 0 ? fullyOnboarded / count : 0))}`}
                    transform="rotate(-90 45 45)"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                  />
                  <text x="45" y="49" textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff">
                    {count > 0 ? Math.round(fullyOnboarded / count * 100) : 0}%
                  </text>
                </svg>
              </div>
              <div style={{ color: '#fff' }}>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                  {fullyOnboarded} of {count} students completed full onboarding
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  {count - fullyOnboarded} students still have pending steps · {batchFlow.length} total steps in this batch
                </div>
              </div>
            </div>

            {/* Step-by-step table */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['#', 'Step Name', 'Phase', 'Completed', 'Not Completed', 'Progress', ''].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flowAnalytics.map((step, idx) => (
                    <tr key={step.key} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F0F4FF'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#FAFBFC'}
                    >
                      <td style={{ padding: '11px 14px', color: '#9CA3AF', fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 600 }}>{step.label}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: step.phase === 'onboarding' ? '#DBEAFE' : '#EDE9FE', color: step.phase === 'onboarding' ? '#1E40AF' : '#6D28D9', textTransform: 'capitalize' }}>
                          {step.phase}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontWeight: 700, color: '#10B981' }}>{step.completed}</span>
                        <span style={{ color: '#9CA3AF', fontSize: 11, marginLeft: 4 }}>({step.pct}%)</span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontWeight: 600, color: step.notCompleted > 0 ? '#EF4444' : '#10B981' }}>{step.notCompleted}</span>
                      </td>
                      <td style={{ padding: '11px 14px', minWidth: 100 }}>
                        <div style={{ height: 6, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${step.pct}%`, background: step.pct === 100 ? '#10B981' : step.pct > 60 ? '#F59E0B' : '#E53935', transition: 'width 0.3s' }} />
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                          onClick={() => setSelectedStep(step)}
                        >
                          View Students <ChevronRight size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SCHEDULE TAB ── */}
        {activeTab === 'schedule' && (() => {
          const today = new Date();
          today.setHours(0,0,0,0);
          const weekDates = getWeekDates(calendarDate);
          const monthCells = getMonthDates(calendarDate);
          const monthLabel = calendarDate.toLocaleString('default', { month:'long', year:'numeric' });
          const weekLabel = `${weekDates[0].toLocaleDateString('default',{month:'short',day:'numeric'})} – ${weekDates[6].toLocaleDateString('default',{month:'short',day:'numeric',year:'numeric'})}`;

          const SlotPill = ({ slot, compact }) => {
            const pc = slotPillColor(slot);
            const isOverdue = overdueSessions.find(s => s.id === slot.id);
            return (
              <div
                onClick={() => setCalendarSlotDetail(slot)}
                style={{
                  padding: compact ? '2px 6px' : '4px 8px',
                  borderRadius: 6,
                  background: isOverdue ? '#FEF3C7' : pc.bg,
                  color: isOverdue ? '#92400E' : pc.col,
                  fontSize: compact ? 10 : 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: 2,
                  border: `1px solid ${isOverdue ? '#FDE68A' : pc.col+'30'}`,
                }}
                title={slot.title}
              >
                {isOverdue && '⚠ '}{slot.time && `${slot.time} `}{slot.title}
              </div>
            );
          };

          return (
            <div>
              {/* Overdue warning banner */}
              {overdueSessions.length > 0 && (
                <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: 10, border: '1px solid #FDE68A', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AlertTriangle size={16} style={{ color: '#F59E0B', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, color: '#92400E', fontWeight: 500 }}>
                    {overdueSessions.length} class{overdueSessions.length > 1 ? 'es' : ''} from the past have not been marked. Please update their status.
                  </div>
                </div>
              )}

              {/* Calendar toolbar */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                {/* View toggle */}
                <div style={{ display:'flex', background:'#F3F4F6', borderRadius:8, padding:2 }}>
                  {['week','month'].map(v => (
                    <button key={v} onClick={() => setCalendarView(v)}
                      style={{ padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                        background: calendarView === v ? '#0F3460' : 'transparent',
                        color: calendarView === v ? '#fff' : '#6B7280',
                        transition:'all 0.15s' }}
                    >{v.charAt(0).toUpperCase()+v.slice(1)}</button>
                  ))}
                </div>
                {/* Navigation */}
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const d = new Date(calendarDate);
                  if (calendarView === 'week') d.setDate(d.getDate()-7);
                  else d.setMonth(d.getMonth()-1);
                  setCalendarDate(d);
                }}>←</button>
                <span style={{ fontSize:13, fontWeight:600, minWidth:180, textAlign:'center' }}>
                  {calendarView === 'week' ? weekLabel : monthLabel}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const d = new Date(calendarDate);
                  if (calendarView === 'week') d.setDate(d.getDate()+7);
                  else d.setMonth(d.getMonth()+1);
                  setCalendarDate(d);
                }}>→</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCalendarDate(new Date())}>Today</button>
                <div style={{ flex:1 }}/>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowShareSchedule(true)}>
                  🔗 Share Schedule
                </button>
              </div>

              {/* Week view */}
              {calendarView === 'week' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
                  {weekDates.map((date, idx) => {
                    const isToday = date.toDateString() === today.toDateString();
                    const slots = getSlotsForDate(date, schedules);
                    const dayLabel = date.toLocaleDateString('default',{weekday:'short'});
                    const dateNum = date.getDate();
                    const monthShort = date.toLocaleDateString('default',{month:'short'});
                    return (
                      <div key={idx} style={{
                        background: '#fff', borderRadius: 10,
                        border: `2px solid ${isToday ? '#0F3460' : '#E5E7EB'}`,
                        minHeight: 140, padding: '10px 8px',
                        boxShadow: isToday ? '0 0 0 2px #0F346030' : '0 1px 3px rgba(0,0,0,0.05)',
                      }}>
                        <div style={{ textAlign:'center', marginBottom:8 }}>
                          <div style={{ fontSize:11, color: isToday ? '#0F3460' : '#9CA3AF', fontWeight:600 }}>{dayLabel}</div>
                          <div style={{
                            width:28, height:28, borderRadius:'50%', margin:'4px auto 0',
                            background: isToday ? '#0F3460' : 'transparent',
                            color: isToday ? '#fff' : '#1A1A2E',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontWeight:700, fontSize:14,
                          }}>{dateNum}</div>
                          {isToday && <div style={{ fontSize:9, color:'#0F3460', fontWeight:600 }}>{monthShort}</div>}
                        </div>
                        <div>
                          {slots.map(slot => <SlotPill key={slot.id} slot={slot} compact />)}
                          {slots.length === 0 && <div style={{ fontSize:10, color:'#D1D5DB', textAlign:'center', marginTop:8 }}>—</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Month view */}
              {calendarView === 'month' && (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, marginBottom:2 }}>
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                      <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#6B7280', padding:'6px 0' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
                    {monthCells.map(({ date, inMonth }, idx) => {
                      const isToday = date.toDateString() === today.toDateString();
                      const slots = inMonth ? getSlotsForDate(date, schedules) : [];
                      return (
                        <div key={idx} style={{
                          background: inMonth ? '#fff' : '#F9FAFB',
                          borderRadius: 8, minHeight: 80, padding: '6px',
                          border: `1px solid ${isToday ? '#0F3460' : '#E5E7EB'}`,
                          opacity: inMonth ? 1 : 0.4,
                        }}>
                          <div style={{
                            width:22, height:22, borderRadius:'50%',
                            background: isToday ? '#0F3460' : 'transparent',
                            color: isToday ? '#fff' : inMonth ? '#1A1A2E' : '#9CA3AF',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontWeight: isToday ? 700 : 500, fontSize:12, marginBottom:4,
                          }}>{date.getDate()}</div>
                          {slots.slice(0,3).map(slot => <SlotPill key={slot.id} slot={slot} compact />)}
                          {slots.length > 3 && <div style={{ fontSize:9, color:'#9CA3AF', marginTop:2 }}>+{slots.length-3} more</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {schedules.length === 0 && (
                <div className="card" style={{ textAlign:'center', color:'#6B7280', padding:40, marginTop:16 }}>
                  No schedule added yet. Click "Add Class" to create the timetable.
                </div>
              )}

              {/* Slot detail popover */}
              {calendarSlotDetail && (() => {
                const slot = calendarSlotDetail;
                const tc = typeColor(slot.type);
                const isOverdue = overdueSessions.find(s => s.id === slot.id);
                return (
                  <Modal title={slot.title} onClose={() => setCalendarSlotDetail(null)}>
                    <div style={{ display:'flex', flexDirection:'column', gap:10, fontSize:13 }}>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <span style={{ padding:'2px 9px', borderRadius:10, background:tc.bg, color:tc.col, fontWeight:600, fontSize:11 }}>{tc.label}</span>
                        {slot.status && <span style={{ padding:'2px 9px', borderRadius:10, fontWeight:600, fontSize:11,
                          background: slot.status==='completed'?'#D1FAE5':slot.status==='cancelled'?'#FEE2E2':'#FEF3C7',
                          color: slot.status==='completed'?'#065F46':slot.status==='cancelled'?'#991B1B':'#92400E' }}>{slot.status}</span>}
                      </div>
                      <div style={{ color:'#374151' }}>
                        <div><strong>Day:</strong> {slot.scheduledDate ? slot.scheduledDate : slot.day} {slot.scheduledDate ? '(one-time)' : '(recurring)'}</div>
                        <div><strong>Time:</strong> {slot.time} · {slot.duration} min</div>
                        {slot.facultyName && <div><strong>Faculty:</strong> {slot.facultyName}</div>}
                        {slot.meetLink && <div><strong>Link:</strong> <a href={slot.meetLink} target="_blank" rel="noreferrer" style={{ color:'#E53935' }}>Join →</a></div>}
                        {slot.notes && <div style={{ color:'#6B7280', marginTop:4 }}>{slot.notes}</div>}
                      </div>

                      {/* Status update */}
                      <div className="form-group">
                        <label className="form-label">Update Status</label>
                        {isOverdue ? (
                          <div style={{ display:'flex', gap:8 }}>
                            <button className="btn btn-sm" style={{ background:'#D1FAE5', color:'#065F46', border:'none' }}
                              onClick={async () => { await updateScheduleStatus(slot.id,'completed'); const sch=await getBatchSchedules(selectedBatch.id); setSchedules(sch); setCalendarSlotDetail(null); setShowAttendance(slot); }}>
                              Mark Completed
                            </button>
                            <button className="btn btn-sm" style={{ background:'#FEE2E2', color:'#991B1B', border:'none' }}
                              onClick={async () => { await updateScheduleStatus(slot.id,'cancelled'); const sch=await getBatchSchedules(selectedBatch.id); setSchedules(sch); setCalendarSlotDetail(null); }}>
                              Mark Cancelled
                            </button>
                          </div>
                        ) : (
                          <select className="form-input" value={slot.status || ''} onChange={async e => {
                            const ns = e.target.value; if (!ns) return;
                            await updateScheduleStatus(slot.id, ns);
                            const sch = await getBatchSchedules(selectedBatch.id);
                            setSchedules(sch);
                            setCalendarSlotDetail({ ...slot, status: ns });
                          }}>
                            <option value="">Mark as...</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="rescheduled">Rescheduled</option>
                          </select>
                        )}
                      </div>

                      <div style={{ display:'flex', gap:8, justifyContent:'space-between', marginTop:4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setCalendarSlotDetail(null); setShowAttendance(slot); }}>
                          {attendanceSaved[slot.id] ? 'Attendance ✓' : 'Upload Attendance'}
                        </button>
                        <button className="btn btn-sm" style={{ background:'#FEE2E2', color:'#EF4444', border:'none' }}
                          onClick={() => setConfirmDialog({ message: 'Delete this class slot?', onConfirm: async () => {
                            await deleteBatchSchedule(slot.id);
                            const sch = await getBatchSchedules(selectedBatch.id);
                            setSchedules(sch);
                            setCalendarSlotDetail(null);
                          }})}>
                          <Trash2 size={12}/> Delete
                        </button>
                      </div>
                    </div>
                  </Modal>
                );
              })()}
            </div>
          );
        })()}

        {/* ── TASKS / ASSIGNMENTS TAB ── Split Panel ── */}
        {activeTab === 'tasks' && (
          <div style={{ display: 'flex', gap: 14, minHeight: 500 }}>
            {/* Left: KPI + Task list */}
            <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* KPI boxes — clickable filters */}
              {batchTasks.length > 0 && (() => {
                const totalStudents = batchStudents.length || 1;
                const allSubmitted  = batchTasks.reduce((n,t) => n + (t.submittedBy?.length||0), 0);
                const allPending    = batchTasks.reduce((n,t) => n + Math.max(0, totalStudents - (t.submittedBy?.length||0)), 0);
                const completedTasks = batchTasks.filter(t => (t.submittedBy?.length||0) >= totalStudents).length;
                const pendingTasks   = batchTasks.length - completedTasks;
                return (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:4 }}>
                    {[
                      { key:'all',       label:'All Assignments', value:batchTasks.length,  bg:'var(--blue-soft)',   col:'var(--blue-ink)' },
                      { key:'completed', label:'Fully Done',      value:completedTasks,      bg:'var(--green-soft)', col:'var(--green-ink)' },
                      { key:'pending',   label:'In Progress',     value:pendingTasks,        bg:'var(--amber-soft)', col:'var(--amber-ink)' },
                      { key:'overdue',   label:'Overdue',         value:batchTasks.filter(t=>t.dueDate&&new Date(t.dueDate)<new Date()&&(t.submittedBy?.length||0)<totalStudents).length, bg:'var(--red-soft)', col:'var(--red-ink)' },
                    ].map(k => (
                      <div key={k.key} onClick={() => setTaskKpiFilter(k.key)}
                        style={{ background:k.bg, borderRadius:10, padding:'10px 12px', cursor:'pointer', border:`2px solid ${taskKpiFilter===k.key?k.col:'transparent'}`, transition:'all 0.15s' }}>
                        <div style={{ fontSize:20, fontWeight:700, color:k.col, fontFamily:'var(--font-display)' }}>{k.value}</div>
                        <div style={{ fontSize:11, color:k.col, fontWeight:500 }}>{k.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {batchTasks.length === 0 && (
                <div style={{ background:'var(--surface)', borderRadius:12, border:'1px solid var(--border)', padding:32, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
                  No assignments yet. Click "Add Task".
                </div>
              )}
              {batchTasks.filter(task => {
                if (taskKpiFilter === 'all') return true;
                const totalS = batchStudents.length || 1;
                if (taskKpiFilter === 'completed') return (task.submittedBy?.length||0) >= totalS;
                if (taskKpiFilter === 'pending')   return (task.submittedBy?.length||0) < totalS;
                if (taskKpiFilter === 'overdue')   return task.dueDate && new Date(task.dueDate)<new Date() && (task.submittedBy?.length||0)<totalS;
                return true;
              }).map(task => {
                const submitted = task.submittedBy?.length || 0;
                const total = batchStudents.length || 1;
                const pctDone = Math.round(submitted / total * 100);
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && submitted < total;
                const isSelected = selectedTask === task.id;
                return (
                  <div key={task.id} style={{ position:'relative' }}>
                    {/* Edit inline */}
                    {editingTask?.id === task.id ? (
                      <div style={{ background:'var(--surface)', borderRadius:10, border:'2px solid var(--brand)', padding:'10px 12px', display:'flex', gap:6 }}>
                        <input
                          className="form-input"
                          style={{ flex:1, fontSize:12, height:32 }}
                          value={editingTask.title}
                          onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                          onKeyDown={e => { if(e.key==='Enter') handleSaveTaskEdit(); if(e.key==='Escape') setEditingTask(null); }}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={handleSaveTaskEdit}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingTask(null)}>✕</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => { setSelectedTask(task.id); setTaskFilter('all'); setTaskSearch(''); }}
                        style={{
                          background: isSelected ? 'var(--n-800)' : 'var(--surface)',
                          borderRadius:10, border:`2px solid ${isSelected?'var(--brand)':isOverdue?'var(--red-soft)':'var(--border)'}`,
                          padding:'11px 12px', cursor:'pointer', transition:'all 0.15s',
                        }}
                      >
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:4 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:isSelected?'#fff':'var(--text)', marginBottom:4, flex:1 }}>{task.title}</div>
                          <div style={{ display:'flex', gap:3, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                            <button title="Rename" onClick={() => setEditingTask({ id:task.id, title:task.title })}
                              style={{ background:'transparent', border:'none', cursor:'pointer', color:isSelected?'rgba(255,255,255,0.5)':'var(--text-muted)', padding:2, borderRadius:4, lineHeight:1 }}>
                              <Pencil size={12}/>
                            </button>
                            <button title="Delete" onClick={() => handleDeleteTask(task)}
                              style={{ background:'transparent', border:'none', cursor:'pointer', color:isSelected?'#FCA5A5':'var(--red)', padding:2, borderRadius:4, lineHeight:1 }}>
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        </div>
                        {task.subject && (
                          <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:isSelected?'rgba(255,255,255,0.15)':'var(--indigo-soft)', color:isSelected?'#fff':'var(--indigo-ink)', fontWeight:600, marginBottom:4, display:'inline-block' }}>
                            {task.subject}
                          </span>
                        )}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
                          <div style={{ height:4, flex:1, background:isSelected?'rgba(255,255,255,0.15)':'var(--n-150)', borderRadius:2, overflow:'hidden', marginRight:8 }}>
                            <div style={{ height:'100%', width:`${pctDone}%`, background:pctDone===100?'var(--green)':'var(--amber)', transition:'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize:11, fontWeight:700, color:isSelected?'#fff':(pctDone===100?'var(--green-ink)':'var(--amber-ink)'), whiteSpace:'nowrap' }}>
                            {pctDone===100?'All done':`${submitted}/${total}`}
                          </span>
                        </div>
                        {isOverdue && <div style={{ fontSize:10, color:isSelected?'#FCA5A5':'var(--red)', marginTop:4, fontWeight:600 }}>⚠ Overdue</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right: Task detail */}
            <div style={{ flex: 1, background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              {!currentTask ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF', gap: 12 }}>
                  <CheckSquare size={40} style={{ color: '#E5E7EB' }} />
                  <div style={{ fontSize: 14 }}>Select a task to view details</div>
                </div>
              ) : (
                <>
                  {/* Task header */}
                  <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ fontWeight: 700, fontSize: 17, color: '#1A1A2E', marginBottom: 4 }}>{currentTask.title}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      {currentTask.subject && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: '#EDE9FE', color: '#6D28D9', fontWeight: 600 }}>{currentTask.subject}</span>}
                      {currentTask.assignedFaculty && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }}>{currentTask.assignedFaculty}</span>}
                      {currentTask.dueDate && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Due: {currentTask.dueDate}</span>}
                    </div>
                    {currentTask.description && <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>{currentTask.description}</div>}
                    {/* All done banner */}
                    {(currentTask.submittedBy?.length || 0) >= batchStudents.length && batchStudents.length > 0 && (
                      <div style={{ marginTop: 12, padding: '10px 16px', background: '#D1FAE5', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>🎉</span>
                        <div>
                          <div style={{ fontWeight: 700, color: '#065F46', fontSize: 14 }}>All students completed this assignment!</div>
                          <div style={{ fontSize: 12, color: '#047857' }}>Every student in this batch has submitted.</div>
                        </div>
                      </div>
                    )}
                    {/* Submission stats */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                      {[
                        { label: 'Submitted', value: currentTask.submittedBy?.length || 0, color: '#10B981', bg: '#D1FAE5' },
                        { label: 'Pending',   value: batchStudents.length - (currentTask.submittedBy?.length || 0), color: '#F59E0B', bg: '#FEF3C7' },
                        { label: 'Total',     value: batchStudents.length, color: '#0F3460', bg: '#DBEAFE' },
                      ].map(s => (
                        <div key={s.label} style={{ padding: '8px 16px', borderRadius: 8, background: s.bg, textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: '#6B7280' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Filters + search + bulk */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    {['all', 'pending', 'submitted'].map(f => (
                      <button
                        key={f}
                        onClick={() => setTaskFilter(f)}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                          background: taskFilter === f ? '#1A1A2E' : '#F3F4F6',
                          color: taskFilter === f ? '#fff' : '#6B7280',
                          textTransform: 'capitalize',
                        }}
                      >{f === 'all' ? 'Show All' : f}</button>
                    ))}
                    <div style={{ flex: 1, position: 'relative', minWidth: 160 }}>
                      <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                      <input
                        className="form-input"
                        style={{ paddingLeft: 28, fontSize: 12 }}
                        placeholder="Search student..."
                        value={taskSearch}
                        onChange={e => setTaskSearch(e.target.value)}
                      />
                    </div>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#E53935', color: '#fff', border: 'none', fontSize: 12, whiteSpace: 'nowrap' }}
                      onClick={async () => {
                        const pending = batchStudents.filter(s => !currentTask.submittedBy?.find(x => x.studentId === s.id));
                        for (const s of pending) {
                          await markTaskSubmitted(currentTask.id, s.id, s.name);
                        }
                        const tasks = await getBatchTasks(selectedBatch.id);
                        setBatchTasks(tasks);
                        setSelectedTask(currentTask.id);
                        setToast({ message: 'All students marked!', type: 'success' });
                      }}
                    >
                      Mark All Submitted
                    </button>
                  </div>

                  {/* Student table */}
                  <div style={{ overflowY: 'auto', maxHeight: 340 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                          {['Student', 'Phone', 'Status', ''].map(h => (
                            <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {taskStudents.length === 0 && (
                          <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>No students match.</td></tr>
                        )}
                        {taskStudents.map((s, idx) => {
                          const submittedEntry = currentTask.submittedBy?.find(x => x.studentId === s.id);
                          return (
                            <tr key={s.id} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC' }}>
                              <td style={{ padding: '9px 10px', fontWeight: 500 }}>{s.name}</td>
                              <td style={{ padding: '9px 10px', color: '#6B7280' }}>{s.phone || '—'}</td>
                              <td style={{ padding: '9px 10px' }}>
                                <span style={{
                                  fontSize: 11, padding: '2px 9px', borderRadius: 20, fontWeight: 600,
                                  background: submittedEntry ? '#D1FAE5' : '#FEF3C7',
                                  color: submittedEntry ? '#065F46' : '#92400E',
                                }}>
                                  {submittedEntry ? 'Submitted' : 'Pending'}
                                </span>
                              </td>
                              <td style={{ padding: '9px 10px' }}>
                                {s.status === 'dropped' ? (
                                  <span style={{ fontSize:10, color:'#9CA3AF', fontStyle:'italic' }}>Dropped</span>
                                ) : !submittedEntry ? (
                                  <button
                                    className="btn btn-sm"
                                    style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', border: 'none' }}
                                    onClick={async () => {
                                      await markTaskSubmitted(currentTask.id, s.id, s.name);
                                      const tasks = await getBatchTasks(selectedBatch.id);
                                      setBatchTasks(tasks);
                                    }}
                                  >Mark Done</button>
                                ) : (
                                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>{submittedEntry.submittedAt?.slice(0, 10)}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── STAFF TAB ── */}
        {activeTab === 'staff' && (() => {
          // Build staff rows: mentor first, then staffDetails
          const mentorEntry = selectedBatch.mentorId ? {
            uid: selectedBatch.mentorId, name: selectedBatch.mentorName || '—',
            phone: '', email: '', subjects: [], isMentor: true,
          } : null;
          const staffRows = [
            ...(mentorEntry ? [mentorEntry] : []),
            ...(batchStaffDetails.filter(s => s.uid !== selectedBatch.mentorId).map(s => ({ ...s, isMentor: false }))),
          ];

          return (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <h3 style={{ fontSize:15, fontWeight:700 }}>Staff & Mentor</h3>
                {isMentorOrCEOAdmin && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddStaff(true)}><Plus size={13}/> Add Staff</button>
                )}
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th><th>Phone</th><th>Email</th><th>Subjects</th><th>Role</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffRows.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign:'center', color:'#9CA3AF', padding:32 }}>No staff assigned yet.</td></tr>
                    )}
                    {staffRows.map(s => (
                      <tr key={s.uid}>
                        <td style={{ fontWeight:600 }}>{s.name}</td>
                        <td style={{ color:'#6B7280' }}>{s.phone||'—'}</td>
                        <td style={{ color:'#6B7280' }}>{s.email||'—'}</td>
                        <td style={{ color:'#6B7280' }}>{(s.subjects||[]).length ? (s.subjects||[]).map(x => (typeof x === 'object' ? (x.name || '') : x)).filter(Boolean).join(', ') || '—' : '—'}</td>
                        <td>
                          {s.isMentor
                            ? <span style={{ fontSize:11, padding:'2px 9px', borderRadius:10, background:'#FEF3C7', color:'#92400E', fontWeight:700 }}>Mentor</span>
                            : <span style={{ fontSize:11, padding:'2px 9px', borderRadius:10, background:'#DBEAFE', color:'#1E40AF', fontWeight:600 }}>Staff</span>
                          }
                        </td>
                        <td style={{ display:'flex', gap:6 }}>
                          {profile?.role === 'ceo' && !s.isMentor && (
                            <button className="btn btn-sm" style={{ background:'#FEE2E2', color:'#EF4444', border:'none' }}
                              onClick={() => setConfirmDialog({ message: `Remove ${s.name} from this batch?`, onConfirm: () => handleRemoveStaffFromBatch(s.uid) })}>
                              Remove
                            </button>
                          )}
                          {s.uid === profile?.uid && !s.isMentor && (
                            <button className="btn btn-sm btn-ghost"
                              onClick={() => setShowRemovalModal({ uid: s.uid, name: s.name, targetType: 'batch', targetId: selectedBatch.id, targetName: selectedBatch.name })}>
                              Request Removal
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ── ASSESSMENTS TAB ── */}
        {activeTab === 'assessments' && (
          <div>
            {batchAssessments.length === 0 && (
              <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:48, textAlign:'center', color:'#9CA3AF' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>No assessments yet</div>
                <div style={{ fontSize:13, marginBottom:16 }}>Create an exam or test for this batch</div>
                <button className="btn btn-primary" onClick={() => setShowCreateAssessment(true)}><Plus size={14}/> Add Assessment</button>
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {batchAssessments.map(asmt => {
                const staffNames = (asmt.conductingStaff||[]).map(s => s.name||s).join(', ');
                return (
                  <div key={asmt.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #E5E7EB', padding:'16px 20px', display:'flex', alignItems:'center', gap:16, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:'#1A1A2E', marginBottom:4 }}>{asmt.title}</div>
                      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                        {asmt.date && <span style={{ fontSize:12, color:'#6B7280' }}>📅 {asmt.date}</span>}
                        <span style={{ fontSize:12, color:'#6B7280' }}>Total Marks: <strong>{asmt.totalMarks}</strong></span>
                        {staffNames && <span style={{ fontSize:12, color:'#6B7280' }}>Staff: {staffNames}</span>}
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'#EDE9FE', color:'#6D28D9', fontWeight:600 }}>Exam</span>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      {/* Status toggle */}
                      <select value={asmt.status||'upcoming'}
                        onChange={async e => {
                          const ns = e.target.value;
                          await updateDoc(doc(db,'assessments',asmt.id), { status: ns });
                          const asmts = await getAssessments(selectedBatch.id);
                          setBatchAssessments(asmts);
                        }}
                        style={{ fontSize:11, padding:'2px 8px', borderRadius:8, border:'1px solid #E5E7EB', cursor:'pointer', fontWeight:600,
                          background: asmt.status==='completed' ? '#D1FAE5' : '#DBEAFE',
                          color: asmt.status==='completed' ? '#065F46' : '#1E40AF' }}>
                        <option value="upcoming">Upcoming</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button className="btn btn-ghost btn-sm" onClick={async () => {
                        const results = await getAssessmentResults(asmt.id);
                        setAssessmentResults(prev => ({ ...prev, [asmt.id]: results }));
                        setShowViewResults(asmt);
                      }}>View Results</button>
                      <button className="btn btn-sm" style={{ background:'#EFF6FF', color:'#1E40AF', border:'none' }}
                        onClick={() => { setShowImportMarks(asmt); setMarksPreview(null); }}>
                        <Upload size={12}/> Import Marks
                      </button>
                      {profile?.role === 'ceo' && (
                        <button className="btn btn-sm" style={{ background:'#FEE2E2', color:'#EF4444', border:'none' }}
                          onClick={() => setConfirmDialog({ message:`Delete assessment "${asmt.title}"?`, onConfirm: () => handleDeleteAssessment(asmt) })}>
                          <Trash2 size={12}/>
                        </button>
                      )}
                      {/* Staff request removal */}
                      {(asmt.conductingStaff||[]).some(s => s.uid === profile?.uid) && profile?.role !== 'ceo' && (
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => setShowRemovalModal({ uid: profile?.uid, name: profile?.name, targetType:'assessment', targetId:asmt.id, targetName:asmt.title })}>
                          Request Removal
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MODALS ── */}

        {/* Create Assessment Modal */}
        {showCreateAssessment && (
          <Modal title={`Add Assessment — ${selectedBatch.name}`} onClose={() => setShowCreateAssessment(false)} wide>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Assessment Title *</label>
                <input className="form-input" placeholder="e.g. Mid-Term Exam, Unit Test 1..." value={assessmentForm.title}
                  onChange={e => setAssessmentForm(f => ({ ...f, title:e.target.value }))}/>
              </div>
              <FormRow>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={assessmentForm.date}
                    onChange={e => setAssessmentForm(f => ({ ...f, date:e.target.value }))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Total Marks *</label>
                  <input className="form-input" type="number" placeholder="e.g. 100" value={assessmentForm.totalMarks}
                    onChange={e => setAssessmentForm(f => ({ ...f, totalMarks:e.target.value }))}/>
                </div>
              </FormRow>
              <div className="form-group">
                <label className="form-label">Conducting Staff (select all involved)</label>
                <div style={{ border:'1px solid #E5E7EB', borderRadius:8, maxHeight:180, overflowY:'auto', padding:4 }}>
                  {[...(selectedBatch.staffDetails||[]), ...(selectedBatch.mentorId ? [{ uid:selectedBatch.mentorId, name:selectedBatch.mentorName, email:'' }] : [])].map(s => {
                    const isSelected = (assessmentForm.conductingStaff||[]).some(x => x.uid === s.uid);
                    return (
                      <div key={s.uid} onClick={() => setAssessmentForm(f => ({
                        ...f, conductingStaff: isSelected
                          ? (f.conductingStaff||[]).filter(x => x.uid !== s.uid)
                          : [...(f.conductingStaff||[]), { uid:s.uid, name:s.name, email:s.email||'' }]
                      }))} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:6, cursor:'pointer', background: isSelected ? '#EFF6FF' : 'transparent', marginBottom:2 }}>
                        <input type="checkbox" readOnly checked={isSelected}/>
                        <div style={{ fontSize:13, fontWeight: isSelected ? 600 : 400 }}>{s.name}</div>
                      </div>
                    );
                  })}
                  {(selectedBatch.staffDetails||[]).length === 0 && !selectedBatch.mentorId && (
                    <div style={{ fontSize:12, color:'#9CA3AF', padding:8 }}>No staff assigned to this batch yet.</div>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setShowCreateAssessment(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={!assessmentForm.title || !assessmentForm.totalMarks || saving} onClick={handleCreateAssessment}>
                  {saving ? 'Creating...' : 'Create Assessment'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* View Results Modal */}
        {showViewResults && (
          <Modal title={`Results — ${showViewResults.title}`} onClose={() => setShowViewResults(null)} wide>
            <div style={{ marginBottom:12, fontSize:13, color:'#6B7280' }}>
              Total Marks: <strong>{showViewResults.totalMarks}</strong> · Date: {showViewResults.date||'—'}
            </div>
            {(() => {
              const results = assessmentResults[showViewResults.id] || [];
              if (results.length === 0) return <div style={{ color:'#9CA3AF', textAlign:'center', padding:32 }}>No marks imported yet.</div>;
              return (
                <div className="table-container" style={{ maxHeight:360, overflowY:'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th><th>Student Name</th><th>Phone</th><th>Marks</th><th>%</th><th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={r.id||i}>
                          <td style={{ color:'#9CA3AF' }}>{i+1}</td>
                          <td style={{ fontWeight:600 }}>{r.studentName}</td>
                          <td style={{ color:'#6B7280' }}>{r.phone||'—'}</td>
                          <td style={{ fontWeight:700 }}>{r.marksScored} / {r.totalMarks}</td>
                          <td>{r.percentage}%</td>
                          <td>
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600,
                              background: r.passed ? '#D1FAE5' : '#FEE2E2',
                              color: r.passed ? '#065F46' : '#991B1B' }}>
                              {r.passed ? 'Pass' : 'Fail'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
              <button className="btn btn-ghost" onClick={() => setShowViewResults(null)}>Close</button>
            </div>
          </Modal>
        )}

        {/* Import Marks Modal */}
        {showImportMarks && (
          <Modal title={`Import Marks — ${showImportMarks.title}`} onClose={() => { setShowImportMarks(null); setMarksPreview(null); }} wide>
            <div style={{ padding:'10px 14px', background:'#DBEAFE', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:14, lineHeight:1.6 }}>
              ℹ️ Upload a CSV with columns: <strong>name</strong> (student name), <strong>phone</strong> (number), <strong>marks</strong> (marks scored).<br/>
              Pass mark is 40% of total marks ({Math.round((showImportMarks.totalMarks||100)*0.4)} out of {showImportMarks.totalMarks}).
            </div>
            <input ref={marksFileRef} type="file" accept=".csv" style={{ display:'none' }}
              onChange={async e => {
                const t = await e.target.files[0]?.text();
                if (t) setMarksPreview(parseCSV(t, null));
              }}/>
            <div onClick={() => marksFileRef.current.click()} style={{ border:'2px dashed #E5E7EB', borderRadius:10, padding:'24px', textAlign:'center', cursor:'pointer', background:'#FAFAFA', marginBottom:14 }}>
              <Upload size={22} style={{ color:'#9CA3AF', marginBottom:6 }}/>
              <div style={{ fontSize:13, fontWeight:500 }}>{marksPreview ? `${marksPreview.length} rows loaded` : 'Click to upload CSV'}</div>
            </div>
            {marksPreview && (
              <div className="table-container" style={{ maxHeight:200, overflowY:'auto', marginBottom:12 }}>
                <table>
                  <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Marks Scored</th><th>Result</th></tr></thead>
                  <tbody>
                    {marksPreview.slice(0,10).map((r, i) => {
                      const scored = Number(r.marks || r.marksScored || r.score || 0);
                      const pct = Math.round(scored / (showImportMarks.totalMarks||100) * 100);
                      return (
                        <tr key={i}>
                          <td style={{ color:'#9CA3AF' }}>{i+1}</td>
                          <td style={{ fontWeight:500 }}>{r.name||r.studentName||'—'}</td>
                          <td style={{ color:'#6B7280' }}>{r.phone||r.number||'—'}</td>
                          <td style={{ fontWeight:700 }}>{scored} / {showImportMarks.totalMarks}</td>
                          <td><span style={{ fontSize:11, padding:'2px 6px', borderRadius:8, fontWeight:600,
                            background: pct>=40?'#D1FAE5':'#FEE2E2', color: pct>=40?'#065F46':'#991B1B' }}>{pct>=40?'Pass':'Fail'}</span></td>
                        </tr>
                      );
                    })}
                    {marksPreview.length > 10 && <tr><td colSpan={5} style={{ textAlign:'center', color:'#6B7280', padding:8 }}>...{marksPreview.length-10} more</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowImportMarks(null); setMarksPreview(null); }}>Cancel</button>
              <button className="btn btn-primary" disabled={!marksPreview || importingMarks} onClick={handleImportMarks}>
                {importingMarks ? 'Importing...' : `Import ${marksPreview?.length||0} Results`}
              </button>
            </div>
          </Modal>
        )}

        {/* Delete Student Confirm */}
        {deleteStudentConfirm && (
          <Modal title="Delete Student" onClose={() => setDeleteStudentConfirm(null)}>
            <p style={{ fontSize:14, color:'#374151', marginBottom:20 }}>
              Are you sure you want to delete <strong>{deleteStudentConfirm.name}</strong>?
              They will be moved to Trash and can be restored.
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteStudentConfirm(null)}>Cancel</button>
              <button className="btn btn-sm" style={{ background:'#EF4444', color:'#fff', border:'none' }}
                disabled={saving} onClick={() => handleDeleteStudent(deleteStudentConfirm)}>
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </Modal>
        )}

        {/* Add Staff Modal */}
        {showAddStaff && (
          <Modal title={`Add Staff to ${selectedBatch.name}`} onClose={() => { setShowAddStaff(false); setSelectedStaffIds([]); setStaffSearch(''); }}>
            <input className="form-input" placeholder="Search staff..." style={{ marginBottom:12 }}
              value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
            <div style={{ maxHeight:280, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {staffList.filter(s => (!staffSearch || s.name?.toLowerCase().includes(staffSearch.toLowerCase()) || s.phone?.includes(staffSearch))).map(s => (
                <div key={s.id} onClick={() => setSelectedStaffIds(prev => prev.includes(s.id) ? prev.filter(x=>x!==s.id) : [...prev, s.id])}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, cursor:'pointer',
                    background: selectedStaffIds.includes(s.id) ? '#EFF6FF' : '#F9FAFB',
                    border: `1px solid ${selectedStaffIds.includes(s.id) ? '#3B82F6' : '#E5E7EB'}` }}>
                  <input type="checkbox" readOnly checked={selectedStaffIds.includes(s.id)} style={{ marginRight:4 }}/>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>{s.name} ({s.phone || 'no phone'})</div>
                    <div style={{ fontSize:11, color:'#9CA3AF' }}>{s.role}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowAddStaff(false); setSelectedStaffIds([]); }}>Cancel</button>
              <button className="btn btn-primary" disabled={!selectedStaffIds.length || saving} onClick={handleAddStaffToBatch}>
                {saving ? 'Saving...' : `Add ${selectedStaffIds.length} Staff`}
              </button>
            </div>
          </Modal>
        )}

        {/* Removal Request Modal */}
        {showRemovalModal && (
          <Modal title="Request Removal" onClose={() => { setShowRemovalModal(null); setRemovalReason(''); }}>
            <p style={{ fontSize:14, color:'#374151', marginBottom:12 }}>
              Request removal from <strong>{showRemovalModal.targetName}</strong>. Reason:
            </p>
            <textarea className="form-input" rows={3} placeholder="Explain reason..."
              value={removalReason} onChange={e => setRemovalReason(e.target.value)} style={{ marginBottom:16 }}/>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowRemovalModal(null); setRemovalReason(''); }}>Cancel</button>
              <button className="btn btn-primary" disabled={!removalReason.trim() || saving} onClick={handleSubmitRemovalRequest}>
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </Modal>
        )}

        {/* Add Student */}
        {showAddStudent && (
          <Modal title={`Add Student to ${selectedBatch.name}`} onClose={() => setShowAddStudent(false)} wide>
            <form onSubmit={handleAddStudent} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {batchFields.map(f => (
                  <div key={f.key} className="form-group">
                    <label className="form-label">{f.label}{f.required?' *':''}</label>
                    <input className="form-input" type={f.type||'text'} required={f.required}
                      value={studentForm[f.key]||''} onChange={e => setStudentForm({...studentForm,[f.key]:e.target.value})}/>
                  </div>
                ))}
                <div className="form-group">
                  <label className="form-label">Staff Assigned</label>
                  <select className="form-input" value={studentForm.staffAssigned||''} onChange={e => setStudentForm({...studentForm,staffAssigned:e.target.value})}>
                    <option value="">Select</option>
                    {staffList.map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Join Date</label>
                  <input className="form-input" type="date" value={studentForm.joinDate||''} onChange={e => setStudentForm({...studentForm,joinDate:e.target.value})}/>
                </div>
              </div>
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
            <div style={{ padding:'10px 14px', background:'#FEF3C7', borderRadius:8, fontSize:12, color:'#92400E', marginBottom:14, lineHeight:1.6 }}>
              ⚠️ <strong>Important:</strong> The CSV column order must match the app field order exactly, OR use the downloaded template.<br/>
              Column names are matched by name (case-insensitive), but the order should match to avoid mismatches.<br/>
              If your CSV has a <strong>Timestamp</strong> column, the date will be auto-captured as the joining date.<br/>
              Expected columns: <strong>{batchFields.map(f=>f.label).join(', ')}</strong>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:14 }} onClick={() => downloadTemplate(selectedBatch.name, batchFields)}>
              <Download size={13}/> Download CSV Template
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
              onChange={async e => { const t = await e.target.files[0]?.text(); if(t) setCsvPreview(parseCSV(t, selectedBatch.studentFields || DEFAULT_STUDENT_FIELDS)); }}/>
            <div onClick={() => fileRef.current.click()} style={{ border:'2px dashed #E5E7EB', borderRadius:10, padding:'24px', textAlign:'center', cursor:'pointer', background:'#FAFAFA', marginBottom:14 }}>
              <Upload size={22} style={{ color:'#9CA3AF', marginBottom:6 }}/>
              <div style={{ fontSize:13, fontWeight:500 }}>{csvPreview?`${csvPreview.length} rows loaded`:'Click to upload CSV'}</div>
            </div>
            {csvPreview && (
              <div className="table-container" style={{ maxHeight:180, overflow:'auto', marginBottom:12 }}>
                <table>
                  <thead><tr><th>#</th>{batchFields.slice(0,4).map(f=><th key={f.key}>{f.label}</th>)}</tr></thead>
                  <tbody>
                    {csvPreview.slice(0,6).map((r,i)=>(
                      <tr key={i}><td style={{ color:'#9CA3AF' }}>{i+1}</td>{batchFields.slice(0,4).map(f=><td key={f.key} style={{ fontSize:12 }}>{r[f.key]||'—'}</td>)}</tr>
                    ))}
                    {csvPreview.length>6&&<tr><td colSpan={5} style={{ textAlign:'center', color:'#6B7280', padding:8 }}>...{csvPreview.length-6} more</td></tr>}
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

        {/* Course Flow Config */}
        {showFlowConfig && (
          <Modal title={`Configure Course Flow — ${selectedBatch.name}`} onClose={() => setShowFlowConfig(false)} wide>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {editFlow.map((step, idx) => (
                <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background:'#F9FAFB', borderRadius:8 }}>
                  <span style={{ width:24, height:24, borderRadius:'50%', background:'#E53935', color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{idx+1}</span>
                  <input className="form-input" style={{ flex:2 }} value={step.label}
                    onChange={e => { const u=[...editFlow]; u[idx]={...u[idx],label:e.target.value}; setEditFlow(u); }}/>
                  <select className="form-input" style={{ flex:1 }} value={step.phase}
                    onChange={e => { const u=[...editFlow]; u[idx]={...u[idx],phase:e.target.value}; setEditFlow(u); }}>
                    {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" style={{ color:'#EF4444' }} onClick={() => setEditFlow(editFlow.filter((_,i)=>i!==idx))}><Trash2 size={13}/></button>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }} onClick={() => setEditFlow([...editFlow, { key:generateKey('step'), label:'New Step', phase:'course' }])}>
              <Plus size={13}/> Add Step
            </button>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowFlowConfig(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveFlowConfig} disabled={saving}>{saving?'Saving...':'Save Flow'}</button>
            </div>
          </Modal>
        )}

        {/* Student Fields Config */}
        {showFieldConfig && (
          <Modal title={`Configure Student Fields — ${selectedBatch.name}`} onClose={() => setShowFieldConfig(false)} wide>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {editFields.map((field, idx) => (
                <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background:'#F9FAFB', borderRadius:8 }}>
                  <input className="form-input" style={{ flex:2 }} placeholder="Label" value={field.label}
                    onChange={e => { const u=[...editFields]; u[idx]={...u[idx],label:e.target.value}; setEditFields(u); }}/>
                  <select className="form-input" style={{ flex:1 }} value={field.type||'text'}
                    onChange={e => { const u=[...editFields]; u[idx]={...u[idx],type:e.target.value}; setEditFields(u); }}>
                    {['text','email','tel','number','date'].map(t=><option key={t}>{t}</option>)}
                  </select>
                  <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, whiteSpace:'nowrap' }}>
                    <input type="checkbox" checked={field.required||false}
                      onChange={e => { const u=[...editFields]; u[idx]={...u[idx],required:e.target.checked}; setEditFields(u); }}/> Required
                  </label>
                  <button className="btn btn-ghost btn-sm" style={{ color:'#EF4444' }} onClick={() => setEditFields(editFields.filter((_,i)=>i!==idx))}><Trash2 size={13}/></button>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }} onClick={() => setEditFields([...editFields, { key:generateKey('field'), label:'New Field', required:false, type:'text' }])}>
              <Plus size={13}/> Add Field
            </button>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowFieldConfig(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveFieldConfig} disabled={saving}>{saving?'Saving...':'Save Fields'}</button>
            </div>
          </Modal>
        )}

        {/* Subject Config */}
        {showSubjectConfig && (
          <Modal title={`Configure Subjects — ${selectedBatch.name}`} onClose={() => setShowSubjectConfig(false)} wide>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
              {editSubjects.map((sub, idx) => (
                <div key={idx} style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background:'#F9FAFB', borderRadius:8 }}>
                  <input className="form-input" style={{ flex:2 }} placeholder="Subject name" value={sub.name}
                    onChange={e => { const u=[...editSubjects]; u[idx]={...u[idx],name:e.target.value}; setEditSubjects(u); }}/>
                  <select className="form-input" style={{ flex:2 }} value={sub.facultyName||''}
                    onChange={e => { const u=[...editSubjects]; u[idx]={...u[idx],facultyName:e.target.value}; setEditSubjects(u); }}>
                    <option value="">Select Faculty</option>
                    {(selectedBatch.faculties||[]).map((f,i)=><option key={i}>{f}</option>)}
                    {staffList.map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" style={{ color:'#EF4444' }} onClick={() => setEditSubjects(editSubjects.filter((_,i)=>i!==idx))}><Trash2 size={13}/></button>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }} onClick={() => setEditSubjects([...editSubjects, { name:'', facultyName:'' }])}>
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
          <Modal title="Add Class" onClose={() => setShowSchedule(false)}>
            <form onSubmit={handleAddSchedule} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div className="form-group"><label className="form-label">Title *</label><input className="form-input" required placeholder="e.g. Python Basics — Chapter 3" value={scheduleForm.title} onChange={e=>setScheduleForm({...scheduleForm,title:e.target.value})}/></div>
              <div className="form-group">
                <label className="form-label">Date (optional — for one-time classes)</label>
                <input className="form-input" type="date" value={scheduleForm.scheduledDate} onChange={e=>setScheduleForm({...scheduleForm,scheduledDate:e.target.value})}/>
                <div style={{ fontSize:11, color:'#9CA3AF', marginTop:3 }}>Leave blank to make this a recurring weekly class using the day below.</div>
              </div>
              <FormRow>
                <div className="form-group">
                  <label className="form-label">Day of week (for recurring)</label>
                  <select className="form-input" value={scheduleForm.day} onChange={e=>setScheduleForm({...scheduleForm,day:e.target.value})} disabled={!!scheduleForm.scheduledDate}>
                    {DAYS.map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Time *</label><input className="form-input" type="time" required value={scheduleForm.time} onChange={e=>setScheduleForm({...scheduleForm,time:e.target.value})}/></div>
              </FormRow>
              <FormRow>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={scheduleForm.type} onChange={e=>setScheduleForm({...scheduleForm,type:e.target.value})}>
                    <option value="live-class">Live Class</option>
                    <option value="recorded">Recorded Session</option>
                    <option value="assignment">Assignment</option>
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
                <div className="form-group"><label className="form-label">Meet / Zoom Link</label><input className="form-input" type="url" placeholder="https://..." value={scheduleForm.meetLink} onChange={e=>setScheduleForm({...scheduleForm,meetLink:e.target.value})}/></div>
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
                    {/* Subjects from batch staff profiles */}
                    {[...new Set((selectedBatch.staffDetails||[]).flatMap(s => (s.subjects||[]).map(x => typeof x==='object'?x.name:x)).filter(Boolean))].map((sub,i) => (
                      <option key={i} value={sub}>{sub}</option>
                    ))}
                    {/* Also any batch-level subjects */}
                    {(selectedBatch.subjects||[]).filter(s => s.name).map((s,i)=><option key={`bs-${i}`} value={s.name}>{s.name}</option>)}
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

        {/* Attendance CSV Upload Modal */}
        {showAttendance && (
          <Modal title={`Upload Attendance — ${showAttendance.title}`} onClose={() => { setShowAttendance(null); setAttendanceCsv(null); setAttendancePreview(null); }}>
            <div style={{ padding:'10px 14px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:14 }}>
              <strong>Instructions:</strong> Upload a CSV or Excel file with columns:
              <code style={{ background:'#DBEAFE', padding:'1px 6px', borderRadius:4, marginLeft:4 }}>Name, Phone, Present</code>
              <br/>The Present column should be <strong>Yes</strong> or <strong>No</strong>. Students are matched by phone number.
            </div>
            <input ref={attendanceFileRef} type="file" accept=".csv" style={{ display:'none' }}
              onChange={async e => {
                const text = await e.target.files[0]?.text();
                if (!text) return;
                const lines = text.trim().split('\n');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,''));
                const rawRecords = lines.slice(1).map(line => {
                  const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g,''));
                  const obj = {};
                  headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
                  return obj;
                }).filter(r => r.name || r.phone);
                // Match to batch students by phone
                const enriched = rawRecords.map(r => {
                  const phone = r.phone || r.phonenumber || r.phone_number || '';
                  const matched = batchStudents.find(s => s.phone === phone || s.whatsappNumber === phone);
                  return {
                    studentId: matched?.id || null,
                    name: matched?.name || r.name || r.studentname || '?',
                    phone,
                    present: (r.present || r.attendance || '').toLowerCase() === 'yes',
                    matched: !!matched,
                  };
                });
                setAttendanceCsv(rawRecords);
                setAttendancePreview(enriched);
              }}
            />
            <div onClick={() => attendanceFileRef.current.click()} style={{
              border:'2px dashed #E5E7EB', borderRadius:10, padding:'28px 20px', textAlign:'center',
              cursor:'pointer', background:'#FAFAFA', marginBottom:14, transition:'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#E53935'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
            >
              <Upload size={26} style={{ color:'#D1D5DB', marginBottom:8 }}/>
              <div style={{ fontSize:13, fontWeight:500, color:'#374151' }}>
                {attendancePreview ? `${attendancePreview.length} records loaded` : 'Click to upload attendance CSV'}
              </div>
              {!attendancePreview && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>Supports .csv format</div>}
            </div>

            {attendancePreview && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:8, color:'#374151' }}>
                  Preview ({attendancePreview.filter(r=>r.present).length} present / {attendancePreview.filter(r=>!r.present).length} absent)
                </div>
                <div style={{ maxHeight:240, overflowY:'auto', border:'1px solid #E5E7EB', borderRadius:8 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#F8FAFC', position:'sticky', top:0 }}>
                        {['Name','Phone','Status','Matched'].map(h=>(
                          <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1px solid #E5E7EB' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attendancePreview.map((r, i) => (
                        <tr key={i} style={{ background: r.present ? '#F0FDF4' : '#FFF8F8' }}>
                          <td style={{ padding:'7px 10px', fontWeight:500 }}>{r.name}</td>
                          <td style={{ padding:'7px 10px', color:'#6B7280' }}>{r.phone || '—'}</td>
                          <td style={{ padding:'7px 10px' }}>
                            <span style={{ fontWeight:600, fontSize:11, color: r.present ? '#10B981' : '#EF4444' }}>
                              {r.present ? '✅ Present' : '❌ Absent'}
                            </span>
                          </td>
                          <td style={{ padding:'7px 10px' }}>
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
              </div>
            )}

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowAttendance(null); setAttendanceCsv(null); setAttendancePreview(null); }}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!attendancePreview || saving}
                onClick={async () => {
                  setSaving(true);
                  await saveAttendance(showAttendance.id, selectedBatch.id, attendancePreview.map(r => ({
                    studentId: r.studentId,
                    name: r.name,
                    phone: r.phone,
                    present: r.present,
                  })));
                  setAttendanceSaved(prev => ({ ...prev, [showAttendance.id]: true }));
                  setToast({ message:'Attendance saved successfully!', type:'success' });
                  setShowAttendance(null);
                  setAttendanceCsv(null);
                  setAttendancePreview(null);
                  setSaving(false);
                }}
              >
                {saving ? 'Saving...' : `Save Attendance (${attendancePreview?.length || 0} records)`}
              </button>
            </div>
          </Modal>
        )}

        {/* Overdue class confirmation dialog */}
        {overdueConfirm && (
          <Modal title="Mark Overdue Class" onClose={() => setOverdueConfirm(null)}>
            <div style={{ marginBottom:16, fontSize:14, color:'#374151', lineHeight:1.6 }}>
              Did the class <strong>"{overdueConfirm.title}"</strong> ({overdueConfirm.day} at {overdueConfirm.time}) take place?
              <br/>Please mark it as completed or cancelled, and optionally upload attendance.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                className="btn btn-primary" style={{ flex:1 }}
                onClick={async () => {
                  await updateScheduleStatus(overdueConfirm.id, 'completed');
                  const sch = await getBatchSchedules(selectedBatch.id);
                  setSchedules(sch);
                  setOverdueConfirm(null);
                  setShowAttendance(overdueConfirm);
                  setToast({ message:'Marked as completed. Upload attendance now.', type:'success' });
                }}
              >
                Yes — Mark Completed
              </button>
              <button
                className="btn btn-danger" style={{ flex:1 }}
                onClick={async () => {
                  await updateScheduleStatus(overdueConfirm.id, 'cancelled');
                  const sch = await getBatchSchedules(selectedBatch.id);
                  setSchedules(sch);
                  setOverdueConfirm(null);
                  setToast({ message:'Marked as cancelled.', type:'success' });
                }}
              >
                No — Mark Cancelled
              </button>
            </div>
          </Modal>
        )}

        {/* Share Schedule Modal */}
        {showShareSchedule && (
          <Modal title="Share Schedule" onClose={() => setShowShareSchedule(false)}>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <p style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>
                Share this link with students. They can view the class schedule without logging in.
              </p>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input
                  className="form-input"
                  readOnly
                  value={`${window.location.origin}/public-schedule/${selectedBatch.id}`}
                  style={{ flex:1, fontFamily:'monospace', fontSize:12 }}
                  onFocus={e => e.target.select()}
                />
                <button className="btn btn-primary btn-sm" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/public-schedule/${selectedBatch.id}`);
                  setToast({ message:'Link copied!', type:'success' });
                }}>Copy Link</button>
              </div>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>
                Anyone with this link can view the schedule (read-only, no login required).
              </div>
            </div>
          </Modal>
        )}

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}

        {/* In-app confirmation dialog (batch detail) */}
        {confirmDialog && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
            onClick={e => { if (e.target === e.currentTarget) setConfirmDialog(null); }}>
            <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:420, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:12 }}>Are you sure?</div>
              <div style={{ fontSize:14, color:'#6B7280', marginBottom:24, lineHeight:1.6 }}>{confirmDialog.message}</div>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setConfirmDialog(null)}>Cancel</button>
                <button className="btn btn-sm" style={{ background:'#EF4444', color:'#fff', border:'none', padding:'8px 20px' }}
                  onClick={async () => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); await fn(); }}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // BATCH LIST VIEW
  // ══════════════════════════════════════════════════════════════
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
                <div
                  key={b.id}
                  className="card"
                  style={{ cursor:'pointer', transition:'box-shadow 0.15s, transform 0.15s' }}
                  onClick={() => openBatch(b)}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform=''; }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{b.name}</div>
                      <div style={{ fontSize:12, color:'#6B7280' }}>{b.course}{b.courseDurationMonths?` · ${b.courseDurationMonths}mo`:''}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                      <span className={`badge ${b.status==='active'?'badge-green':b.status==='upcoming'?'badge-blue':'badge-gray'}`}>{b.status}</span>
                      {b.endDate && new Date(b.endDate) < new Date() && (
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:'#E5E7EB', color:'#6B7280', fontWeight:600 }}>Expired</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize:13, marginBottom:8 }}>
                    <span style={{ color:'#6B7280' }}>Students: </span>
                    <strong style={{ color:'#0F3460', fontSize:16 }}>{batchCounts[b.id]||0}</strong>
                    {b.mentorName && <><span style={{ color:'#6B7280', marginLeft:10 }}>Mentor: </span>{b.mentorName}</>}
                  </div>
                  {b.status==='active' && (
                    <div style={{ height:4, background:'#E5E7EB', borderRadius:2, overflow:'hidden', marginTop:4 }}>
                      <div style={{ height:'100%', width:`${progress(b)}%`, background:'#E53935', transition:'width 0.3s' }}/>
                    </div>
                  )}
                  <div style={{ marginTop:10, paddingTop:8, borderTop:'1px solid #F3F4F6', fontSize:12, color:'#E53935', display:'flex', alignItems:'center', gap:4 }}>
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
                <input className="form-input" type="number" required placeholder="6" value={createForm.courseDurationMonths} onChange={e=>setCreateForm({...createForm,courseDurationMonths:e.target.value})}/>
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={createForm.startDate} onChange={e=>setCreateForm({...createForm,startDate:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={createForm.endDate} onChange={e=>setCreateForm({...createForm,endDate:e.target.value})}/></div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Assign Mentor</label>
              <select className="form-input" value={createForm.mentorId}
                onChange={e => {
                  const sel = staffList.find(s => s.id === e.target.value);
                  setCreateForm({ ...createForm, mentorId: e.target.value, mentorName: sel?.name || '' });
                }}>
                <option value="">Select Mentor</option>
                {staffList.filter(s=>s.role!=='ceo').map(s=>(
                  <option key={s.id} value={s.id}>{s.name} ({s.phone || 'no phone'})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Assign Faculties / Staff</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'10px', background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)', minHeight:48 }}>
                {staffList.filter(s=>s.role!=='ceo').map(s=>(
                  <div key={s.id} onClick={() => toggleFaculty(s.name)} style={{
                    padding:'5px 12px', borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:500,
                    background: createForm.faculties.includes(s.name)?'#E53935':'var(--white)',
                    color: createForm.faculties.includes(s.name)?'#fff':'var(--text)',
                    border: `1px solid ${createForm.faculties.includes(s.name)?'#E53935':'var(--border)'}`,
                    transition:'all 0.12s',
                  }}>
                    {s.name} ({s.phone || s.role})
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
              After creating the batch, use "Course Flow", "Student Fields", and "Subjects" buttons inside to customize them.
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Creating...':'Create Batch'}</button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}

      {/* In-app confirmation dialog */}
      {confirmDialog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDialog(null); }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, maxWidth:420, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:12 }}>Are you sure?</div>
            <div style={{ fontSize:14, color:'#6B7280', marginBottom:24, lineHeight:1.6 }}>{confirmDialog.message}</div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className="btn btn-sm" style={{ background:'#EF4444', color:'#fff', border:'none', padding:'8px 20px' }}
                onClick={async () => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await fn();
                }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
