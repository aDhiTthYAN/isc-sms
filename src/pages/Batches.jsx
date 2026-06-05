import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getBatches, addBatch, updateBatch,
  getBatchStudents, addStudent, bulkAddStudents, getBatchStudentCount,
  getStaffProfiles, getBatchSchedules, addBatchSchedule, deleteBatchSchedule,
  getBatchTasks, addBatchTask, markTaskSubmitted,
  updateScheduleStatus, saveAttendance, getSessionAttendance,
  addNotification, getTrashItems, permanentDelete,
  createRequest
} from '../firebase/services';
import {
  collection, addDoc, deleteDoc, doc, setDoc, serverTimestamp, getDocs, query, where, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Modal, Toast, Loading, FormRow, Avatar, StatusBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Upload, UserPlus, ChevronRight, ArrowLeft,
  Download, CheckSquare, Users, Trash2, Settings,
  AlertTriangle, CheckCircle, X, Search
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
  { key: 'varkResult',    label: 'VARK Learning Style',       required: false, type: 'text'  },
  { key: 'syllabus',      label: 'Syllabus (CBSE/STATE/ICSE)',required: false, type: 'text'  },
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
function OnboardingStepPanel({ step, onClose }) {
  const [tab, setTab] = useState('not');
  if (!step) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: 420, height: '100vh',
      background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
      zIndex: 1000, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>{step.label}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'capitalize' }}>{step.phase} phase</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}><X size={18} /></button>
      </div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E7EB' }}>
        {[
          { key: 'completed', label: `Completed (${step.completedStudents?.length || 0})`, color: '#10B981' },
          { key: 'not',       label: `Not Completed (${step.notCompletedStudents?.length || 0})`, color: '#EF4444' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: tab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
              color: tab === t.key ? t.color : '#9CA3AF', transition: 'all 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {tab === 'completed' && (
          <>
            {(step.completedStudents || []).length === 0 && (
              <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>No students completed yet.</div>
            )}
            {(step.completedStudents || []).map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, marginBottom: 4, background: '#F0FDF4' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#065F46', flexShrink: 0 }}>
                  {(s.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.phone || '—'}</div>
                </div>
                <CheckCircle size={14} style={{ color: '#10B981', flexShrink: 0 }} />
              </div>
            ))}
          </>
        )}
        {tab === 'not' && (
          <>
            {(step.notCompletedStudents || []).length === 0 && (
              <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>All students completed this step!</div>
            )}
            {(step.notCompletedStudents || []).map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, marginBottom: 4, background: '#FFF8F8' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#E53935', flexShrink: 0 }}>
                  {(s.name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.phone || '—'} · Staff: {s.staffAssigned || '—'}</div>
                </div>
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
  const [taskSearch, setTaskSearch]         = useState('');

  // Overdue class confirmation dialog
  const [overdueConfirm, setOverdueConfirm] = useState(null);

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
    title:'', day:'Monday', time:'', duration:'60', type:'live-class',
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
      setBatchStudents([]); setSchedules([]); setBatchTasks([]);
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
      fields.forEach(f => {
        const csvKey = f.key.toLowerCase().replace(/[^a-z0-9]/g,'');
        obj[f.key] = row[csvKey]||row[f.key]||'';
      });
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
        deletedAt: serverTimestamp(), deletedBy: profile?.uid,
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
        uid: s.id, name: s.name, phone: s.phone || '', email: s.email || '', subjects: [],
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

  const handleAddSchedule = async (e) => {
    e.preventDefault(); setSaving(true);
    await addBatchSchedule({ ...scheduleForm, batchId:selectedBatch.id, batchName:selectedBatch.name });
    setToast({ message:'Schedule added!', type:'success' });
    setShowSchedule(false);
    setScheduleForm({ title:'', day:'Monday', time:'', duration:'60', type:'live-class', facultyName:'', meetLink:'', notes:'' });
    const sch = await getBatchSchedules(selectedBatch.id);
    setSchedules(sch); setSaving(false);
  };

  const handleAddTask = async (e) => {
    e.preventDefault(); setSaving(true);
    await addBatchTask({ ...taskForm, batchId:selectedBatch.id, batchName:selectedBatch.name, createdBy:profile?.name });
    setToast({ message:'Task created!', type:'success' });
    setShowTask(false);
    setTaskForm({ title:'', subject:'', description:'', dueDate:'', assignedFaculty:'' });
    const tasks = await getBatchTasks(selectedBatch.id);
    setBatchTasks(tasks); setSaving(false);
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
        <OnboardingStepPanel step={selectedStep} onClose={() => setSelectedStep(null)} />

        {/* Header */}
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setSelectedBatch(null)}><ArrowLeft size={16}/></button>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700 }}>{selectedBatch.name}</h2>
                {isExpired && (
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'#E5E7EB', color:'#6B7280', fontWeight:600 }}>Expired</span>
                )}
              </div>
              <div style={{ fontSize:13, color:'#6B7280' }}>
                {selectedBatch.course}
                {selectedBatch.courseDurationMonths ? ` · ${selectedBatch.courseDurationMonths} months` : ''}
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
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditSubjects([...batchSubjects]); setShowSubjectConfig(true); }}><Settings size={13}/> Subjects</button>
              </>
            )}
            {activeTab === 'students' && !isExpired && (
              <>
                <button className="btn btn-ghost" onClick={() => setShowBulk(true)}><Upload size={14}/> Bulk CSV</button>
                {isCEOorAdmin && <button className="btn btn-primary" onClick={() => setShowAddStudent(true)}><UserPlus size={14}/> Add Student</button>}
              </>
            )}
            {activeTab === 'schedule' && !isExpired && (
              <button className="btn btn-primary" onClick={() => setShowSchedule(true)}><Plus size={14}/> Add Class</button>
            )}
            {activeTab === 'tasks' && !isExpired && (
              <button className="btn btn-primary" onClick={() => setShowTask(true)}><Plus size={14}/> Add Task</button>
            )}
            {profile?.role === 'ceo' && (
              <button
                className="btn btn-sm"
                style={{ background:'#EF4444', color:'#fff', border:'none' }}
                onClick={() => { if (window.confirm('Are you sure? This will archive all student data. Students can be restored from the Trash.')) handleDeleteBatch(); }}
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

        {/* Faculties + subjects */}
        <div style={{ marginBottom:14, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {batchSubjects.map((s,i) => (
            <span key={i} style={{ fontSize:11, padding:'3px 10px', borderRadius:10, background:'#EDE9FE', color:'#6D28D9', fontWeight:600 }}>
              {s.name}{s.facultyName ? ` → ${s.facultyName}` : ''}
            </span>
          ))}
          {selectedBatch.faculties?.map((f,i) => (
            <span key={i} className="badge badge-blue">{f}</span>
          ))}
        </div>

        {/* Tab bar */}
        <div className="tab-bar" style={{ marginBottom:16 }}>
          {[
            { key:'students',   label:`Students (${count})`               },
            { key:'onboarding', label:'Onboarding Analytics'              },
            { key:'schedule',   label:`Schedule (${schedules.length})`    },
            { key:'tasks',      label:`Assignments (${batchTasks.length})` },
            { key:'staff',      label:`Staff (${batchStaffDetails.length + (selectedBatch.mentorId ? 1 : 0)})` },
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
            const matchSearch = !studentSearch ||
              s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
              s.phone?.includes(studentSearch) ||
              s.fatherName?.toLowerCase().includes(studentSearch.toLowerCase()) ||
              s.motherName?.toLowerCase().includes(studentSearch.toLowerCase());
            const matchStatus = !studentStatusFilter || s.status === studentStatusFilter;
            return matchSearch && matchStatus;
          });
          const pages = Math.ceil(filtered.length / PAGE);
          const paginated = filtered.slice(studentPage * PAGE, (studentPage + 1) * PAGE);

          return (
            <div>
              <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                <input className="form-input" style={{ flex:2, minWidth:200 }} placeholder="Search by name, phone..."
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
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      {batchFields.map(f => <th key={f.key}>{f.label}</th>)}
                      <th>Staff</th><th>Status</th><th>Onboarding</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 && (
                      <tr><td colSpan={batchFields.length + 4} style={{ textAlign:'center', padding:40, color:'#6B7280' }}>
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
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600, background:onboardDone?'#D1FAE5':'#FEF3C7', color:onboardDone?'#065F46':'#92400E' }}>
                              {flowDone}/{batchFlow.length} {onboardDone ? '✅' : '⏳'}
                            </span>
                          </td>
                          <td style={{ display:'flex', gap:4, alignItems:'center' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/students/${s.id}`)}>View <ChevronRight size={12}/></button>
                            {profile?.role === 'ceo' && (
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
        {activeTab === 'schedule' && (
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
                  <div key={day} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:12, color:'#1A1A2E' }}>{day}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {daySlots.map(slot => {
                        const tc = typeColor(slot.type);
                        const isOverdue = overdueSessions.find(s => s.id === slot.id);
                        return (
                          <div key={slot.id} style={{
                            display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
                            background: isOverdue ? '#FFFBEB' : tc.bg,
                            borderRadius:9, border:`1px solid ${isOverdue ? '#FDE68A' : tc.col+'20'}`,
                          }}>
                            <div style={{ flexShrink:0, textAlign:'center', minWidth:52 }}>
                              <div style={{ fontWeight:700, fontSize:13, color:tc.col }}>{slot.time}</div>
                              <div style={{ fontSize:10, color:'#6B7280' }}>{slot.duration}min</div>
                            </div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:600, fontSize:13 }}>
                                {isOverdue && <AlertTriangle size={12} style={{ color:'#F59E0B', marginRight:5, display:'inline', verticalAlign:'middle' }}/>}
                                {slot.title}
                              </div>
                              <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                                {slot.facultyName && `${slot.facultyName}`}
                                {slot.meetLink && <a href={slot.meetLink} target="_blank" rel="noreferrer" style={{ color:'#E53935', marginLeft:8 }}>Join Link →</a>}
                              </div>
                              {slot.notes && <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>{slot.notes}</div>}
                            </div>

                            <span style={{ padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:tc.bg, color:tc.col, border:`1px solid ${tc.col}40`, flexShrink:0 }}>
                              {tc.label}
                            </span>

                            <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                              {slot.status === 'completed'   && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'#D1FAE5', color:'#065F46', fontWeight:600 }}>Done</span>}
                              {slot.status === 'cancelled'   && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'#FEE2E2', color:'#991B1B', fontWeight:600 }}>Cancelled</span>}
                              {slot.status === 'rescheduled' && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'#FEF3C7', color:'#92400E', fontWeight:600 }}>Rescheduled</span>}
                              {!slot.status && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'#DBEAFE', color:'#1E40AF', fontWeight:600 }}>Upcoming</span>}

                              {isOverdue ? (
                                <button
                                  style={{ fontSize:11, padding:'4px 10px', borderRadius:7, background:'#F59E0B', color:'#fff', border:'none', cursor:'pointer', fontWeight:600 }}
                                  onClick={() => setOverdueConfirm(slot)}
                                >
                                  Mark
                                </button>
                              ) : (
                                <select
                                  style={{ fontSize:11, padding:'3px 7px', borderRadius:6, border:'1px solid #E5E7EB', background:'#fff' }}
                                  value={slot.status || ''}
                                  onChange={async e => {
                                    const newStatus = e.target.value;
                                    if (!newStatus) return;
                                    await updateScheduleStatus(slot.id, newStatus);
                                    const sch = await getBatchSchedules(selectedBatch.id);
                                    setSchedules(sch);
                                  }}
                                >
                                  <option value="">Mark as...</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                  <option value="rescheduled">Rescheduled</option>
                                </select>
                              )}

                              <button
                                style={{ fontSize:11, padding:'4px 10px', borderRadius:7, background:'#EDE9FE', color:'#6D28D9', border:'none', cursor:'pointer', fontWeight:600 }}
                                onClick={() => setShowAttendance(slot)}
                              >
                                {attendanceSaved[slot.id] ? 'Attendance ✓' : 'Attendance'}
                              </button>
                            </div>

                            <button
                              onClick={async () => {
                                if (!window.confirm('Delete this schedule slot?')) return;
                                await deleteBatchSchedule(slot.id);
                                const sch = await getBatchSchedules(selectedBatch.id);
                                setSchedules(sch);
                              }}
                              style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', padding:'4px', flexShrink:0 }}
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

        {/* ── TASKS / ASSIGNMENTS TAB ── Split Panel ── */}
        {activeTab === 'tasks' && (
          <div style={{ display: 'flex', gap: 14, minHeight: 500 }}>
            {/* Left: Task list */}
            <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {batchTasks.length === 0 && (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  No assignments yet. Click "Add Task".
                </div>
              )}
              {batchTasks.map(task => {
                const submitted = task.submittedBy?.length || 0;
                const total = batchStudents.length || 1;
                const pctDone = Math.round(submitted / total * 100);
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && submitted < total;
                const isSelected = selectedTask === task.id;
                return (
                  <div
                    key={task.id}
                    onClick={() => { setSelectedTask(task.id); setTaskFilter('all'); setTaskSearch(''); }}
                    style={{
                      background: isSelected ? '#1A1A2E' : '#fff',
                      borderRadius: 10, border: `2px solid ${isSelected ? '#E53935' : isOverdue ? '#FECACA' : '#E5E7EB'}`,
                      padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#fff' : '#1A1A2E', marginBottom: 4 }}>{task.title}</div>
                    {task.subject && (
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: isSelected ? 'rgba(255,255,255,0.15)' : '#EDE9FE', color: isSelected ? '#fff' : '#6D28D9', fontWeight: 600, marginBottom: 4, display: 'inline-block' }}>
                        {task.subject}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <div style={{ height: 4, flex: 1, background: isSelected ? 'rgba(255,255,255,0.15)' : '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginRight: 8 }}>
                        <div style={{ height: '100%', width: `${pctDone}%`, background: pctDone === 100 ? '#10B981' : '#F59E0B' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#fff' : (pctDone === 100 ? '#10B981' : '#F59E0B'), whiteSpace: 'nowrap' }}>
                        {submitted}/{total}
                      </span>
                    </div>
                    {isOverdue && <div style={{ fontSize: 10, color: isSelected ? '#FCA5A5' : '#EF4444', marginTop: 4, fontWeight: 600 }}>Overdue</div>}
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
                                {!submittedEntry ? (
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
                        <td style={{ color:'#6B7280' }}>{(s.subjects||[]).join(', ')||'—'}</td>
                        <td>
                          {s.isMentor
                            ? <span style={{ fontSize:11, padding:'2px 9px', borderRadius:10, background:'#FEF3C7', color:'#92400E', fontWeight:700 }}>Mentor</span>
                            : <span style={{ fontSize:11, padding:'2px 9px', borderRadius:10, background:'#DBEAFE', color:'#1E40AF', fontWeight:600 }}>Staff</span>
                          }
                        </td>
                        <td style={{ display:'flex', gap:6 }}>
                          {profile?.role === 'ceo' && !s.isMentor && (
                            <button className="btn btn-sm" style={{ background:'#FEE2E2', color:'#EF4444', border:'none' }}
                              onClick={() => { if (window.confirm(`Remove ${s.name} from batch?`)) handleRemoveStaffFromBatch(s.uid); }}>
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

        {/* ── MODALS ── */}

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
              {staffList.filter(s => s.role !== 'ceo' && (!staffSearch || s.name?.toLowerCase().includes(staffSearch.toLowerCase()) || s.phone?.includes(staffSearch))).map(s => (
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
            <div style={{ padding:'8px 12px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:14 }}>
              CSV columns: <strong>{batchFields.map(f=>f.key).join(', ')}</strong>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom:14 }} onClick={() => downloadTemplate(selectedBatch.name, batchFields)}>
              <Download size={13}/> Download CSV Template
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
              onChange={async e => { const t = await e.target.files[0]?.text(); if(t) setCsvPreview(parseCSV(t)); }}/>
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

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
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
    </div>
  );
}
