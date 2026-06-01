# ISC Student Management System
### International Skills Club — Internal Management Dashboard

---

## What Is This?

A full-stack web application for managing students, staff, batches, follow-ups, assessments, and daily operations at International Skills Club. Built as a Progressive Web App (PWA) — works on phone, tablet, and desktop.

---

## What We Built

| Module | What it does |
|--------|-------------|
| CEO Dashboard | Live stats, task overview, follow-up feed |
| Admin Dashboard | Medium access — students, batches, concerns |
| Staff Dashboard | Personal view — my students, my batches, my tasks |
| Batch Management | Create batch → add students directly into it |
| All Students | Search 10,000+ students, filter by batch/status |
| Student Profile | Full history, follow-up timeline, assessments |
| Follow-Up Tracker | CEO assigns to staff → email + in-app notification |
| Concerns | Log and track student issues |
| Assessments | Upload results, auto-calculate percentage, track trend |
| Staff Tasks | Kanban board — CEO assigns, staff completes |
| Daily Reports | Staff submit EOD, CEO sees all |
| Lead Pipeline | Inquiry → counselling → demo → enrolled funnel |
| Documents | Upload student files to Firebase Storage |
| Leaderboard | ISC PointsBoard embedded from isc-students-dashboard.vercel.app |
| Staff Management | Add staff, assign roles, revoke/restore access |
| Bulk Import | CSV import into a specific batch |

---

## Tech Stack

- **Frontend:** React 18 + Vite
- **Database:** Firebase Firestore
- **Auth:** Firebase Authentication
- **Storage:** Firebase Storage
- **Email:** EmailJS
- **Hosting:** Vercel

---

## Firebase Project

- Project ID: isc-sms-test
- Region: asia-south1 (Mumbai)
- Plan: Spark (Free)

---

## Current Users

| Role | Email | Password |
|------|-------|----------|
| CEO | ceo@internationalskillsclub.com | ISC123 |

---

## Running Locally

```bash
git clone https://github.com/YOURNAME/isc-sms.git
cd isc-sms
npm install
npm run dev
# open http://localhost:5173
```

After cloning paste your Firebase config into src/firebase/config.js

---

## Project Structure

```
src/
  firebase/
    config.js          <- Paste your Firebase config here
    services.js        <- All database operations
    emailService.js    <- Email notification functions
  context/
    AuthContext.jsx    <- Login state
    NotifContext.jsx   <- Real-time notifications
  components/
    layout/Sidebar.jsx
    layout/Topbar.jsx
    ui/index.jsx       <- Modal, Toast, Avatar etc
    ui/NotifBell.jsx
  pages/
    Login.jsx
    Dashboard.jsx          CEO dashboard
    AdminDashboard.jsx
    StaffDashboard.jsx
    Students.jsx           Paginated, searchable
    StudentProfile.jsx
    Batches.jsx            Batch-first student flow
    BulkImport.jsx
    FollowUps.jsx
    Concerns.jsx
    Assessments.jsx
    Tasks.jsx
    Reports.jsx
    Leads.jsx
    Documents.jsx
    Leaderboard.jsx
    StaffManagement.jsx
  App.jsx                  Routes + role-based navigation
  index.css
```

---

## How to Add Students (New Flow)

1. Batches → Create Batch
2. Click the batch
3. Add Student (manual) OR Bulk Import CSV
4. Students automatically placed in that batch

CSV columns: name, phone, parentPhone, email, education, location, staffAssigned, classplusId, status

---

## How to Add Staff

Step 1 (in app): Staff Management → Add Staff → generates temp password

Step 2 (Firebase Console): Authentication → Add user → enter email + temp password → copy UID → in Firestore staff collection rename the document ID to match that UID

---

## Role Permissions

| Role | Access |
|------|--------|
| ceo | Everything |
| admin | Students, batches, concerns, documents |
| staff | Only their assigned students and tasks |

---

## Email Notifications

Open src/firebase/emailService.js and add your EmailJS credentials:
```
const SERVICE_ID = 'your-service-id';
const PUBLIC_KEY = 'your-public-key';
```

---

## Deploy

```bash
npm install -g vercel
vercel
vercel --prod
```

---

## Team Workflow

```bash
# Start of day
git pull

# After changes
git add .
git commit -m "what you changed"
git push
```

Give team members Firebase config values and GitHub repo access.

---

## Making Changes With Claude

1. Tell Claude what to change
2. Claude gives you a file name + new code
3. Open that file in VS Code
4. Ctrl+A → paste → Ctrl+S
5. Browser refreshes instantly
6. git add . && git commit -m "change" && git push
