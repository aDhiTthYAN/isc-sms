# ISC SMS — Full Testing Checklist

Run `npm run dev`, then work through every item. ✅ = expected result.

## A. Login & shell
1. Logout → login page shows teal split panel. ✅ Logo (or "ISC" badge) top-left.
2. Wrong password ×3 → lockout message. Forgot password → reset email.
3. Sidebar: teal logo, active item highlighted teal, your logo if `public/logo.png` exists.
4. Topbar: breadcrumb updates per page, search box, avatar + name + role.

## B. Batches — status & duration (CEO)
5. Open a batch. If it shows **Expired**, set the status dropdown (top) to **Active**.
6. ✅ Once Active, the **Add Student / Bulk CSV** (Students tab), **Add Task** (Assignments), **Add Assessment** (Assessments) buttons appear.
7. Click **Duration** → change end date / months → Save → dates update; "Expired" disappears while Active.
8. Set status back to Completed/Upcoming → add buttons disappear (only Active is editable).

## C. Students inside batch
9. Students tab → **Add Student** (works for staff too) → student appears.
10. **Bulk CSV** → upload → preview → import.
11. **Student Fields** config → tick/untick **Show in list** → columns change. Name/Status/Onboarding/View always stay.
12. Inline-edit a cell in the table → value saves.

## D. Course flow
13. Onboarding tab → open a dropdown step → **＋ Add new option…** → type custom value → mark student.

## E. Schedule (Day / Week / Month)
14. Open Schedule → ✅ loads immediately showing **all batches** (not blank).
15. Toggle **Day / Week / Month**. Day view shows single-day timeline.
16. ✅ **Assessments appear** on the calendar (red) with batch + date.
17. Click a class → **popup** (not a card below) with batch, faculty, meet link, student list (search box if >12).
18. **Mark Attendance** → toggle present/absent → save.
19. **Progress Reports** → write a note + rating per student → save → reopen shows it; expand a student to see other faculty's notes.
20. Add a **meeting** (type=Meeting) with specific students → appears blue.
21. As a **staff** account → ✅ still sees every staff's schedule.

## F. Assessments
22. Assessments page → **Create** → All / Specific students (searchable, shows phone/course).
23. **Conducting Staff** → searchable checklist (name + phone).
24. **Import** → either upload CSV **or** type marks manually per student → save.
25. ✅ After saving marks, assessment status auto-flips to **Completed**.
26. Row **status dropdown** (Upcoming/Ongoing/Completed) works for staff and CEO.
27. **Results** → shows marks (works regardless of where they were imported).

## G. Student profile
28. Open a student → **Edit** → change Father/Mother/Email/WhatsApp/School/Address/Gender/Age/etc. → save.
29. **Performance** tab → attendance %, avg assessment, assignment completion (Submitted/Pending/Overdue), all faculty progress reports.
30. **Assessments** tab → batch assessments the student is in appear (with marks or "Not marked").

## H. Assignments (batch tasks)
31. Assignments tab → **Add Task** → All / Specific students (searchable).
32. ✅ **Search box** filters assignments by title.
33. CEO: **staff filter** dropdown shows assignments per assigned faculty.
34. As a **staff** account → ✅ only sees assignments assigned to them.
35. Select an assignment → per-student submitted/pending tracked against the assigned students (not the whole batch).

## I. Staff tasks
36. As **staff** → Tasks → Start, then **Complete** → requires a note → task moves to Completed.
37. As **CEO** → completed task card shows the staff's note.

## J. Staff management
38. Revoke a staff → moves to Revoked list.
39. ✅ Revoked staff no longer appear in any dropdown (schedule faculty, assessment staff, task assignee, etc.).
40. Revoked list → **Delete** → confirm → permanently removed.

## K. Notifications
41. Click an assessment notification → ✅ goes to **Assessments** (not Concerns).
42. Click a task/followup notification → goes to the right page.

## L. Dashboard
43. Recent Activity shows only recent (~last 1.5 days) items.
44. Click a class-schedule item → ✅ goes to the **Schedule** page (not a dead batch tab).

## Known items to verify separately
- **Documents page**: needs Firebase **Storage** enabled + rules. If blank, that's a Storage-config issue, not app code.
- **Firestore rules**: live project uses the broad rule; publish repo `firestore.rules` before external launch.
