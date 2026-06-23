import { useEffect, useState, useRef } from 'react';
import {
  getBatches, getStaffBatches, getBatchSchedules, addBatchSchedule,
  deleteBatchSchedule, updateScheduleStatus, saveAttendance,
  getSessionAttendance, getBatchStudents, getStaffProfiles,
} from '../firebase/services';
import { Modal, Toast, Loading } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Calendar, ChevronLeft, ChevronRight, Users, Download,
  CheckCircle, XCircle, Clock, AlertTriangle, Trash2, X, Search,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────
const ACCENTS = ['#E81620','#F4683B','#F5A623','#16A974','#11B4C6','#3B6EF6','#6366F1','#8B5CF6','#EC4899','#6E7488'];
function avatarColor(name = '') { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ACCENTS[h % ACCENTS.length]; }
function initials(name = '') { const p = name.trim().split(/\s+/); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'; }

function getWeekDates(anchor) {
  const d = new Date(anchor);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return x; });
}

function getMonthDates(anchor) {
  const year = anchor.getFullYear(), month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, month, 1 - (startOffset - i));
    cells.push({ date: d, inMonth: false });
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) cells.push({ date: new Date(year, month, i), inMonth: true });
  while (cells.length % 7 !== 0) {
    const d = new Date(year, month + 1, cells.length - daysInMonth - startOffset + 1);
    cells.push({ date: d, inMonth: false });
  }
  return cells;
}

function getSlotsForDate(date, schedules) {
  const dateStr = date.toISOString().slice(0, 10);
  const dayName = date.toLocaleDateString('default', { weekday: 'long' });
  return schedules.filter(s => {
    if (s.scheduledDate) return s.scheduledDate === dateStr;
    return s.day === dayName;
  });
}

const TYPE_COLORS = {
  'live-class':  { bg:'var(--blue-soft)',   col:'var(--blue-ink)',   label:'Live Class' },
  'recorded':    { bg:'var(--violet-soft)', col:'var(--violet-ink)', label:'Recorded' },
  'assessment':  { bg:'var(--red-soft)',    col:'var(--red-ink)',    label:'Assessment' },
  'doubt':       { bg:'var(--amber-soft)',  col:'var(--amber-ink)',  label:'Doubt Session' },
  'revision':    { bg:'var(--teal-soft)',   col:'var(--teal-ink)',   label:'Revision' },
  'other':       { bg:'var(--surface-sunken)', col:'var(--text-muted)', label:'Other' },
};
const typeColor = (t) => TYPE_COLORS[t] || TYPE_COLORS.other;

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ── Component ───────────────────────────────────────────────────
export default function Schedule() {
  const { profile } = useAuth();
  const isCEO = profile?.role === 'ceo' || profile?.role === 'admin';

  const [batches,       setBatches]       = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [batchData,     setBatchData]     = useState(null);
  const [schedules,     setSchedules]     = useState([]);
  const [batchStudents, setBatchStudents] = useState([]);
  const [staffList,     setStaffList]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [toast,         setToast]         = useState(null);
  const [saving,        setSaving]        = useState(false);

  // Calendar
  const [view,          setView]          = useState('week'); // 'week' | 'month'
  const [calDate,       setCalDate]       = useState(new Date());
  const [slotDetail,    setSlotDetail]    = useState(null);
  const [activeTab,     setActiveTab]     = useState('calendar'); // 'calendar' | 'attendance'

  // Add class modal
  const [showAdd,       setShowAdd]       = useState(false);
  const [form,          setForm]          = useState(blankForm());

  // Attendance modal
  const [attSession,    setAttSession]    = useState(null);
  const [attData,       setAttData]       = useState({}); // studentId → { present: bool }
  const [attSearch,     setAttSearch]     = useState('');
  const [savedAtt,      setSavedAtt]      = useState({});  // sessionId → true
  const [attLoading,    setAttLoading]    = useState(false);

  // Attendance report (tab)
  const [attReport,     setAttReport]     = useState([]); // array of { session, attendance }
  const [reportLoading, setReportLoading] = useState(false);

  function blankForm() {
    return { title: '', day: 'Monday', scheduledDate: '', recurring: false, time: '', duration: '60', type: 'live-class', facultyName: '', meetLink: '', notes: '', participantType: 'all', participantIds: [] };
  }

  // ── Load batches ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [bList, sList] = await Promise.all([
        isCEO ? getBatches() : getStaffBatches(profile?.uid),
        getStaffProfiles(),
      ]);
      setBatches(bList);
      setStaffList(sList);
      setLoading(false);
    };
    load();
  }, []);  // eslint-disable-line

  // ── Load schedules for selected batch ─────────────────────────
  useEffect(() => {
    if (!selectedBatch) { setSchedules([]); setBatchStudents([]); setBatchData(null); return; }
    const load = async () => {
      const bd = batches.find(b => b.id === selectedBatch);
      setBatchData(bd);
      const [sch, stu] = await Promise.all([
        getBatchSchedules(selectedBatch),
        getBatchStudents(selectedBatch),
      ]);
      setSchedules(sch);
      setBatchStudents(stu.students || []);
    };
    load();
  }, [selectedBatch, batches]);

  // ── Load attendance report for all sessions ───────────────────
  const loadAttReport = async () => {
    if (!selectedBatch) return;
    setReportLoading(true);
    const sessionsWithDates = schedules.filter(s => s.scheduledDate || s.status === 'completed');
    const results = await Promise.all(
      sessionsWithDates.map(async s => {
        try {
          const att = await getSessionAttendance(s.id);
          return { session: s, attendance: att[0] || null };
        } catch { return { session: s, attendance: null }; }
      })
    );
    setAttReport(results);
    setReportLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'attendance' && selectedBatch) loadAttReport();
  }, [activeTab, selectedBatch]); // eslint-disable-line

  // ── Add class ─────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setSaving(true);
    try {
      await addBatchSchedule({
        ...form,
        batchId: selectedBatch,
        batchName: batchData?.name || '',
        participantStudents: form.participantType === 'all'
          ? batchStudents.map(s => ({ id: s.id, name: s.name }))
          : batchStudents.filter(s => form.participantIds.includes(s.id)).map(s => ({ id: s.id, name: s.name })),
      });
      setToast({ message: 'Class added!', type: 'success' });
      setShowAdd(false);
      setForm(blankForm());
      const sch = await getBatchSchedules(selectedBatch);
      setSchedules(sch);
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  // ── Attendance modal ──────────────────────────────────────────
  const openAttendance = async (slot) => {
    setAttSession(slot);
    setAttSearch('');
    setAttLoading(true);
    try {
      const existing = await getSessionAttendance(slot.id);
      const rec = existing[0];
      if (rec?.attendance) {
        setAttData(rec.attendance);
      } else {
        const participants = slot.participantStudents?.length
          ? slot.participantStudents
          : batchStudents;
        const blank = {};
        participants.forEach(s => { blank[s.id] = { name: s.name, present: false }; });
        setAttData(blank);
      }
    } catch {
      const participants = slot.participantStudents?.length ? slot.participantStudents : batchStudents;
      const blank = {};
      participants.forEach(s => { blank[s.id] = { name: s.name, present: false }; });
      setAttData(blank);
    }
    setAttLoading(false);
  };

  const handleSaveAttendance = async () => {
    if (!attSession) return;
    setSaving(true);
    try {
      await saveAttendance(attSession.id, selectedBatch, attData);
      setSavedAtt(prev => ({ ...prev, [attSession.id]: true }));
      setToast({ message: 'Attendance saved!', type: 'success' });
      setAttSession(null);
      if (activeTab === 'attendance') loadAttReport();
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setSaving(false);
  };

  // ── Bulk export attendance ─────────────────────────────────────
  const exportAttendance = async () => {
    if (!selectedBatch) return;
    const rows = [['Session', 'Date/Day', 'Student', 'Present', 'Batch']];
    for (const { session, attendance } of attReport) {
      if (attendance?.attendance) {
        Object.entries(attendance.attendance).forEach(([, v]) => {
          rows.push([
            session.title,
            session.scheduledDate || session.day,
            v.name,
            v.present ? 'Yes' : 'No',
            batchData?.name || '',
          ]);
        });
      }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `attendance-${batchData?.name || selectedBatch}.csv`;
    a.click();
  };

  // ── Calendar helpers ───────────────────────────────────────────
  const weekDates = getWeekDates(calDate);
  const monthCells = getMonthDates(calDate);
  const today = new Date(); today.setHours(0,0,0,0);
  const monthLabel = calDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const weekLabel = `${weekDates[0].toLocaleDateString('default',{month:'short',day:'numeric'})} – ${weekDates[6].toLocaleDateString('default',{month:'short',day:'numeric',year:'numeric'})}`;

  const navPrev = () => {
    const d = new Date(calDate);
    if (view === 'week') d.setDate(d.getDate() - 7); else d.setMonth(d.getMonth() - 1);
    setCalDate(d);
  };
  const navNext = () => {
    const d = new Date(calDate);
    if (view === 'week') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
    setCalDate(d);
  };

  const SlotPill = ({ slot, compact }) => {
    const pc = typeColor(slot.type);
    return (
      <div
        onClick={() => { setSlotDetail(slot); if (!attSession) openAttendance(slot); }}
        style={{
          padding: compact ? '2px 5px' : '4px 8px',
          borderRadius: 5, marginBottom: 2, cursor: 'pointer',
          background: pc.bg, color: pc.col,
          fontSize: compact ? 10 : 11, fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          border: `1px solid ${pc.col}30`,
        }}
        title={slot.title}
      >
        {slot.time && `${slot.time} `}{slot.title}
        {slot.participantType === 'specific' && ' (selected)'}
      </div>
    );
  };

  if (loading) return <Loading />;

  const attParticipants = attSession
    ? (attSession.participantStudents?.length ? attSession.participantStudents : batchStudents)
    : [];
  const filteredParticipants = attParticipants.filter(s =>
    !attSearch || s.name?.toLowerCase().includes(attSearch.toLowerCase())
  );
  const presentCount = Object.values(attData).filter(v => v.present).length;
  const absentCount = Object.values(attData).filter(v => !v.present).length;

  return (
    <div>
      {/* ── Page Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:18 }}>
        <div>
          <h2 style={{ fontSize:24, fontWeight:700 }}>Schedule</h2>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>
            {isCEO ? 'View and manage class schedules across all batches.' : 'Your batch schedules and attendance.'}
          </div>
        </div>
        {selectedBatch && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16}/> Add Class
          </button>
        )}
      </div>

      {/* ── Batch Selector (mandatory) ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, padding:'14px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12 }}>
        <Calendar size={18} style={{ color:'var(--brand)', flexShrink:0 }}/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Select Batch</div>
          <select
            className="form-input"
            style={{ maxWidth:380 }}
            value={selectedBatch}
            onChange={e => setSelectedBatch(e.target.value)}
          >
            <option value="">— Choose a batch to view schedule —</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {batchData && (
          <div style={{ display:'flex', gap:12 }}>
            {[
              { label:'Classes', value:schedules.length, color:'var(--blue-ink)', bg:'var(--blue-soft)' },
              { label:'Students', value:batchStudents.length, color:'var(--green-ink)', bg:'var(--green-soft)' },
            ].map(k => (
              <div key={k.label} style={{ padding:'8px 14px', borderRadius:10, background:k.bg, textAlign:'center', minWidth:72 }}>
                <div style={{ fontSize:20, fontWeight:700, color:k.color, fontFamily:'var(--font-display)' }}>{k.value}</div>
                <div style={{ fontSize:10, color:k.color, fontWeight:500 }}>{k.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!selectedBatch && (
        <div style={{ padding:'60px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:14, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14 }}>
          <Calendar size={36} style={{ color:'var(--border)', marginBottom:12 }}/>
          <div>Select a batch above to see the schedule</div>
          {batches.length === 0 && <div style={{ marginTop:8, fontSize:12 }}>No batches assigned to you yet.</div>}
        </div>
      )}

      {selectedBatch && (
        <>
          {/* ── Tab bar ── */}
          <div className="tab-bar" style={{ marginBottom:16 }}>
            {[
              { key:'calendar',   label:'Calendar View' },
              { key:'attendance', label:'Attendance Report' },
            ].map(t => (
              <div key={t.key} className={`tab ${activeTab===t.key?'active':''}`} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </div>
            ))}
          </div>

          {/* ── CALENDAR TAB ── */}
          {activeTab === 'calendar' && (
            <div>
              {/* Toolbar */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, flexWrap:'wrap' }}>
                <div className="segmented">
                  {['week','month'].map(v => (
                    <button key={v} className={view===v?'active':''} onClick={() => setView(v)}>
                      {v.charAt(0).toUpperCase()+v.slice(1)}
                    </button>
                  ))}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={navPrev}><ChevronLeft size={14}/></button>
                <span style={{ fontSize:13, fontWeight:600, minWidth:200, textAlign:'center' }}>
                  {view === 'week' ? weekLabel : monthLabel}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={navNext}><ChevronRight size={14}/></button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCalDate(new Date())}>Today</button>
              </div>

              {/* Week view */}
              {view === 'week' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
                  {weekDates.map((date, idx) => {
                    const isToday = date.toDateString() === today.toDateString();
                    const slots = getSlotsForDate(date, schedules);
                    return (
                      <div key={idx} style={{
                        background:'var(--surface)', borderRadius:10,
                        border:`2px solid ${isToday?'var(--brand)':'var(--border)'}`,
                        minHeight:130, padding:'10px 8px',
                        boxShadow: isToday ? '0 0 0 2px rgba(79,70,229,0.12)' : 'var(--shadow-xs)',
                      }}>
                        <div style={{ textAlign:'center', marginBottom:8 }}>
                          <div style={{ fontSize:11, color:isToday?'var(--brand)':'var(--text-muted)', fontWeight:600 }}>
                            {date.toLocaleDateString('default',{weekday:'short'})}
                          </div>
                          <div style={{
                            width:28, height:28, borderRadius:'50%', margin:'4px auto 0',
                            background:isToday?'var(--brand)':'transparent',
                            color:isToday?'#fff':'var(--text)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontWeight:700, fontSize:14,
                          }}>{date.getDate()}</div>
                        </div>
                        {slots.map(slot => <SlotPill key={slot.id} slot={slot} compact/>)}
                        {slots.length === 0 && <div style={{ fontSize:10, color:'var(--border)', textAlign:'center', marginTop:8 }}>—</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Month view */}
              {view === 'month' && (
                <div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, marginBottom:4 }}>
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                      <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-muted)', padding:'6px 0' }}>{d}</div>
                    ))}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
                    {monthCells.map(({ date, inMonth }, idx) => {
                      const isToday = date.toDateString() === today.toDateString();
                      const slots = inMonth ? getSlotsForDate(date, schedules) : [];
                      return (
                        <div key={idx} style={{
                          background:inMonth?'var(--surface)':'var(--surface-sunken)',
                          borderRadius:8, minHeight:80, padding:6,
                          border:`1px solid ${isToday?'var(--brand)':'var(--border)'}`,
                          opacity:inMonth?1:0.4,
                        }}>
                          <div style={{
                            width:22, height:22, borderRadius:'50%',
                            background:isToday?'var(--brand)':'transparent',
                            color:isToday?'#fff':inMonth?'var(--text)':'var(--text-muted)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontWeight:isToday?700:500, fontSize:12, marginBottom:4,
                          }}>{date.getDate()}</div>
                          {slots.slice(0,3).map(slot => <SlotPill key={slot.id} slot={slot} compact/>)}
                          {slots.length > 3 && <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:2 }}>+{slots.length-3} more</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {schedules.length === 0 && (
                <div className="card" style={{ textAlign:'center', color:'var(--text-muted)', padding:40, marginTop:16 }}>
                  <Calendar size={32} style={{ color:'var(--border)', marginBottom:8 }}/>
                  <div>No classes scheduled yet.</div>
                  <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => setShowAdd(true)}>
                    <Plus size={14}/> Add First Class
                  </button>
                </div>
              )}

              {/* Slot detail card (inline below calendar when slot is clicked) */}
              {slotDetail && (() => {
                const pc = typeColor(slotDetail.type);
                const participants = slotDetail.participantStudents?.length
                  ? slotDetail.participantStudents
                  : null;
                return (
                  <div className="card" style={{ marginTop:16, padding:'16px 20px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
                          <span style={{ padding:'2px 10px', borderRadius:10, background:pc.bg, color:pc.col, fontWeight:600, fontSize:11 }}>{pc.label}</span>
                          {slotDetail.status && (
                            <span className={`badge ${slotDetail.status==='completed'?'badge-green':slotDetail.status==='cancelled'?'badge-red':'badge-amber'}`}>{slotDetail.status}</span>
                          )}
                        </div>
                        <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:6 }}>{slotDetail.title}</div>
                        <div style={{ fontSize:13, color:'var(--text-sub)', display:'flex', flexDirection:'column', gap:3 }}>
                          <div><strong>When:</strong> {slotDetail.scheduledDate || slotDetail.day} {slotDetail.scheduledDate ? '(one-time)' : '(recurring)'} {slotDetail.time && `at ${slotDetail.time}`} · {slotDetail.duration} min</div>
                          {slotDetail.facultyName && <div><strong>Faculty:</strong> {slotDetail.facultyName}</div>}
                          {slotDetail.meetLink && <div><strong>Meet:</strong> <a href={slotDetail.meetLink} target="_blank" rel="noreferrer" style={{ color:'var(--brand)' }}>Join Link</a></div>}
                          {slotDetail.notes && <div style={{ fontStyle:'italic' }}>{slotDetail.notes}</div>}
                          <div>
                            <strong>Participants:</strong>{' '}
                            {participants
                              ? <><span className="badge badge-blue">{participants.length} students</span> (specific selection)</>
                              : <><span className="badge badge-green">All students</span> ({batchStudents.length} students)</>
                            }
                          </div>
                        </div>
                      </div>
                      <button onClick={() => setSlotDetail(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={16}/></button>
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => openAttendance(slotDetail)}>
                        <Users size={13}/> {savedAtt[slotDetail.id] ? 'Edit Attendance' : 'Mark Attendance'}
                      </button>
                      <select className="form-input" style={{ height:32, fontSize:12, flex:'0 0 auto' }}
                        value={slotDetail.status || ''}
                        onChange={async e => {
                          const ns = e.target.value; if (!ns) return;
                          await updateScheduleStatus(slotDetail.id, ns);
                          const sch = await getBatchSchedules(selectedBatch);
                          setSchedules(sch);
                          setSlotDetail({ ...slotDetail, status: ns });
                        }}>
                        <option value="">Update status…</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="rescheduled">Rescheduled</option>
                      </select>
                      <button className="btn btn-sm" style={{ background:'var(--red-soft)', color:'var(--red-ink)', border:'none' }}
                        onClick={async () => {
                          if (!window.confirm('Delete this class slot?')) return;
                          await deleteBatchSchedule(slotDetail.id);
                          const sch = await getBatchSchedules(selectedBatch);
                          setSchedules(sch);
                          setSlotDetail(null);
                        }}>
                        <Trash2 size={12}/> Delete
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── ATTENDANCE REPORT TAB ── */}
          {activeTab === 'attendance' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
                <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                  {reportLoading ? 'Loading report…' : `${attReport.length} sessions tracked`}
                </div>
                <button className="btn btn-secondary btn-sm" onClick={exportAttendance} disabled={attReport.length === 0}>
                  <Download size={13}/> Export CSV
                </button>
              </div>

              {reportLoading && <Loading/>}

              {!reportLoading && attReport.length === 0 && (
                <div className="card" style={{ textAlign:'center', padding:48, color:'var(--text-muted)' }}>
                  No attendance data found. Mark attendance on sessions from the Calendar tab.
                </div>
              )}

              {!reportLoading && attReport.map(({ session, attendance }) => {
                if (!attendance?.attendance) return null;
                const entries = Object.entries(attendance.attendance);
                const presentN = entries.filter(([, v]) => v.present).length;
                const absentN = entries.length - presentN;
                return (
                  <div key={session.id} className="card" style={{ padding:'14px 18px', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600 }}>{session.title}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                          {session.scheduledDate || session.day} {session.time && `· ${session.time}`} · {batchData?.name}
                        </div>
                      </div>
                      <span className="badge badge-green">{presentN} present</span>
                      <span className="badge badge-red">{absentN} absent</span>
                    </div>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {entries.map(([sid, v]) => (
                        <div key={sid} style={{
                          display:'flex', alignItems:'center', gap:5, padding:'4px 10px',
                          borderRadius:20, fontSize:11, fontWeight:500,
                          background: v.present ? 'var(--green-soft)' : 'var(--red-soft)',
                          color: v.present ? 'var(--green-ink)' : 'var(--red-ink)',
                        }}>
                          {v.present ? <CheckCircle size={11}/> : <XCircle size={11}/>}
                          {v.name}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          )}
        </>
      )}

      {/* ── Add Class Modal ── */}
      {showAdd && (
        <Modal title="Add Class to Schedule" onClose={() => { setShowAdd(false); setForm(blankForm()); }} wide>
          <form onSubmit={handleAdd} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group">
              <label className="form-label">Class Title *</label>
              <input className="form-input" required placeholder="e.g. Python Basics — Session 1"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPE_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Duration (minutes)</label>
                <input className="form-input" type="number" min="15" placeholder="60"
                  value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Recurrence</label>
              <div className="segmented">
                <button type="button" className={!form.recurring?'active':''} onClick={() => setForm({ ...form, recurring: false })}>One-time</button>
                <button type="button" className={form.recurring?'active':''} onClick={() => setForm({ ...form, recurring: true })}>Recurring (weekly)</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {form.recurring ? (
                <div className="form-group">
                  <label className="form-label">Day of Week *</label>
                  <select className="form-input" required value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>
                    {DAYS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input className="form-input" type="date" required value={form.scheduledDate}
                    onChange={e => setForm({ ...form, scheduledDate: e.target.value })}/>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Time *</label>
                <input className="form-input" type="time" required value={form.time}
                  onChange={e => setForm({ ...form, time: e.target.value })}/>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Faculty</label>
                <select className="form-input" value={form.facultyName} onChange={e => setForm({ ...form, facultyName: e.target.value })}>
                  <option value="">— Select faculty —</option>
                  {staffList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Meet Link (optional)</label>
                <input className="form-input" placeholder="https://meet.google.com/..." value={form.meetLink}
                  onChange={e => setForm({ ...form, meetLink: e.target.value })}/>
              </div>
            </div>

            {/* Participant selection */}
            <div className="form-group">
              <label className="form-label">Participants</label>
              <div className="segmented" style={{ marginBottom:10 }}>
                <button type="button" className={form.participantType==='all'?'active':''} onClick={() => setForm({ ...form, participantType:'all', participantIds:[] })}>
                  All {batchStudents.length} students
                </button>
                <button type="button" className={form.participantType==='specific'?'active':''} onClick={() => setForm({ ...form, participantType:'specific' })}>
                  Select specific students
                </button>
              </div>
              {form.participantType === 'specific' && (
                <div style={{ border:'1px solid var(--border)', borderRadius:8, padding:10, maxHeight:200, overflowY:'auto' }}>
                  {batchStudents.length === 0 && <div style={{ fontSize:12, color:'var(--text-muted)' }}>No students in batch.</div>}
                  {batchStudents.map(s => (
                    <label key={s.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', cursor:'pointer', fontSize:13 }}>
                      <input type="checkbox"
                        checked={form.participantIds.includes(s.id)}
                        onChange={e => setForm(prev => ({
                          ...prev,
                          participantIds: e.target.checked
                            ? [...prev.participantIds, s.id]
                            : prev.participantIds.filter(id => id !== s.id)
                        }))}
                      />
                      <div style={{ width:24, height:24, borderRadius:'50%', background:avatarColor(s.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials(s.name)}</div>
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
              {form.participantType === 'specific' && form.participantIds.length > 0 && (
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>
                  {form.participantIds.length} student{form.participantIds.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={2} placeholder="Any notes for this class…"
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowAdd(false); setForm(blankForm()); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add Class'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Attendance Marking Modal ── */}
      {attSession && (
        <Modal title={`Attendance — ${attSession.title}`} onClose={() => setAttSession(null)} wide>
          {attLoading ? <Loading/> : (
            <>
              <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
                <div style={{ position:'relative', flex:1, minWidth:180 }}>
                  <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                  <input className="form-input" style={{ paddingLeft:30 }} placeholder="Search student…"
                    value={attSearch} onChange={e => setAttSearch(e.target.value)}/>
                </div>
                <span className="badge badge-green"><CheckCircle size={11}/> {presentCount} present</span>
                <span className="badge badge-red"><XCircle size={11}/> {absentCount} absent</span>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const all = {};
                  attParticipants.forEach(s => { all[s.id] = { name: s.name, present: true }; });
                  setAttData(all);
                }}>Mark All Present</button>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:380, overflowY:'auto' }}>
                {filteredParticipants.map(s => {
                  const isPresent = attData[s.id]?.present;
                  return (
                    <div key={s.id}
                      onClick={() => setAttData(prev => ({ ...prev, [s.id]: { name: s.name, present: !prev[s.id]?.present } }))}
                      style={{
                        display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                        borderRadius:9, cursor:'pointer', transition:'background 0.12s',
                        background: isPresent ? 'var(--green-soft)' : 'var(--red-soft)',
                        border: `1px solid ${isPresent ? 'var(--green-soft)' : 'var(--red-soft)'}`,
                      }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:avatarColor(s.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>{initials(s.name)}</div>
                      <div style={{ flex:1, fontSize:13, fontWeight:500, color:'var(--text)' }}>{s.name}</div>
                      {isPresent
                        ? <CheckCircle size={18} style={{ color:'var(--green-ink)', flexShrink:0 }}/>
                        : <XCircle size={18} style={{ color:'var(--red-ink)', flexShrink:0 }}/>
                      }
                      <span style={{ fontSize:11, fontWeight:700, color: isPresent ? 'var(--green-ink)' : 'var(--red-ink)', minWidth:44 }}>
                        {isPresent ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
                <button className="btn btn-ghost" onClick={() => setAttSession(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving} onClick={handleSaveAttendance}>
                  {saving ? 'Saving…' : 'Save Attendance'}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)}/>}
    </div>
  );
}
