import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, query, where, orderBy,
  serverTimestamp, setDoc, limit, startAfter,
  getCountFromServer
} from 'firebase/firestore';
import { db } from './config';

const PAGE_SIZE = 50; // Load 50 at a time for 10k scale

// ── Students (paginated for 10k scale) ────────────────────────
export const studentsRef = () => collection(db, 'students');

// Get total count without loading all docs
export const getStudentCount = async () => {
  const snap = await getCountFromServer(collection(db, 'students'));
  return snap.data().count;
};

// Paginated students - pass lastDoc for next page
export const getStudentsPaged = async (filters = {}, lastDoc = null) => {
  let q = query(studentsRef(), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  if (filters.batchId)  q = query(studentsRef(), where('batchId',  '==', filters.batchId),  orderBy('createdAt','desc'), limit(PAGE_SIZE));
  if (filters.status)   q = query(studentsRef(), where('status',   '==', filters.status),   orderBy('createdAt','desc'), limit(PAGE_SIZE));
  if (filters.staffAssigned) q = query(studentsRef(), where('staffAssigned','==', filters.staffAssigned), orderBy('createdAt','desc'), limit(PAGE_SIZE));
  if (lastDoc) q = query(q, startAfter(lastDoc));
  const snap = await getDocs(q);
  return {
    students: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
};

// Search by name (loads up to 200 matches)
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
      s.email?.toLowerCase().includes(term)
    );
};

// Get ALL students for staff (only their assigned ones)
export const getMyStudents = async (staffName) => {
  const q = query(studentsRef(), where('staffAssigned', '==', staffName), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getStudent = async (id) => {
  const snap = await getDoc(doc(db, 'students', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const addStudent = async (data) => {
  return addDoc(studentsRef(), { ...data, createdAt: serverTimestamp() });
};

export const updateStudent = async (id, data) => {
  return updateDoc(doc(db, 'students', id), { ...data, updatedAt: serverTimestamp() });
};

export const deleteStudent = async (id) => deleteDoc(doc(db, 'students', id));

// Bulk add students from CSV import
export const bulkAddStudents = async (studentsArray) => {
  const results = { success: 0, failed: 0, errors: [] };
  for (const student of studentsArray) {
    try {
      await addDoc(studentsRef(), { ...student, createdAt: serverTimestamp() });
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push(`${student.name}: ${err.message}`);
    }
  }
  return results;
};

// ── Follow-ups ─────────────────────────────────────────────────
export const getFollowUps = async (studentId) => {
  const q = query(
    collection(db, 'followups'),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Get follow-ups assigned to a specific staff member
export const getMyFollowUps = async (staffEmail) => {
  const q = query(
    collection(db, 'followups'),
    where('assignedToEmail', '==', staffEmail),
    where('completed', '==', false),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getAllFollowUps = async () => {
  const q = query(collection(db, 'followups'), orderBy('createdAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addFollowUp = async (data) => {
  return addDoc(collection(db, 'followups'), {
    ...data,
    completed: false,
    createdAt: serverTimestamp()
  });
};

export const completeFollowUp = async (id, note) => {
  return updateDoc(doc(db, 'followups', id), {
    completed: true,
    completionNote: note,
    completedAt: serverTimestamp()
  });
};

// ── Batches ────────────────────────────────────────────────────
export const getBatches = async () => {
  const snap = await getDocs(query(collection(db, 'batches'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getBatch = async (id) => {
  const snap = await getDoc(doc(db, 'batches', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Get students in a specific batch (paginated)
export const getBatchStudents = async (batchId, lastDoc = null) => {
  let q = query(
    studentsRef(),
    where('batchId', '==', batchId),
    orderBy('name'),
    limit(PAGE_SIZE)
  );
  if (lastDoc) q = query(q, startAfter(lastDoc));
  const snap = await getDocs(q);
  return {
    students: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
};

// Get count of students per batch
export const getBatchStudentCount = async (batchId) => {
  const q = query(studentsRef(), where('batchId', '==', batchId));
  const snap = await getCountFromServer(q);
  return snap.data().count;
};

export const addBatch = async (data) => {
  return addDoc(collection(db, 'batches'), { ...data, createdAt: serverTimestamp() });
};

export const updateBatch = async (id, data) => updateDoc(doc(db, 'batches', id), data);

// ── Assessments ────────────────────────────────────────────────
export const getAssessments = async (studentId) => {
  const q = query(
    collection(db, 'assessments'),
    where('studentId', '==', studentId),
    orderBy('date', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Get all assessments for a batch (for batch ranking)
export const getBatchAssessments = async (batchId, testName) => {
  const q = query(
    collection(db, 'assessments'),
    where('batchId', '==', batchId),
    where('testName', '==', testName),
    orderBy('percentage', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ id: d.id, rank: i + 1, ...d.data() }));
};

export const getAllAssessments = async () => {
  const snap = await getDocs(query(collection(db, 'assessments'), limit(500)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addAssessment = async (data) => {
  return addDoc(collection(db, 'assessments'), { ...data, createdAt: serverTimestamp() });
};

// ── Tasks ──────────────────────────────────────────────────────
export const getTasks = async () => {
  const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Get tasks assigned to a specific staff
export const getMyTasks = async (staffEmail) => {
  const q = query(
    collection(db, 'tasks'),
    where('assignedToEmail', '==', staffEmail),
    where('status', '!=', 'completed'),
    orderBy('status'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addTask = async (data) => {
  return addDoc(collection(db, 'tasks'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp()
  });
};

export const updateTask = async (id, data) => updateDoc(doc(db, 'tasks', id), data);

// ── Notifications (in-app) ─────────────────────────────────────
export const addNotification = async (data) => {
  return addDoc(collection(db, 'notifications'), {
    ...data,
    read: false,
    createdAt: serverTimestamp()
  });
};

export const getMyNotifications = async (staffEmail) => {
  const q = query(
    collection(db, 'notifications'),
    where('toEmail', '==', staffEmail),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const markNotificationRead = async (id) => {
  return updateDoc(doc(db, 'notifications', id), { read: true });
};

// ── Daily Reports ──────────────────────────────────────────────
export const getDailyReports = async () => {
  const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addReport = async (data) => {
  return addDoc(collection(db, 'reports'), { ...data, createdAt: serverTimestamp() });
};

// ── Concerns ──────────────────────────────────────────────────
export const getConcerns = async (filters = {}) => {
  let q = query(collection(db, 'concerns'), orderBy('createdAt', 'desc'), limit(100));
  if (filters.batchId) q = query(collection(db, 'concerns'), where('batchId', '==', filters.batchId), orderBy('createdAt', 'desc'));
  if (filters.assignedTo) q = query(collection(db, 'concerns'), where('assignedTo', '==', filters.assignedTo), orderBy('createdAt', 'desc'));
  if (filters.status) q = query(collection(db, 'concerns'), where('status', '==', filters.status), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addConcern = async (data) => {
  return addDoc(collection(db, 'concerns'), {
    ...data,
    status: 'open',
    createdAt: serverTimestamp()
  });
};

export const updateConcern = async (id, data) => updateDoc(doc(db, 'concerns', id), data);

// ── Leads ──────────────────────────────────────────────────────
export const getLeads = async () => {
  const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(200));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addLead = async (data) => {
  return addDoc(collection(db, 'leads'), {
    ...data,
    stage: 'lead',
    createdAt: serverTimestamp()
  });
};

export const updateLead = async (id, data) => updateDoc(doc(db, 'leads', id), data);

// ── Staff Profiles ─────────────────────────────────────────────
export const getStaffProfiles = async () => {
  const snap = await getDocs(collection(db, 'staff'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const setStaffProfile = async (uid, data) => {
  return setDoc(doc(db, 'staff', uid), data, { merge: true });
};

export const getStaffProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'staff', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ── Aliases for backward compatibility ────────────────────────
// Some pages still use getStudents() — map to paginated version
export const getStudents = async () => {
  const result = await getStudentsPaged();
  return result.students;
};
// ── Self-assign students (staff assigns themselves) ────────────
export const selfAssignStudents = async (staffName, studentIds) => {
  const promises = studentIds.map(id =>
    updateDoc(doc(db, 'students', id), { staffAssigned: staffName })
  );
  await Promise.all(promises);
};

// ── Get unassigned students ────────────────────────────────────
export const getUnassignedStudents = async (batchId) => {
  const q = batchId
    ? query(studentsRef(), where('batchId', '==', batchId), where('staffAssigned', '==', ''))
    : query(studentsRef(), where('staffAssigned', '==', ''), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ── Update student activity status ────────────────────────────
export const updateStudentActivity = async (id, data) => {
  return updateDoc(doc(db, 'students', id), {
    ...data,
    lastActivityUpdate: serverTimestamp()
  });
};