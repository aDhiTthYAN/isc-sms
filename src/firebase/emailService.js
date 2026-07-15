import emailjs from '@emailjs/browser';

// ─────────────────────────────────────────────────────────────
// SETUP INSTRUCTIONS (one-time, free):
// 1. Go to https://www.emailjs.com — sign up free
// 2. Add Email Service → connect your Gmail
// 3. Create Email Template (see templates below)
// 4. Replace the 3 values below with yours
// ─────────────────────────────────────────────────────────────
const SERVICE_ID  = 'YOUR_EMAILJS_SERVICE_ID';   // e.g. service_abc123
const PUBLIC_KEY  = 'YOUR_EMAILJS_PUBLIC_KEY';   // e.g. user_xyz789

// Template IDs — create these in EmailJS dashboard
const TEMPLATES = {
  task:     'template_task_assigned',
  followup: 'template_followup_assigned',
  concern:  'template_concern_assigned',
  welcome:  'template_welcome',
};

// Initialize EmailJS
emailjs.init(PUBLIC_KEY);

// ── Send email when CEO assigns a task ────────────────────────
export const sendTaskEmail = async ({ toEmail, toName, taskTitle, dueDate, priority, assignedBy }) => {
  if (SERVICE_ID === 'YOUR_EMAILJS_SERVICE_ID') {
    console.log('📧 [DEV MODE] Task email skipped — configure EmailJS keys');
    return { status: 'dev-mode' };
  }
  try {
    await emailjs.send(SERVICE_ID, TEMPLATES.task, {
      to_email:    toEmail,
      to_name:     toName,
      task_title:  taskTitle,
      due_date:    dueDate || 'No due date',
      priority:    priority || 'Normal',
      assigned_by: assignedBy,
      app_url:     window.location.origin,
    });
    return { status: 'sent' };
  } catch (err) {
    console.error('Email failed:', err);
    return { status: 'failed', error: err };
  }
};

// ── Send email when CEO assigns a follow-up ───────────────────
export const sendFollowUpEmail = async ({ toEmail, toName, studentName, note, priority, assignedBy }) => {
  if (SERVICE_ID === 'YOUR_EMAILJS_SERVICE_ID') {
    console.log('📧 [DEV MODE] Follow-up email skipped — configure EmailJS keys');
    return { status: 'dev-mode' };
  }
  try {
    await emailjs.send(SERVICE_ID, TEMPLATES.followup, {
      to_email:     toEmail,
      to_name:      toName,
      student_name: studentName,
      note:         note,
      priority:     priority || 'Normal',
      assigned_by:  assignedBy,
      app_url:      window.location.origin,
    });
    return { status: 'sent' };
  } catch (err) {
    console.error('Email failed:', err);
    return { status: 'failed', error: err };
  }
};

// ── Send email when a concern is assigned ─────────────────────
export const sendConcernEmail = async ({ toEmail, toName, studentName, concernType, description, assignedBy }) => {
  if (SERVICE_ID === 'YOUR_EMAILJS_SERVICE_ID') {
    console.log('📧 [DEV MODE] Concern email skipped — configure EmailJS keys');
    return { status: 'dev-mode' };
  }
  try {
    await emailjs.send(SERVICE_ID, TEMPLATES.concern, {
      to_email:     toEmail,
      to_name:      toName,
      student_name: studentName,
      concern_type: concernType,
      description:  description,
      assigned_by:  assignedBy,
      app_url:      window.location.origin,
    });
    return { status: 'sent' };
  } catch (err) {
    console.error('Email failed:', err);
    return { status: 'failed', error: err };
  }
};

// ── Generic assignment email (reuses task template) ───────────
export const sendAssignmentEmail = async ({ toEmail, toName, title, detail, assignedBy }) => {
  if (SERVICE_ID === 'YOUR_EMAILJS_SERVICE_ID') {
    console.log('📧 [DEV MODE] Assignment email skipped — configure EmailJS keys');
    return { status: 'dev-mode' };
  }
  try {
    await emailjs.send(SERVICE_ID, TEMPLATES.task, {
      to_email:    toEmail,
      to_name:     toName,
      task_title:  title,
      due_date:    detail || '',
      priority:    'Normal',
      assigned_by: assignedBy,
      app_url:     window.location.origin,
    });
    return { status: 'sent' };
  } catch (err) {
    console.error('Email failed:', err);
    return { status: 'failed', error: err };
  }
};

// ── Email templates to paste in EmailJS dashboard ─────────────
// TASK TEMPLATE (template_task_assigned):
// Subject: New Task Assigned — {{task_title}}
// Body:
// Hi {{to_name}},
// {{assigned_by}} has assigned you a new task.
// Task: {{task_title}}
// Priority: {{priority}}
// Due: {{due_date}}
// Open the dashboard: {{app_url}}
//
// FOLLOW-UP TEMPLATE (template_followup_assigned):
// Subject: Follow-Up Required — {{student_name}}
// Body:
// Hi {{to_name}},
// {{assigned_by}} has assigned you a follow-up for student {{student_name}}.
// Note: {{note}}
// Priority: {{priority}}
// Please log your follow-up at: {{app_url}}
//
// CONCERN TEMPLATE (template_concern_assigned):
// Subject: Student Concern — {{student_name}}
// Body:
// Hi {{to_name}},
// A {{concern_type}} concern has been raised for {{student_name}}.
// Details: {{description}}
// Assigned by: {{assigned_by}}
// View in dashboard: {{app_url}}