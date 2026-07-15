# ISC SMS — Technical Document

International Skills Club — Student Management System.

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Routing | react-router-dom |
| Backend | Firebase — Firestore (data), Auth (login), Storage (documents) |
| Styling | Inline styles + CSS design tokens in `src/index.css` |
| Icons | lucide-react |
| Fonts | Bricolage Grotesque (display) + Hanken Grotesk (body) |

## 2. Design system (src/index.css)

- Brand/accent: teal `--accent:#0F9E8E`
- Semantic tokens: `--pos` (green), `--warn` (amber), `--neg` (red), `--info` (blue), `--purple`, `--pink`
- Text: `--ink`, `--sub`, `--muted`, `--faint`
- Surfaces: `--bg`, `--surface`, `--surface-2`, `--hover`, `--border`
- `--brand` is aliased to `--accent` so older pages inherit the new colour automatically.

## 3. Roles

- **ceo / admin** — full control: create batches, manage staff, set batch status, assign tasks, everything.
- **staff** — see their assigned batches, their students, mark attendance, write progress reports, complete their own tasks. Staff only see assignments assigned to them.

Role is stored on the `staff/{uid}` document (`role` field).

## 4. Firestore collections

| Collection | Purpose |
|---|---|
| `staff` | Staff profiles (name, email, role, subjects, `active` flag) |
| `students` | Student records (linked to a batch via `batchId`) |
| `batches` | Batch/cohort (course, dates, status, staffIds, mentorId, courseFlow, studentFields) |
| `schedules` | Calendar entries — classes, meetings, events (batchId, day/scheduledDate, time, type, participantStudents) |
| `attendance` | Per-session attendance (`scheduleId`, `records`/`attendance` map of studentId→{name,present}) |
| `classReports` | Per-student progress notes after a class (studentId, facultyName, note, rating, sessionTitle) |
| `assessments` | Tests/exams (batchId, date, totalMarks, conductingStaff, participantStudents, status) |
| `assessmentResults` | Marks per student per assessment (marks/marksScored, percentage, pass/passed) |
| `batchTasks` | Assignments inside a batch (title, assignedFaculty, assignedType, assignedStudentIds, submittedBy[]) |
| `tasks` | Staff to-do tasks (assignedToEmail, status, completionNote) |
| `followups` | Student follow-up calls |
| `concerns` | Student concerns/issues |
| `leads` | Lead pipeline |
| `reports` | Daily staff reports |
| `documents` | (Firebase Storage) uploaded files |
| `notifications` | In-app notifications (toEmail, type, message) |
| `requests` | Staff requests (removal etc.) |
| `trash` | Soft-deleted students/batches (CEO restore) |

## 5. Key modules (src/pages)

- **Dashboard / StaffDashboard** — role-specific home; Recent Activity windowed to the last ~36h.
- **Batches** — the hub. Tabs: Students, Onboarding Analytics, Assignments, Assessments, Staff.
  - Batch status (Upcoming/Active/Completed) is CEO-controlled and gates whether students/tasks/assessments can be added (**only Active batches are editable**).
  - "Duration" button (CEO) edits start/end dates + course months.
  - Course Flow + Student Fields config (which columns show in the student list).
- **Schedule** — global calendar (Day/Week/Month). Shows all batches by default; classes, meetings and **assessments** appear on it. Mark attendance + write progress reports per class. Every staff sees every staff's schedule.
- **StudentProfile** — Overview, Course Flow, Assessments, **Performance** (attendance %, assignment completion, faculty progress reports), Follow-Ups. Edit modal covers all profile fields.
- **Assessments** — create (all/specific students, searchable conducting-staff picker), import marks (CSV **or** manual entry), status control, results.
- **Tasks** — staff task board; staff complete their own tasks with a required note the CEO can read.
- **StaffManagement** — add/revoke staff; permanently delete revoked staff.

## 6. Services (src/firebase/services.js)

All Firestore access is centralised here. Notable functions added recently:
`getAllSchedules`, `getAllAssessments`, `saveClassReport`/`getSessionReports`/`getStudentReports`,
`getStudentBatchAssessments`, `getStudentAttendanceSummary`, per-student assignment tracking on `batchTasks`.

Sorting is done in JS (not Firestore `orderBy`) to avoid composite-index requirements.

## 7. Security rules (firestore.rules)

The repo ships a complete rules file where every collection is scoped to authenticated users, with CEO-only writes on `staff` create/delete, `trash`, and `requests` approval. The **live** project currently uses a broad "any authenticated user" rule, which is fine for internal use; publish the repo rules before external launch to harden.

## 8. Known infra notes

- **Documents page** needs Firebase **Storage** enabled + rules allowing authenticated read/write. If it doesn't load, check Storage is set up in the Firebase console.
- Logo: place your file at `public/logo.png` — Sidebar and Login use it, falling back to the "ISC" badge if absent.

## 9. Build & run

```
npm install
npm run dev      # local dev server
npm run build    # production build (outputs dist/)
```
