# ISC SMS — Complete Local Testing Guide
## Test Everything Before Going Live

---

## WHY YOU CAN'T PREVIEW IN CLAUDE
React apps like this one need a live server running — they're not a single HTML file.
Claude's artifact viewer only handles single self-contained files.
But running it locally takes just **4 commands** and works identically to production.

---

## STEP 1 — Extract & Open the Project

1. Download and extract `isc-sms-final.zip`
2. You'll get a folder called `isc-sms`
3. Open **Terminal** (Mac) or **Command Prompt** (Windows)
   - Mac: Press `Cmd + Space`, type "Terminal", press Enter
   - Windows: Press `Win + R`, type `cmd`, press Enter
4. Navigate to the folder:
   ```
   cd Downloads/isc-sms
   ```

---

## STEP 2 — Set Up Firebase (One-Time, ~10 minutes)

**2a. Create Firebase project**
1. Go to: https://console.firebase.google.com
2. Click "Add project" → Name it `isc-sms-test` → Create
3. Disable Google Analytics (not needed)

**2b. Enable services**
- Left menu → **Authentication** → Get started → Email/Password → Enable → Save
- Left menu → **Firestore Database** → Create database → Production mode → `asia-south1` → Enable
- Left menu → **Storage** → Get started → Next → Done

**2c. Get config**
- Gear icon ⚙️ → Project settings → scroll to "Your apps"
- Click `</>` web icon → App name: `isc-test` → Register app
- Copy the `firebaseConfig` object shown

**2d. Paste config into the app**
- Open `src/firebase/config.js` in any text editor (Notepad, VS Code)
- Replace the placeholder values with your real Firebase values
- Save the file

---

## STEP 3 — Create Test Users in Firebase

Go to Firebase Console → **Authentication** → **Users** tab

### Create CEO account:
- Click "Add user"
- Email: `ceo@test.com`
- Password: `Test@1234`
- Copy the UID shown (long string like `abc123xyz...`)

### Create Staff account:
- Email: `staff@test.com`
- Password: `Test@1234`
- Copy the UID

### Create Admin account:
- Email: `admin@test.com`
- Password: `Test@1234`
- Copy the UID

**Now set roles in Firestore:**
1. Go to Firestore Database → click "+ Start collection"
2. Collection ID: `staff` → Next
3. Document ID: paste the CEO's UID
4. Add fields:
   - `name` (string): `Test CEO`
   - `role` (string): `ceo`
   - `email` (string): `ceo@test.com`
   - `active` (boolean): `true`
5. Save → then click "+ Add document" for each other user:
   - Staff UID → `name: Test Staff`, `role: staff`, `email: staff@test.com`, `active: true`
   - Admin UID → `name: Test Admin`, `role: admin`, `email: admin@test.com`, `active: true`

---

## STEP 4 — Run the App Locally

In your terminal (inside the `isc-sms` folder):
```bash
npm install
npm run dev
```

You'll see:
```
  VITE v8.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Open your browser and go to: **http://localhost:5173**

🎉 **The app is now running!**

---

## STEP 5 — Test Checklist

Work through this list to verify every feature:

### ✅ Authentication
- [ ] Go to http://localhost:5173 → redirects to `/login`
- [ ] Login with `ceo@test.com` / `Test@1234` → sees CEO Dashboard
- [ ] Sign out → login with `staff@test.com` → sees Staff Dashboard (limited menu)
- [ ] Sign out → login with `admin@test.com` → sees Admin Dashboard (medium menu)
- [ ] Try wrong password → shows error message

### ✅ CEO Dashboard
- [ ] Stats show (initially 0, that's correct until you add data)
- [ ] All sidebar menu items are visible for CEO

### ✅ Add a Student
- [ ] Students → "Add Student" button → fill form → save
- [ ] Student appears in the table
- [ ] Click View → opens student profile page
- [ ] Click Edit → change status → save
- [ ] Check follow-up history is empty
- [ ] Add a follow-up note → it appears in the timeline

### ✅ Bulk Import
- [ ] Students → "Bulk Import" button in top nav
- [ ] Download template CSV → open in Excel/Google Sheets
- [ ] Fill 3-5 rows with student data → save as CSV
- [ ] Upload the CSV → preview shows rows
- [ ] Click Import → students appear in All Students

### ✅ Create a Batch
- [ ] Batches → "Create Batch" → fill name, course, mentor, dates → save
- [ ] Batch appears on the page
- [ ] Go back to Add Student → batch now appears in dropdown

### ✅ Assign Tasks to Staff
- [ ] Tasks → "Assign Task" → select staff name, add title, due date
- [ ] Task appears in Pending column
- [ ] Move to In Progress → move to Completed

### ✅ Follow-Ups
- [ ] Follow-Ups → "Assign Follow-Up" → select student, staff, add note → save
- [ ] Follow-up appears in list
- [ ] Sign in as Staff → see "My Follow-Ups" in sidebar

### ✅ Concerns
- [ ] Concerns → "Log Concern" → select student, type, description → save
- [ ] Concern appears in list with category pill
- [ ] Click "Resolve" → status changes to Resolved

### ✅ Assessments
- [ ] Go to a Student Profile → "Assessment" button
- [ ] Add test name, marks, total marks → percentage auto-calculates
- [ ] Add 3 tests → trend shows on profile

### ✅ Daily Reports
- [ ] Reports → fill in numbers → Submit
- [ ] Report appears on the right side grouped by date
- [ ] Test as Staff user too — they can submit their EOD report

### ✅ Leaderboard
- [ ] Click "Leaderboard" in sidebar
- [ ] Your ISC PointsBoard loads inside the app (embedded iframe)
- [ ] "Open Full Screen" button opens it in a new tab

### ✅ Documents
- [ ] Documents → Upload → select a student, type, pick any PDF/image
- [ ] File uploads and appears in the list
- [ ] Click download icon → file opens

### ✅ Lead Pipeline
- [ ] Leads → Add Lead → fill name, phone, course, source
- [ ] Lead appears in table at "Lead" stage
- [ ] Click "Counselling →" to advance the stage
- [ ] Funnel counts update

### ✅ Staff Management (CEO only)
- [ ] Settings → Staff Management → shows all 3 test users
- [ ] Role difference cards explain CEO/Admin/Staff access
- [ ] "Revoke Access" on the staff user → confirms → user appears in Revoked section
- [ ] "Restore" → user moves back to Active
- [ ] "Add Staff Member" → enter a new email → saves (sends setup email if email is real)

### ✅ Role differences (sign in as each role)
- **CEO** sees: everything including Staff Management, Leads, all reports
- **Admin** sees: Students, Batches, Concerns, Documents, Follow-ups — no Staff Mgmt or Leads
- **Staff** sees: only My Students (assigned to them), My Tasks, My Follow-Ups, Submit Report

---

## STEP 6 — Stop the Local Server

Press `Ctrl + C` in the terminal.

---

## STEP 7 — When You're Happy, Deploy to Production

Once testing is complete:
```bash
npm install -g vercel
vercel
```
Follow the prompts → your app is live at `https://isc-sms.vercel.app`

Staff can open that URL on their phone → tap "Add to Home Screen" → works like a native app.

---

## Common Issues

| Problem | Fix |
|---------|-----|
| Page shows blank after login | Check browser console (F12) for Firebase errors — usually wrong config |
| "Permission denied" error | Firebase Security Rules not set — paste contents of `firestore.rules` into Firebase Console |
| Can't upload documents | Storage rules not set — paste `storage.rules` into Firebase Console → Storage → Rules |
| Staff sees CEO menu | Role in Firestore not set correctly — check `staff/{uid}` document has `role: "staff"` |
| OTP login not working | OTP email auth requires Firebase Email Link setup — currently using password auth for all roles |

---

## Need Help?

If any step fails, share the exact error from the browser console (press F12 → Console tab) and I can fix it immediately.
