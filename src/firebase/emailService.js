// ─────────────────────────────────────────────────────────────────
// Email service — DISABLED CLIENT-SIDE (Phase 2 security remediation)
//
// The previous implementation embedded EmailJS credentials in the
// browser bundle. Anyone opening the app could extract them and send
// arbitrary emails through the business account, and any demo click
// could email real staff. Client-side sending is therefore removed.
//
// If email notifications are needed later, implement them SERVER-SIDE
// (Cloud Function / small backend holding the provider key). These
// stubs keep the same exports so callers work unchanged; in-app bell
// notifications (Firestore `notifications`) still function normally.
// ─────────────────────────────────────────────────────────────────

const disabled = async () => ({ status: 'disabled-client-side' });

export const sendTaskEmail       = disabled;
export const sendFollowUpEmail   = disabled;
export const sendConcernEmail    = disabled;
export const sendAssignmentEmail = disabled;
