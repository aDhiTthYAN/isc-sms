// ─────────────────────────────────────────────────────────────────
// Phase 1 one-time backfill — RUN LOCALLY, NEVER IN CI.
//
// Populates, from existing live data:
//   1. roles/{uid}           ← from staff docs (role + active)
//   2. staffDirectory/{uid}  ← from staff docs (safe subset)
//   3. students.staffIds[]   ← from each student's batch (staff + mentor)
//
// Requirements:
//   npm i firebase-admin
//   Download a service-account key: Firebase console → Project settings
//   → Service accounts → Generate new private key. KEEP IT OUT OF GIT.
//
// Usage:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/backfill-phase1.mjs --dry-run     # preview only
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
//     node scripts/backfill-phase1.mjs               # apply
// ─────────────────────────────────────────────────────────────────
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry-run');
initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const uniq = (arr) => [...new Set(arr.filter(Boolean))];

async function backfillRolesAndDirectory() {
  const staff = await db.collection('staff').get();
  let roles = 0, dirs = 0;
  for (const d of staff.docs) {
    const s = d.data();
    const role = s.role === 'ceo' ? 'ceo' : 'staff'; // admin role removed
    const active = s.active !== false;
    console.log(`  roles/${d.id}  role=${role} active=${active}  (${s.name || s.email || '?'})`);
    if (!DRY) {
      await db.doc(`roles/${d.id}`).set({ role, active }, { merge: true });
      await db.doc(`staffDirectory/${d.id}`).set({
        name: s.name || '', email: s.email || '', role,
        subjects: s.subjects || [], active,
      }, { merge: true });
    }
    roles++; dirs++;
  }
  console.log(`roles: ${roles} docs, staffDirectory: ${dirs} docs ${DRY ? '(dry-run)' : 'written'}`);
}

async function backfillStudentStaffIds() {
  const batches = await db.collection('batches').get();
  const staffByBatch = {};
  for (const b of batches.docs) {
    const data = b.data();
    staffByBatch[b.id] = uniq([...(data.staffIds || []), data.mentorId]);
  }
  const students = await db.collection('students').get();
  let updated = 0, orphans = 0;
  let batch = db.batch(), inBatch = 0;
  for (const s of students.docs) {
    const staffIds = staffByBatch[s.data().batchId] || [];
    if (!staffByBatch[s.data().batchId]) orphans++;
    if (!DRY) {
      batch.update(s.ref, { staffIds });
      if (++inBatch === 400) { await batch.commit(); batch = db.batch(); inBatch = 0; }
    }
    updated++;
  }
  if (!DRY && inBatch > 0) await batch.commit();
  console.log(`students: ${updated} updated ${DRY ? '(dry-run)' : ''}; ${orphans} had no/unknown batch (staffIds=[] → CEO-only access)`);
}

console.log(DRY ? '── DRY RUN — nothing will be written ──' : '── APPLYING BACKFILL ──');
await backfillRolesAndDirectory();
await backfillStudentStaffIds();
console.log('Done.');
