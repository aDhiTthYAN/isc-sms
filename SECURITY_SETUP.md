# Phase 1 security — deployment runbook (manual, in this order)

Nothing here is deployed automatically. Deploy only after the emulator
tests pass and you have reviewed the rules.

## 0. One-time CEO bootstrap (before deploying rules!)
The new rules read `/roles/{uid}`. Until your CEO account has a roles
doc, even the CEO is locked out. In the Firebase console → Firestore:

1. Find your CEO's Auth UID (Authentication → Users).
2. Create collection `roles`, document ID = that UID, fields:
   - `role`   (string) = `ceo`
   - `active` (boolean) = `true`

## 1. Backfill live data (roles, staffDirectory, students.staffIds)
```bash
npm i firebase-admin
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
  node scripts/backfill-phase1.mjs --dry-run    # review the output
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
  node scripts/backfill-phase1.mjs              # apply
```
The service-account JSON must never be committed (already covered by
.gitignore's `.env`? No — keep it OUTSIDE the repo folder entirely).

## 2. Run the rules tests locally
```bash
npm i            # installs @firebase/rules-unit-testing (devDependency)
npm run test:rules
```
All tests must pass. They prove: staff cannot read other batches'
students, cannot self-promote, cannot read leads; CEO can.

## 3. Deploy rules (you, manually)
```bash
firebase deploy --only firestore:rules,storage
```

## 4. Verify in production
- Log in as a staff account: Students page shows only their batches'
  students; Leads is not accessible; Tasks shows only their tasks.
- Log in as CEO: everything still works.
- Firebase console → Firestore → Rules: confirm the new rules are live.

## Notes
- Roles/permissions are now enforced by `/roles/{uid}` (CEO-writable
  only). The `role` field on staff profiles is display-only.
- Revoking a staff member (Staff Management) now flips `roles.active`
  → all their reads/writes are rejected immediately, even though their
  Auth login still succeeds.
- Students carry `staffIds[]` (batch staff + mentor). If a staff member
  unexpectedly "loses" a student, check that array on the student doc
  and the batch's staff list, then re-run the backfill if needed.
