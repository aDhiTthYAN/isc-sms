import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy,
  serverTimestamp, setDoc, limit, startAfter,
  getCountFromServer
} from 'firebase/firestore';
import { db } from './config';

const PAGE_SIZE = 50;

// ── Students ───────────────────────────────────────────────────
export const studentsRef = () => collection(db, 'students');

export const getStudentCount = async () => {
  const snap = await getCountFromServer(collection(db, 'students'));
  return snap.data().count;
};

export const getStudentsPaged = async (filters = {}, lastDoc = null) => {
  let constraints = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE)];
  if (filters.batchId)       constraints = [where('batchId','==',filters.batchId), orderBy('createdAt','desc'), limit(PAGE_SIZE)];
  if (filters.status)        constraints = [where('status','==',filters.status), orderBy('createdAt','desc'), limit(PAGE_SIZE)];
  if (filters.staffAssigned) constraints = [where('staffAssigned','==',filters.staffAssigned), orderBy('createdAt','desc'), limit(PAGE_SIZE)];
  if (lastDoc) constraints.push(startAfter(lastDoc));
  const snap = await getDocs(query(studentsRef(), ...constraints));
  return {
    students: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc:  snap.docs[snap.docs.length - 1] || null,
    hasMore:  snap.docs.length === PAGE_SIZE,
  };
};

export const searchStudents = async (searchTerm) => {
  if (!searchTerm) return [];
  const snap = await getDocs(query(studentsRef(), orderBy('name'), limit(200)));
  const term = searchTerm.toLowerCase();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s =>
      s.name?.toLowerCase().includes(term) ||
      s.phone?.includes(term) ||
      s.classplusId?.toLowerCase().includes(term) ||
      s.email?.toLowerCase().includes(term) ||
      s.parentName?.toLowerCase().includes(term) ||
      s.parentPhone?.includes(term)
    );
};

export const getMyStudents = async (staffName, staffUid) => {
  if (!staffName && !staffUid) return [];
  try {
    if (staffUid) {
      const q = query(studentsRef(), where('staffId','==', staffUid), limit(100));
      const snap = await getDocs(q);
      if (snap.docs.length > 0) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.name||'').localeCompare(b.name||''));
      }
    }
    if (staffName) {
      const q = query(studentsRef(), where('staffAssigned','==', staffName), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (a.name||'').localeCompare(b.name||''));
    }
    return [];
  } catch {
    return [];
  }
};

export const getStudent = async (id) => {
  const snap = await getDoc(doc(db, 'students', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const addStudent = async (data) =>
  addDoc(studentsRef(), { ...data, createdAt: serverTimestamp() });

export const updateStudent = async (id, data) =>
  updateDoc(doc(db, 'students', id), { ...data, updatedAt: serverTimestamp() });

export const deleteStudent = async (id) => deleteDoc(doc(db, 'students', id));

export const bulkAddStudents = async (arr) => {
  const results = { success: 0, failed: 0, errors: [] };
  for (const s of arr) {
    try {
      await addDoc(studentsRef(), { ...s, createdAt: serverTimestamp() });
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push(`${s.name}: ${err.message}`);
    }
  }
  return results;
};

// ── Unassigned / self-assign ───────────────────────────────────
export const getUnassignedStudents = async (batchId) => {
  try {
    let q = batchId
      ? query(studentsRef(), where('batchId','==',batchId), where('staffAssigned','==',''), limit(100))
      : query(studentsRef(), where('staffAssigned','==',''), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(query(studentsRef(), limit(100)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.staffAssigned || s.staffAssigned === '');
  }
};

export const selfAssignStudents = async (staffName, studentIds) => {
  await Promise.all(studentIds.map(id =>
    updateDoc(doc(db, 'students', id), { staffAssigned: staffName })
  ));
};

// ── Weak subjects ──────────────────────────────────────────────
export const updateWeakSubjects = async (studentId, weakSubjects) =>
  updateDoc(doc(db, 'students', studentId), { weakSubjects, updatedAt: serverTimestamp() });

// ── Course flow tracking ───────────────────────────────────────
export const updateCourseFlowStep = async (studentId, stepKey, data) =>
  updateDoc(doc(db, 'students', studentId), {
    [`courseFlow.${stepKey}`]: { ...data, updatedAt: new Date().toISOString() }
  });

// ── Student activity ───────────────────────────────────────────
export const updateStudentActivity = async (id, data) =>
  updateDoc(doc(db, 'students', id), { ...data, lastActivityUpdate: serverTimestamp() });

// ── Alias for backward compat ──────────────────────────────────
export const getStudents = async () => {
  const result = await getStudentsPaged();
  return result.students;
};

// ── Follow-ups ─────────────────────────────────────────────────
export const getFollowUps = async (studentId) => {
  const q = query(collection(db,'followups'), where('studentId','==',studentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
};

export const getMyFollowUps = async (staffEmail) => {
  if (!staffEmail) return [];
  try {
    const q = query(collection(db,'followups'), where('assignedToEmail','==',staffEmail), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(f => !f.completed)
      .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  } catch {
    return [];
  }
};

export const getAllFollowUps = async () => {
  const snap = await getDocs(query(collection(db,'followups'), limit(100)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
};

export const addFollowUp = async (data) =>
  addDoc(collection(db,'followups'), { ...data, completed: false, createdAt: serverTimestamp() });

export const completeFollowUp = async (id, note) =>
  updateDoc(doc(db,'followups', id), { completed: true, completionNote: note, completedAt: serverTimestamp() });

// ── Batches ────────────────────────────────────────────────────
export const getBatches = async () => {
  const snap = await getDocs(collection(db,'batches'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
};

export const getBatch = async (id) => {
  const snap = await getDoc(doc(db,'batches', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getBatchStudents = async (batchId) => {
  const q = query(studentsRef(), where('batchId','==',batchId), limit(200));
  const snap = await getDocs(q);
  const students = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (a.name||'').localeCompare(b.name||''));
  return { students, lastDoc: snap.docs[snap.docs.length-1]||null, hasMore: false };
};

export const getBatchStudentCount = async (batchId) => {
  const snap = await getCountFromServer(query(studentsRef(), where('batchId','==',batchId)));
  return snap.data().count;
};

export const addBatch = async (data) =>
  addDoc(collection(db,'batches'), { ...data, createdAt: serverTimestamp() });

export const updateBatch = async (id, data) =>
  updateDoc(doc(db,'batches', id), data);

// ── Batch Schedules ────────────────────────────────────────────
export const getBatchSchedules = async (batchId) => {
  const q = query(collection(db,'schedules'), where('batchId','==',batchId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (a.day||'').localeCompare(b.day||'') || (a.time||'').localeCompare(b.time||''));
};

export const addBatchSchedule = async (data) =>
  addDoc(collection(db,'schedules'), { ...data, createdAt: serverTimestamp() });

export const updateBatchSchedule = async (id, data) =>
  updateDoc(doc(db,'schedules', id), data);

export const deleteBatchSchedule = async (id) =>
  deleteDoc(doc(db,'schedules', id));

// ── Batch Tasks ────────────────────────────────────────────────
export const getBatchTasks = async (batchId) => {
  const q = query(collection(db,'batchTasks'), where('batchId','==',batchId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
};

export const addBatchTask = async (data) =>
  addDoc(collection(db,'batchTasks'), { ...data, submittedBy: [], createdAt: serverTimestamp() });

export const markTaskSubmitted = async (taskId, studentId, studentName) => {
  const ref  = doc(db,'batchTasks', taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const current = snap.data().submittedBy || [];
  if (current.find(s => s.studentId === studentId)) return;
  await updateDoc(ref, {
    submittedBy: [...current, { studentId, studentName, submittedAt: new Date().toISOString() }]
  });
};

export const updateBatchTask = async (id, data) =>
  updateDoc(doc(db,'batchTasks', id), data);

// ── Assessments ────────────────────────────────────────────────
export const getAssessments = async (batchId) => {
  const q = batchId
    ? query(collection(db,'assessments'), where('batchId','==',batchId))
    : collection(db,'assessments');
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.date||'').localeCompare(a.date||''));
};

export const getAllAssessments = async () => {
  const snap = await getDocs(query(collection(db,'assessments'), limit(500)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getBatchAssessments = async (batchId, testName) => {
  const q = query(collection(db,'assessments'), where('batchId','==',batchId), where('testName','==',testName));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ id: d.id, rank: i + 1, ...d.data() }))
    .sort((a,b) => (b.percentage||0) - (a.percentage||0));
};

export const addAssessment = async (data) =>
  addDoc(collection(db,'assessments'), { ...data, createdAt: serverTimestamp() });

export const deleteAssessment = async (id) => deleteDoc(doc(db,'assessments',id));

export const getAssessmentResults = async (assessmentId) => {
  const q = query(collection(db,'assessmentResults'), where('assessmentId','==',assessmentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.percentage||0) - (a.percentage||0));
};

export const saveAssessmentResults = async (results) =>
  Promise.all(results.map(r => addDoc(collection(db,'assessmentResults'), { ...r, savedAt: serverTimestamp() })));

// ── Tasks ──────────────────────────────────────────────────────
export const getTasks = async () => {
  const q = query(collection(db,'tasks'), orderBy('createdAt','desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getMyTasks = async (staffEmail) => {
  if (!staffEmail) return [];
  try {
    const q = query(collection(db,'tasks'), where('assignedToEmail','==',staffEmail), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(t => t.status !== 'completed')
      .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
  } catch {
    return [];
  }
};

export const addTask = async (data) =>
  addDoc(collection(db,'tasks'), { ...data, status: 'pending', createdAt: serverTimestamp() });

export const updateTask = async (id, data) =>
  updateDoc(doc(db,'tasks', id), data);

// ── Notifications (in-app) ─────────────────────────────────────
export const addNotification = async (data) =>
  addDoc(collection(db,'notifications'), { ...data, read: false, createdAt: serverTimestamp() });

export const getMyNotifications = async (email) => {
  const q = query(collection(db,'notifications'), where('toEmail','==',email), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
};

export const markNotificationRead = async (id) =>
  updateDoc(doc(db,'notifications', id), { read: true });

export const saveFCMToken = async (userId, token) => {
  try {
    await updateDoc(doc(db, 'staff', userId), { fcmToken: token });
  } catch {}
};

export const sendPushNotification = async ({ toEmail, title, body }) => {
  // Fetch target staff's FCM token
  try {
    const snap = await getDocs(query(collection(db,'staff'), where('email','==',toEmail)));
    if (snap.empty) return;
    const staffDoc = snap.docs[0].data();
    const token = staffDoc.fcmToken;
    if (!token) return;

    const serverKey = import.meta.env.VITE_FCM_SERVER_KEY;
    if (!serverKey) {
      console.warn('FCM server key not set. Add VITE_FCM_SERVER_KEY to .env');
      return;
    }

    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`,
      },
      body: JSON.stringify({
        to: token,
        notification: { title, body },
        data: { click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      }),
    });
  } catch (err) {
    console.warn('Push notification failed:', err.message);
  }
};

// ── Daily Reports ──────────────────────────────────────────────
export const getDailyReports = async () => {
  const q = query(collection(db,'reports'), orderBy('createdAt','desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addReport = async (data) =>
  addDoc(collection(db,'reports'), { ...data, createdAt: serverTimestamp() });

// ── Concerns ──────────────────────────────────────────────────
export const getConcerns = async (filters = {}) => {
  let q = query(collection(db,'concerns'), orderBy('createdAt','desc'), limit(100));
  if (filters.batchId)    q = query(collection(db,'concerns'), where('batchId','==',filters.batchId), orderBy('createdAt','desc'));
  if (filters.assignedTo) q = query(collection(db,'concerns'), where('assignedTo','==',filters.assignedTo), orderBy('createdAt','desc'));
  if (filters.status)     q = query(collection(db,'concerns'), where('status','==',filters.status), orderBy('createdAt','desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addConcern = async (data) =>
  addDoc(collection(db,'concerns'), { ...data, status: 'open', createdAt: serverTimestamp() });

export const updateConcern = async (id, data) =>
  updateDoc(doc(db,'concerns', id), data);

// ── Leads ──────────────────────────────────────────────────────
export const getLeads = async () => {
  const q = query(collection(db,'leads'), orderBy('createdAt','desc'), limit(200));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addLead = async (data) =>
  addDoc(collection(db,'leads'), { ...data, stage: 'lead', createdAt: serverTimestamp() });

export const updateLead = async (id, data) =>
  updateDoc(doc(db,'leads', id), data);

// ── Staff profiles ─────────────────────────────────────────────
export const getStaffProfiles = async () => {
  const snap = await getDocs(collection(db,'staff'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const setStaffProfile = async (uid, data) =>
  setDoc(doc(db,'staff', uid), data, { merge: true });

export const getStaffProfile = async (uid) => {
  const snap = await getDoc(doc(db,'staff', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateStaffSubjects = async (staffId, subjects) =>
  updateDoc(doc(db,'staff', staffId), { subjects, updatedAt: serverTimestamp() });

export const getStaffBySubject = async (subject) => {
  const snap = await getDocs(collection(db,'staff'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.subjects?.includes(subject) && s.active !== false);
};
// ── Schedule status & Attendance ───────────────────────────────
export const updateScheduleStatus = async (scheduleId, status, note = '') =>
  updateDoc(doc(db,'schedules', scheduleId), { status, statusNote: note, statusUpdatedAt: new Date().toISOString() });

export const saveAttendance = async (scheduleId, batchId, attendanceData) =>
  addDoc(collection(db,'attendance'), {
    scheduleId, batchId,
    records: attendanceData,
    createdAt: serverTimestamp(),
  });

export const getSessionAttendance = async (scheduleId) => {
  const q = query(collection(db,'attendance'), where('scheduleId','==',scheduleId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Save attendance record (new signature for CSV upload modal)
export const saveAttendanceRecord = async (data) =>
  addDoc(collection(db,'attendance'), { ...data, savedAt: serverTimestamp() });

// Mark schedule status (update)
export const markScheduleStatus = async (scheduleId, status) =>
  updateDoc(doc(db,'schedules', scheduleId), { status, updatedAt: serverTimestamp() });

// ── Trash ──────────────────────────────────────────────────────
export const getTrashItems = async (type) => {
  const q = query(collection(db,'trash'), where('type','==',type));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.deletedAt?.seconds||0)-(a.deletedAt?.seconds||0));
};

export const restoreFromTrash = async (trashId, type, originalId, data) => {
  const colName = type === 'student' ? 'students' : 'batches';
  await setDoc(doc(db, colName, originalId), data);
  await deleteDoc(doc(db,'trash', trashId));
};

export const permanentDelete = async (trashId) => {
  await deleteDoc(doc(db,'trash', trashId));
};

// ── Staff Requests ─────────────────────────────────────────────
export const createRequest = async (data) => addDoc(collection(db,'requests'), { ...data, createdAt: serverTimestamp() });

export const getRequests = async (status) => {
  const q = status ? query(collection(db,'requests'), where('status','==',status)) : collection(db,'requests');
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
};

export const updateRequest = async (id, data) =>
  updateDoc(doc(db,'requests', id), data);

// ── Top-level Assessments (legacy aliases kept for compatibility) ──
export const getTopLevelAssessments = getAssessments;
export const addTopLevelAssessment = addAssessment;
export const updateTopLevelAssessment = async (id, data) =>
  updateDoc(doc(db,'assessments', id), data);
export const saveAssessmentResult = async (data) =>
  addDoc(collection(db,'assessmentResults'), { ...data, savedAt: serverTimestamp() });

// ── Batch staff (for assigned batches by staffIds) ─────────────
export const getStaffBatches = async (uid) => {
  try {
    const [byStaffIds, byMentor] = await Promise.all([
      getDocs(query(collection(db,'batches'), where('staffIds','array-contains', uid))),
      getDocs(query(collection(db,'batches'), where('mentorId','==', uid))),
    ]);
    const map = {};
    [...byStaffIds.docs, ...byMentor.docs].forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
    return Object.values(map).sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  } catch {
    return [];
  }
};
