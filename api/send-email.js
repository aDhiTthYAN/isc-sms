// ─────────────────────────────────────────────────────────────────
// Vercel serverless function — email notification sender.
//
// Runs on Vercel's FREE Hobby tier (no Firebase Blaze needed). The
// mail credentials live ONLY in Vercel environment variables and are
// never shipped to the browser. Callers must present a valid Firebase
// ID token (verified here against Google's public certs — no service
// account required), so only signed-in ISC staff can trigger a send.
//
// FEATURE FLAG: if MAIL_USER / MAIL_APP_PASSWORD are not set, this
// returns { status: 'disabled' } and sends nothing. Email "turns on"
// the moment those env vars are configured in Vercel.
//
// Required Vercel env vars (Project → Settings → Environment Variables):
//   MAIL_USER          the sending Gmail/Workspace address
//   MAIL_APP_PASSWORD  a Google App Password (needs 2FA on the account)
//   MAIL_FROM          (optional) From header, e.g. "ISC SMS <no-reply@…>"
//   FIREBASE_PROJECT_ID(optional) defaults to isc-sms-test
// ─────────────────────────────────────────────────────────────────
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'isc-sms-test';
const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Cache Google's signing certs across warm invocations.
let _certs = null;
let _certsAt = 0;
async function getGoogleCerts() {
  if (_certs && Date.now() - _certsAt < 60 * 60 * 1000) return _certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error('cert fetch failed');
  _certs = await res.json();
  _certsAt = Date.now();
  return _certs;
}

// Verify a Firebase Auth ID token without the Admin SDK / service account.
async function verifyIdToken(idToken) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header?.kid) throw new Error('no kid');
  const certs = await getGoogleCerts();
  const cert = certs[decoded.header.kid];
  if (!cert) throw new Error('unknown kid');
  return jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: PROJECT_ID,
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
  });
}

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default async function handler(req, res) {
  // CORS (same-origin in production; permissive for local `vercel dev`)
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ status: 'method-not-allowed' });

  // Feature flag: no creds → do nothing, but succeed so the client's
  // in-app notification flow is never disrupted.
  if (!process.env.MAIL_USER || !process.env.MAIL_APP_PASSWORD) {
    return res.status(200).json({ status: 'disabled' });
  }

  // Auth: require a valid Firebase ID token.
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ status: 'unauthorized' });
  try {
    await verifyIdToken(token);
  } catch {
    return res.status(401).json({ status: 'invalid-token' });
  }

  // Validate payload.
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { toEmail, subject, text, fromName } = body;
  if (!isEmail(toEmail)) return res.status(400).json({ status: 'bad-recipient' });
  const safeSubject = String(subject || 'ISC SMS Notification').slice(0, 200);
  const safeText = String(text || '').slice(0, 5000);

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.MAIL_PORT || 465),
      secure: true,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_APP_PASSWORD },
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM || `ISC SMS <${process.env.MAIL_USER}>`,
      to: toEmail,
      subject: safeSubject,
      text: safeText + (fromName ? `\n\n— ${fromName}, ISC SMS` : ''),
    });
    return res.status(200).json({ status: 'sent' });
  } catch (err) {
    return res.status(502).json({ status: 'send-failed', error: String(err.message || err) });
  }
}
