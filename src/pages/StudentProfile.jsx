import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getStudent, updateStudent, getBatches,
  getFollowUps, addFollowUp, getAssessments, addAssessment,
  getStaffProfiles, updateWeakSubjects, updateCourseFlowStep
} from '../firebase/services';
import { Modal, Toast, Avatar, StatusBadge, Loading, FormRow } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Plus, Phone, Mail, MapPin, BookOpen,
  User, Calendar, Edit, CheckCircle, Circle, AlertTriangle,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp
} from 'lucide-react';

// ── Course Flow Steps ─────────────────────────────────────────
const COURSE_FLOW = [
  { key: 'admission',        label: 'Student Admission',                  phase: 'onboarding' },
  { key: 'parent_onboarding',label: 'Parent Onboarding',                  phase: 'onboarding' },
  { key: 'group_admission',  label: 'Group Admission',                    phase: 'onboarding' },
  { key: 'initial_assess',   label: 'Initial Assessment',                 phase: 'onboarding' },
  { key: 'vark_analysis',    label: 'VARK Analysis',                      phase: 'onboarding' },
  { key: 'psychologist',     label: 'Psychologist Interaction',           phase: 'onboarding' },
  { key: 'kit_dispatch',     label: 'Kit Packing & Dispatch',             phase: 'onboarding' },
  { key: 'instagram_setup',  label: 'Instagram Setup',                    phase: 'onboarding' },
  { key: 'kit_activities',   label: 'Kit Activities',                     phase: 'course' },
  { key: 'insta_post',       label: 'Instagram Post & Collaboration',     phase: 'course' },
  { key: 'faculty_interact', label: 'Faculty Interaction',                phase: 'course' },
  { key: 'class_start',      label: 'Class Start',                        phase: 'course' },
  { key: 'first_activity',   label: 'First Activity',                     phase: 'course' },
  { key: 'quiz_debate',      label: 'Quiz & Debate Sessions',             phase: 'course' },
  { key: 'skill_activities', label: 'Continuous Skill-Based Activities',  phase: 'course' },
  { key: 'subject_uploads',  label: 'Subject-wise Activity Uploads',      phase: 'course' },
  { key: 'insta_showcase',   label: 'Instagram Collaboration & Showcase', phase: 'course' },
  { key: 'followup_monitor', label: 'Regular Follow-up & Progress Monitoring', phase: 'course' },
];

const PHASE_LABELS = {
  onboarding: { label: '🚀 Onboarding Phase', color: '#3B82F6', bg: '#DBEAFE' },
  course:     { label: '📚 Course Phase',      color: '#10B981', bg: '#D1FAE5' },
};

const ALL_SUBJECTS = [
  'Mathematics', 'Science', 'English', 'Hindi', 'Social Science',
  'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'Python', 'Data Science', 'Web Development', 'Machine Learning',
  'Economics', 'Accountancy', 'Business Studies', 'Other'
];

export default function StudentProfile() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { profile }  = useAuth();

  const [student,     setStudent]     = useState(null);
  const [batches,     setBatches]     = useState([]);
  const [followups,   setFollowups]   = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [staffList,   setStaffList]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('overview');
  const [toast,       setToast]       = useState(null);

  // Edit modal
  const [editModal, setEditModal] = useState(false);
  const [editForm,  setEditForm]  = useState({});
  const [savingEdit,setSavingEdit]= useState(false);

  // Assessment modal
  const [assessModal, setAssessModal] = useState(false);
  const [assessForm,  setAssessForm]  = useState({ testName:'', subject:'', date:'', marks:'', totalMarks:'' });

  // Follow-up note
  const [newNote,    setNewNote]    = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Weak subjects
  const [weakModal,   setWeakModal]   = useState(false);
  const [weakSubjects,setWeakSubjects]= useState([]);
  const [savingWeak,  setSavingWeak]  = useState(false);

  // Course flow
  const [flowExpanded, setFlowExpanded] = useState({ onboarding: true, course: false });
  const [flowNoteModal, setFlowNoteModal] = useState(null); // { key, label }
  const [flowNote,      setFlowNote]      = useState('');
  const [savingFlow,    setSavingFlow]    = useState(false);

  const isCEOorAdmin = profile?.role === 'ceo' || profile?.role === 'admin';

  const load = async () => {
    const [s, b, f, a, st] = await Promise.all([
      getStudent(id), getBatches(), getFollowUps(id), getAssessments(id), getStaffProfiles()
    ]);
    setStudent(s);
    setBatches(b);
    setFollowups(f);
    setAssessments(a);
    setStaffList(st.filter(x => x.active !== false));
    setEditForm(s || {});
    setWeakSubjects(s?.weakSubjects || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const batchName = (bid) => batches.find(b => b.id === bid)?.name || '—';

  const fmt = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  };

  // Subscription validity
  const subInfo = () => {
    if (!student?.joinDate || !student?.courseDurationMonths) return null;
    const exp = new Date(student.joinDate);
    exp.setMonth(exp.getMonth() + Number(student.courseDurationMonths));
    const days = Math.ceil((exp - Date.now()) / 86400000);
    return { exp, days, expired: days < 0, expiringSoon: days >= 0 && days <= 30 };
  };

  // Course flow helpers
  const flowStep = (key) => student?.courseFlow?.[key];
  const flowDoneCount = () => COURSE_FLOW.filter(s => flowStep(s.key)?.done).length;

  const handleMarkFlow = async (step, done) => {
    if (done) {
      setFlowNoteModal(step);
    } else {
      await updateCourseFlowStep(id, step.key, { done: false, date: '', note: '' });
      setToast({ message: `"${step.label}" unmarked`, type: 'info' });
      load();
    }
  };

  const handleSaveFlowNote = async () => {
    if (!flowNoteModal) return;
    setSavingFlow(true);
    await updateCourseFlowStep(id, flowNoteModal.key, {
      done: true,
      date: new Date().toLocaleDateString('en-IN'),
      note: flowNote,
    });
    setFlowNoteModal(null);
    setFlowNote('');
    setSavingFlow(false);
    setToast({ message: `"${flowNoteModal.label}" marked complete!`, type: 'success' });
    load();
  };

  // Save follow-up
  const handleSaveNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    await addFollowUp({ studentId: id, studentName: student.name, note: newNote, addedBy: profile?.name || 'Staff' });
    setNewNote('');
    setToast({ message: 'Follow-up saved!', type: 'success' });
    const upd = await getFollowUps(id);
    setFollowups(upd);
    setSavingNote(false);
  };

  // Save edit
  const handleEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    await updateStudent(id, editForm);
    setToast({ message: 'Student updated!', type: 'success' });
    setEditModal(false);
    load();
    setSavingEdit(false);
  };

  // Save assessment
  const handleAddAssessment = async (e) => {
    e.preventDefault();
    const pct = Math.round(Number(assessForm.marks) / Number(assessForm.totalMarks) * 100);
    await addAssessment({ studentId: id, studentName: student.name, ...assessForm, percentage: pct });
    setToast({ message: 'Assessment added!', type: 'success' });
    setAssessModal(false);
    setAssessForm({ testName:'', subject:'', date:'', marks:'', totalMarks:'' });
    const upd = await getAssessments(id);
    setAssessments(upd);
  };

  // Save weak subjects
  const handleSaveWeak = async () => {
    setSavingWeak(true);
    await updateWeakSubjects(id, weakSubjects);
    setStudent(prev => ({ ...prev, weakSubjects }));
    setToast({ message: 'Weak subjects updated!', type: 'success' });
    setWeakModal(false);
    setSavingWeak(false);
  };

  const toggleWeak = (sub) => {
    setWeakSubjects(prev => prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]);
  };

  if (loading || !student) return <Loading />;

  const sub        = subInfo();
  const latestPct  = assessments.length ? assessments[assessments.length - 1].percentage : null;
  const firstPct   = assessments.length ? assessments[0].percentage : null;
  const trend      = (latestPct !== null && firstPct !== null && assessments.length > 1) ? latestPct - firstPct : null;
  const flowDone   = flowDoneCount();
  const flowTotal  = COURSE_FLOW.length;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => navigate('/students')}>
            <ArrowLeft size={16}/>
          </button>
          <div>
            <h2 style={{ fontSize:20 }}>{student.name}</h2>
            <div style={{ fontSize:12, color:'#6B7280' }}>
              {batchName(student.batchId)} · {student.course}
              {student.classplusId && ` · ${student.classplusId}`}
            </div>
          </div>
          <StatusBadge status={student.status}/>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost" onClick={() => setAssessModal(true)}>
            <Plus size={14}/> Assessment
          </button>
          <button className="btn btn-primary" onClick={() => setEditModal(true)}>
            <Edit size={14}/> Edit
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom:20 }}>
        {[
          { key:'overview',   label:'Overview'                              },
          { key:'courseflow', label:`Course Flow (${flowDone}/${flowTotal})`},
          { key:'assessments',label:`Assessments (${assessments.length})`   },
          { key:'followups',  label:`Follow-Ups (${followups.length})`      },
        ].map(t => (
          <div key={t.key} className={`tab ${activeTab===t.key?'active':''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {activeTab === 'overview' && (
        <div className="grid-2" style={{ alignItems:'start' }}>
          {/* Left — profile card */}
          <div>
            <div className="card" style={{ marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:18 }}>
                <Avatar name={student.name} size="lg"/>
                <div>
                  <div style={{ fontSize:17, fontWeight:700 }}>{student.name}</div>
                  {student.classStd && <div style={{ fontSize:12, color:'#6B7280' }}>{student.classStd}</div>}
                  <div style={{ fontSize:12, color:'#6B7280' }}>{student.course} · {batchName(student.batchId)}</div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:13 }}>
                {[
                  { icon:Phone,    label:'Child Phone',  val:student.phone       },
                  { icon:User,     label:'Parent Name',  val:student.parentName  },
                  { icon:Phone,    label:'Parent Phone', val:student.parentPhone },
                  { icon:Mail,     label:'Email',        val:student.email       },
                  { icon:BookOpen, label:'Class/Std',    val:student.classStd    },
                  { icon:MapPin,   label:'Location',     val:student.location    },
                  { icon:User,     label:'Staff',        val:student.staffAssigned},
                  { icon:Calendar, label:'Joined',       val:student.joinDate    },
                  { icon:Calendar, label:'Education',    val:student.education   },
                ].filter(r => r.val).map(row => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label}>
                      <div style={{ color:'#9CA3AF', fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{row.label}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:5, color:'#1A1A2E' }}>
                        <Icon size={12} style={{ color:'#9CA3AF' }}/> {row.val}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subscription */}
              {sub && (
                <div style={{
                  marginTop:14, padding:'10px 14px', borderRadius:8,
                  background: sub.expired?'#FEE2E2':sub.expiringSoon?'#FEF3C7':'#F0FDF4',
                  border:`1px solid ${sub.expired?'#FECACA':sub.expiringSoon?'#FDE68A':'#BBF7D0'}`,
                  fontSize:13,
                }}>
                  <div style={{ fontWeight:600, marginBottom:3, color: sub.expired?'#991B1B':sub.expiringSoon?'#92400E':'#065F46' }}>
                    📅 Subscription {sub.expired?'EXPIRED':sub.expiringSoon?'Expiring Soon':'Active'}
                  </div>
                  <div style={{ fontSize:12, color:'#6B7280' }}>
                    {student.courseDurationMonths}mo course · Joined {student.joinDate} · Expires {sub.exp.toLocaleDateString('en-IN')} · {sub.expired?`Expired ${Math.abs(sub.days)} days ago`:`${sub.days} days left`}
                  </div>
                </div>
              )}

              {student.notes && (
                <div style={{ marginTop:12, padding:'10px 14px', background:'#FFFBEB', borderRadius:8, fontSize:13, color:'#92400E' }}>
                  📝 {student.notes}
                </div>
              )}
            </div>

            {/* Weak subjects */}
            <div className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <h3 style={{ fontSize:14, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                  <AlertTriangle size={15} style={{ color:'#EF4444' }}/> Weak Subjects
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setWeakModal(true)}>
                  <Edit size={13}/> Edit
                </button>
              </div>
              {(!student.weakSubjects || student.weakSubjects.length === 0) ? (
                <div style={{ fontSize:13, color:'#9CA3AF' }}>
                  No weak subjects marked.
                  <span style={{ color:'#E53935', cursor:'pointer', marginLeft:6 }} onClick={() => setWeakModal(true)}>Add now →</span>
                </div>
              ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {student.weakSubjects.map(s => (
                    <span key={s} style={{ padding:'5px 12px', borderRadius:20, background:'#FEE2E2', color:'#991B1B', fontSize:12, fontWeight:600 }}>
                      ⚠️ {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right — quick stats + latest activity */}
          <div>
            {/* Course flow progress card */}
            <div className="card" style={{ marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <h3 style={{ fontSize:14, fontWeight:600 }}>Course Flow Progress</h3>
                <span style={{ fontSize:13, fontWeight:700, color:'#E53935' }}>{flowDone}/{flowTotal}</span>
              </div>
              <div className="progress-bar" style={{ height:8, marginBottom:10 }}>
                <div className="progress-fill" style={{ width:`${Math.round(flowDone/flowTotal*100)}%`, background:'#E53935' }}/>
              </div>
              <div style={{ fontSize:12, color:'#6B7280' }}>
                {COURSE_FLOW.filter(s => !flowStep(s.key)?.done).slice(0,3).map(s => (
                  <div key={s.key} style={{ marginBottom:3 }}>⏳ {s.label}</div>
                ))}
                <span style={{ color:'#E53935', cursor:'pointer' }} onClick={() => setActiveTab('courseflow')}>
                  View all steps →
                </span>
              </div>
            </div>

            {/* Assessment summary */}
            {assessments.length > 0 && (
              <div className="card" style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <h3 style={{ fontSize:14, fontWeight:600 }}>Assessment Progress</h3>
                  {trend !== null && (
                    <span style={{ fontSize:12, fontWeight:600, color: trend>0?'#10B981':'#EF4444', display:'flex', alignItems:'center', gap:3 }}>
                      {trend>0?<TrendingUp size={13}/>:trend<0?<TrendingDown size={13}/>:<Minus size={13}/>}
                      {trend>0?'+':''}{trend}%
                    </span>
                  )}
                </div>
                {assessments.map((a, i) => (
                  <div key={a.id} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                      <span>{a.testName} {a.subject && `(${a.subject})`}</span>
                      <span style={{ fontWeight:700, color:a.percentage>=60?'#10B981':a.percentage>=40?'#F59E0B':'#EF4444' }}>{a.percentage}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width:`${a.percentage}%`, background:a.percentage>=60?'#10B981':a.percentage>=40?'#F59E0B':'#EF4444' }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent follow-ups */}
            <div className="card">
              <h3 style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>Recent Follow-Ups</h3>
              {followups.slice(0,3).map(f => (
                <div key={f.id} style={{ padding:'8px 0', borderBottom:'1px solid #F3F4F6' }}>
                  <div style={{ fontSize:12, color:'#9CA3AF', marginBottom:2 }}>{fmt(f.createdAt)} · {f.addedBy}</div>
                  <div style={{ fontSize:13 }}>{f.note}</div>
                </div>
              ))}
              {followups.length === 0 && <div style={{ fontSize:13, color:'#9CA3AF' }}>No follow-ups yet.</div>}
              <span style={{ fontSize:12, color:'#E53935', cursor:'pointer', marginTop:6, display:'block' }} onClick={() => setActiveTab('followups')}>
                {followups.length > 3 && `View all ${followups.length} →`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══ COURSE FLOW TAB ══ */}
      {activeTab === 'courseflow' && (
        <div>
          <div style={{ padding:'10px 14px', background:'#EFF6FF', borderRadius:8, fontSize:12, color:'#1E40AF', marginBottom:16 }}>
            Track each step of the student's journey from admission to course completion. Click ✓ to mark a step done, add a note for context.
          </div>

          {/* Progress summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:20 }}>
            {[
              { label:'Completed',  value:flowDone,          color:'#10B981', bg:'#D1FAE5' },
              { label:'Pending',    value:flowTotal-flowDone, color:'#F59E0B', bg:'#FEF3C7' },
              { label:'Progress',   value:`${Math.round(flowDone/flowTotal*100)}%`, color:'#E53935', bg:'#FEE2E2' },
            ].map(c => (
              <div key={c.label} style={{ background:'#fff', borderRadius:10, border:'1px solid #E5E7EB', padding:'12px 16px', textAlign:'center' }}>
                <div style={{ fontSize:24, fontWeight:700, color:c.color }}>{c.value}</div>
                <div style={{ fontSize:11, color:'#6B7280' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Phases */}
          {Object.entries(PHASE_LABELS).map(([phase, phaseInfo]) => {
            const steps    = COURSE_FLOW.filter(s => s.phase === phase);
            const doneHere = steps.filter(s => flowStep(s.key)?.done).length;
            const expanded = flowExpanded[phase];
            return (
              <div key={phase} className="card" style={{ marginBottom:12 }}>
                <div
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}
                  onClick={() => setFlowExpanded(prev => ({ ...prev, [phase]: !prev[phase] }))}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ padding:'4px 12px', borderRadius:20, background:phaseInfo.bg, color:phaseInfo.color, fontSize:12, fontWeight:600 }}>
                      {phaseInfo.label}
                    </span>
                    <span style={{ fontSize:13, color:'#6B7280' }}>{doneHere}/{steps.length} done</span>
                  </div>
                  {expanded ? <ChevronUp size={16} style={{ color:'#6B7280' }}/> : <ChevronDown size={16} style={{ color:'#6B7280' }}/>}
                </div>

                {/* Mini progress bar */}
                <div className="progress-bar" style={{ marginTop:10, marginBottom: expanded?14:0 }}>
                  <div className="progress-fill" style={{ width:`${Math.round(doneHere/steps.length*100)}%`, background:phaseInfo.color }}/>
                </div>

                {expanded && steps.map(step => {
                  const fs = flowStep(step.key);
                  return (
                    <div key={step.key} style={{
                      display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0',
                      borderBottom:'1px solid #F9FAFB',
                    }}>
                      <button
                        onClick={() => handleMarkFlow(step, !fs?.done)}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:0, marginTop:1, flexShrink:0 }}
                      >
                        {fs?.done
                          ? <CheckCircle size={20} style={{ color:'#10B981' }}/>
                          : <Circle      size={20} style={{ color:'#D1D5DB' }}/>
                        }
                      </button>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight: fs?.done?500:400, color: fs?.done?'#1A1A2E':'#6B7280', textDecoration: fs?.done?'none':'none' }}>
                          {step.label}
                        </div>
                        {fs?.done && (
                          <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>
                            ✅ Done {fs.date && `on ${fs.date}`}{fs.note && ` — ${fs.note}`}
                          </div>
                        )}
                      </div>
                      {!fs?.done && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => handleMarkFlow(step, true)}>
                          Mark Done
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ ASSESSMENTS TAB ══ */}
      {activeTab === 'assessments' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
            <button className="btn btn-primary" onClick={() => setAssessModal(true)}>
              <Plus size={14}/> Add Assessment
            </button>
          </div>
          {assessments.length === 0 && (
            <div className="card" style={{ textAlign:'center', color:'#6B7280', padding:40 }}>
              No assessments yet.
            </div>
          )}
          <div className="table-container">
            <table>
              <thead><tr><th>#</th><th>Test Name</th><th>Subject</th><th>Date</th><th>Score</th><th>Percentage</th></tr></thead>
              <tbody>
                {assessments.map((a, i) => (
                  <tr key={a.id}>
                    <td style={{ color:'#9CA3AF' }}>{i+1}</td>
                    <td style={{ fontWeight:500 }}>{a.testName}</td>
                    <td>{a.subject||'—'}</td>
                    <td style={{ fontSize:12, color:'#6B7280' }}>{a.date||'—'}</td>
                    <td>{a.marks}/{a.totalMarks}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="progress-bar" style={{ width:80 }}>
                          <div className="progress-fill" style={{ width:`${a.percentage}%`, background:a.percentage>=60?'#10B981':a.percentage>=40?'#F59E0B':'#EF4444' }}/>
                        </div>
                        <span style={{ fontSize:13, fontWeight:600, color:a.percentage>=60?'#10B981':a.percentage>=40?'#F59E0B':'#EF4444' }}>{a.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Subject-wise breakdown */}
          {assessments.length > 0 && (
            <div className="card" style={{ marginTop:14 }}>
              <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Subject-wise Average</h3>
              {(() => {
                const bySubject = {};
                assessments.forEach(a => {
                  const sub = a.subject || 'General';
                  if (!bySubject[sub]) bySubject[sub] = [];
                  bySubject[sub].push(a.percentage);
                });
                return Object.entries(bySubject).map(([sub, pcts]) => {
                  const avg = Math.round(pcts.reduce((a,b)=>a+b,0)/pcts.length);
                  const isWeak = student.weakSubjects?.includes(sub);
                  return (
                    <div key={sub} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, alignItems:'center' }}>
                        <span style={{ fontSize:13, fontWeight:500 }}>
                          {sub}
                          {isWeak && <span style={{ marginLeft:6, fontSize:10, padding:'1px 7px', borderRadius:10, background:'#FEE2E2', color:'#991B1B', fontWeight:600 }}>Weak</span>}
                        </span>
                        <span style={{ fontSize:13, fontWeight:700, color:avg>=60?'#10B981':avg>=40?'#F59E0B':'#EF4444' }}>{avg}% avg</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width:`${avg}%`, background:avg>=60?'#10B981':avg>=40?'#F59E0B':'#EF4444' }}/>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* ══ FOLLOW-UPS TAB ══ */}
      {activeTab === 'followups' && (
        <div className="grid-2" style={{ alignItems:'start' }}>
          {/* Timeline */}
          <div className="card">
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Follow-Up History ({followups.length})</h3>
            <div style={{ maxHeight:440, overflowY:'auto', marginBottom:16 }}>
              {followups.length === 0 && <p style={{ color:'#6B7280', fontSize:13 }}>No follow-ups yet.</p>}
              {followups.map((f, i) => (
                <div key={f.id} style={{ display:'flex', gap:10, marginBottom:14 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:'#E53935', flexShrink:0, marginTop:4 }}/>
                    {i < followups.length-1 && <div style={{ width:1, flex:1, background:'#E5E7EB', margin:'4px 0' }}/>}
                  </div>
                  <div style={{ flex:1, paddingBottom:4 }}>
                    <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:3 }}>{fmt(f.createdAt)} · {f.addedBy}</div>
                    <div style={{ fontSize:13 }}>{f.note}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Add note */}
            <div style={{ borderTop:'1px solid #E5E7EB', paddingTop:14 }}>
              <label className="form-label" style={{ marginBottom:6, display:'block' }}>Add Follow-Up Note</label>
              <textarea className="form-input" rows={2} placeholder="Called student, visited, parent contacted..."
                value={newNote} onChange={e => setNewNote(e.target.value)}/>
              <button className="btn btn-primary" style={{ marginTop:8, width:'100%' }}
                onClick={handleSaveNote} disabled={savingNote || !newNote.trim()}>
                {savingNote ? 'Saving...' : <><Plus size={13}/> Save Note</>}
              </button>
            </div>
          </div>
          {/* Weak subjects reminder */}
          <div className="card">
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>
              <AlertTriangle size={14} style={{ color:'#EF4444', marginRight:6 }}/>
              Areas Needing Attention
            </h3>
            {student.weakSubjects?.length > 0 ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
                {student.weakSubjects.map(s => (
                  <span key={s} style={{ padding:'6px 14px', borderRadius:20, background:'#FEE2E2', color:'#991B1B', fontSize:13, fontWeight:600 }}>⚠️ {s}</span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize:13, color:'#9CA3AF', marginBottom:14 }}>No weak subjects marked.</p>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setWeakModal(true)}>
              <Edit size={13} /> Update Weak Subjects
            </button>
          </div>
        </div>
      )}

      {/* ══ MODALS ══ */}

      {/* Edit student */}
      {editModal && (
        <Modal title="Edit Student Profile" onClose={() => setEditModal(false)} wide>
          <form onSubmit={handleEdit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <FormRow>
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={editForm.name||''} onChange={e=>setEditForm({...editForm,name:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={editForm.phone||''} onChange={e=>setEditForm({...editForm,phone:e.target.value})}/></div>
            </FormRow>
            <FormRow>
              <div className="form-group"><label className="form-label">Parent Name</label><input className="form-input" value={editForm.parentName||''} onChange={e=>setEditForm({...editForm,parentName:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Parent Phone</label><input className="form-input" value={editForm.parentPhone||''} onChange={e=>setEditForm({...editForm,parentPhone:e.target.value})}/></div>
            </FormRow>
            <FormRow>
              <div className="form-group"><label className="form-label">Class / Std</label><input className="form-input" value={editForm.classStd||''} onChange={e=>setEditForm({...editForm,classStd:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Status</label>
                <select className="form-input" value={editForm.status||'active'} onChange={e=>setEditForm({...editForm,status:e.target.value})}>
                  {['active','moderate','at-risk','dropped'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group"><label className="form-label">Join Date</label><input className="form-input" type="date" value={editForm.joinDate||''} onChange={e=>setEditForm({...editForm,joinDate:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Course Duration (months)</label><input className="form-input" type="number" value={editForm.courseDurationMonths||''} onChange={e=>setEditForm({...editForm,courseDurationMonths:e.target.value})}/></div>
            </FormRow>
            <FormRow>
              <div className="form-group"><label className="form-label">Staff Assigned</label>
                <select className="form-input" value={editForm.staffAssigned||''} onChange={e=>setEditForm({...editForm,staffAssigned:e.target.value})}>
                  <option value="">Select</option>{staffList.map(s=><option key={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">ClassPlus ID</label><input className="form-input" value={editForm.classplusId||''} onChange={e=>setEditForm({...editForm,classplusId:e.target.value})}/></div>
            </FormRow>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={editForm.notes||''} onChange={e=>setEditForm({...editForm,notes:e.target.value})}/></div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={savingEdit}>{savingEdit?'Saving...':'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add assessment */}
      {assessModal && (
        <Modal title="Add Assessment Result" onClose={() => setAssessModal(false)}>
          <form onSubmit={handleAddAssessment} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="form-group"><label className="form-label">Test Name *</label><input className="form-input" required value={assessForm.testName} onChange={e=>setAssessForm({...assessForm,testName:e.target.value})}/></div>
            <FormRow>
              <div className="form-group"><label className="form-label">Subject</label>
                <select className="form-input" value={assessForm.subject} onChange={e=>setAssessForm({...assessForm,subject:e.target.value})}>
                  <option value="">Select</option>{ALL_SUBJECTS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={assessForm.date} onChange={e=>setAssessForm({...assessForm,date:e.target.value})}/></div>
            </FormRow>
            <FormRow>
              <div className="form-group"><label className="form-label">Marks Scored *</label><input className="form-input" type="number" required value={assessForm.marks} onChange={e=>setAssessForm({...assessForm,marks:e.target.value})}/></div>
              <div className="form-group"><label className="form-label">Total Marks *</label><input className="form-input" type="number" required value={assessForm.totalMarks} onChange={e=>setAssessForm({...assessForm,totalMarks:e.target.value})}/></div>
            </FormRow>
            {assessForm.marks && assessForm.totalMarks && (
              <div style={{ padding:'8px 12px', background:'#F0FDF4', borderRadius:8, fontSize:13, color:'#065F46' }}>
                Percentage: <strong>{Math.round(Number(assessForm.marks)/Number(assessForm.totalMarks)*100)}%</strong>
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setAssessModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Result</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Weak subjects */}
      {weakModal && (
        <Modal title="Manage Weak Subjects" onClose={() => setWeakModal(false)}>
          <div style={{ marginBottom:14, fontSize:13, color:'#6B7280' }}>
            Select subjects this student is struggling with. This helps faculty prioritise attention.
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
            {ALL_SUBJECTS.map(sub => (
              <div key={sub} onClick={() => toggleWeak(sub)} style={{
                padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', fontWeight:500,
                background: weakSubjects.includes(sub)?'#FEE2E2':'var(--bg)',
                color:      weakSubjects.includes(sub)?'#991B1B':'var(--muted)',
                border:     `1px solid ${weakSubjects.includes(sub)?'#FECACA':'var(--border)'}`,
                transition:'all .15s',
              }}>
                {weakSubjects.includes(sub)?'⚠️ ':''}{sub}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setWeakModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveWeak} disabled={savingWeak}>
              {savingWeak?'Saving...':'Save'}
            </button>
          </div>
        </Modal>
      )}

      {/* Course flow note */}
      {flowNoteModal && (
        <Modal title={`Mark Complete: ${flowNoteModal.label}`} onClose={() => { setFlowNoteModal(null); setFlowNote(''); }}>
          <div className="form-group" style={{ marginBottom:14 }}>
            <label className="form-label">Add a note (optional)</label>
            <textarea className="form-input" rows={3} placeholder="Any observations or remarks about this step..."
              value={flowNote} onChange={e => setFlowNote(e.target.value)}/>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => { setFlowNoteModal(null); setFlowNote(''); }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveFlowNote} disabled={savingFlow}>
              {savingFlow?'Saving...':'Mark Complete ✓'}
            </button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  );
}