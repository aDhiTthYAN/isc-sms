import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ShieldCheck, Lock, ArrowRight } from 'lucide-react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECS = 5 * 60;

function getRemainingLockout() {
  try { const ts = Number(localStorage.getItem('isc_lockout_until') || 0); return Math.max(0, Math.ceil((ts - Date.now()) / 1000)); } catch { return 0; }
}
function getAttempts() { try { return Number(localStorage.getItem('isc_login_attempts') || 0); } catch { return 0; } }
function setAttempts(n) { try { localStorage.setItem('isc_login_attempts', String(n)); } catch {} }
function setLockout() { try { localStorage.setItem('isc_lockout_until', String(Date.now() + LOCKOUT_SECS * 1000)); } catch {} }
function clearAttempts() { try { localStorage.removeItem('isc_login_attempts'); localStorage.removeItem('isc_lockout_until'); } catch {} }

export default function LoginPage() {
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [resetSent,  setResetSent]  = useState(false);
  const [lockoutRem, setLockoutRem] = useState(getRemainingLockout);
  const timerRef = useRef(null);
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (lockoutRem <= 0) return;
    timerRef.current = setInterval(() => {
      const rem = getRemainingLockout();
      setLockoutRem(rem);
      if (rem <= 0) clearInterval(timerRef.current);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [lockoutRem]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (getRemainingLockout() > 0) return;
    const emailTrimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) { setError('Please enter a valid email address.'); return; }
    setLoading(true);
    try {
      await login(emailTrimmed, password);
      clearAttempts();
      navigate('/');
    } catch {
      const attempts = getAttempts() + 1;
      setAttempts(attempts);
      if (attempts >= MAX_ATTEMPTS) {
        setLockout(); setLockoutRem(LOCKOUT_SECS);
        setError(`Too many failed attempts. Account locked for ${LOCKOUT_SECS / 60} minutes.`);
      } else {
        setError(`Invalid email or password. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining.`);
      }
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!email.trim()) { setError('Enter your email first.'); return; }
    try { await resetPassword(email.trim().toLowerCase()); setResetSent(true); setError(''); }
    catch { setError('Could not send reset email. Check the address and try again.'); }
  };

  const locked = lockoutRem > 0;
  const mins = String(Math.floor(lockoutRem / 60)).padStart(2, '0');
  const secs = String(lockoutRem % 60).padStart(2, '0');

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--grad-mesh)', position: 'relative', overflow: 'hidden', padding: 20,
    }}>
      {/* Floating blobs */}
      <div style={{ position: 'absolute', top: '10%', left: '15%', width: 340, height: 340, borderRadius: '50%', background: 'rgba(139,131,255,0.22)', filter: 'blur(60px)', animation: 'floaty 9s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '12%', width: 280, height: 280, borderRadius: '50%', background: 'rgba(79,70,229,0.18)', filter: 'blur(70px)', animation: 'floaty 11s ease-in-out infinite reverse', pointerEvents: 'none' }} />
      {/* Dot overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '26px 26px', pointerEvents: 'none' }} />

      <style>{`@keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }`}</style>

      {/* Card */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 420px',
        maxWidth: 880, width: '100%',
        borderRadius: 24, overflow: 'hidden',
        boxShadow: '0 40px 90px -30px rgba(13,11,40,.8)',
        position: 'relative', zIndex: 1,
      }}>

        {/* ── Left rail ── */}
        <div style={{
          background: 'var(--grad-night)', padding: '42px 40px',
          display: 'flex', flexDirection: 'column', color: '#fff',
        }}>
          {/* Logo lockup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <div style={{
              width: 42, height: 40, borderRadius: 11, overflow: 'hidden', flexShrink: 0,
              boxShadow: '0 8px 20px -6px rgba(232,22,32,.6)',
              background: '#E81620', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src="/logo.svg" alt="ISC" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 11 }} onError={e => { e.target.style.display='none'; e.target.parentNode.innerHTML='<span style="font-family:var(--font-display);font-weight:700;font-size:13px;color:#fff">ISC</span>'; }} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>International<br />Skills Club</div>
            </div>
          </div>

          {/* Status pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 500, marginBottom: 28, width: 'fit-content' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A974', flexShrink: 0 }} />
            Student Management System · v3
          </div>

          {/* Headline */}
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 27, fontWeight: 700, lineHeight: 1.22, letterSpacing: '-0.02em', marginBottom: 14, color: '#fff' }}>
            Run your whole<br />academy from<br />one workspace.
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, marginBottom: 'auto' }}>
            Track progress, manage batches, and monitor onboarding — all in real time.
          </p>

          {/* Stat tiles */}
          <div style={{ display: 'flex', gap: 10, marginTop: 40 }}>
            {[['248', 'Students'], ['12', 'Batches'], ['18', 'Staff']].map(([n, l]) => (
              <div key={l} style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 13, padding: '14px 12px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff' }}>{n}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right form ── */}
        <div style={{ background: '#fff', padding: '44px 40px', display: 'flex', flexDirection: 'column' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 20, padding: '5px 12px', fontSize: 12, fontWeight: 600, marginBottom: 28, width: 'fit-content' }}>
            <ShieldCheck size={13} />
            Authorised staff only
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.02em' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 28 }}>
            Sign in with your registered ISC credentials.
          </p>

          {/* Lockout banner */}
          {locked && (
            <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '12px 14px', borderRadius: 10, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={14} /> Account locked. Try again in <strong style={{ marginLeft: 4 }}>{mins}:{secs}</strong>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} autoComplete="on" noValidate>
            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                style={{ height: 46, borderRadius: 12 }}
                type="email"
                placeholder="you@internationalskillsclub.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={locked}
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <button type="button" onClick={handleReset} disabled={locked}
                  style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                  Forgot?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  style={{ height: 46, borderRadius: 12, paddingRight: 44 }}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={locked}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} disabled={locked}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>{error}</div>}
            {resetSent && <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>Password reset email sent — check your inbox.</div>}

            <button
              type="submit"
              disabled={loading || locked}
              style={{
                height: 48, borderRadius: 12, border: 'none', cursor: loading || locked ? 'not-allowed' : 'pointer',
                background: 'var(--grad-brand)', boxShadow: 'var(--shadow-brand)',
                color: '#fff', fontSize: 14.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'transform 0.15s, box-shadow 0.15s',
                opacity: loading || locked ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!loading && !locked) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow='var(--shadow-brand-h)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='var(--shadow-brand)'; }}
            >
              {loading ? 'Signing in…' : <><span>Sign In</span><ArrowRight size={16} /></>}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Unauthorised access attempts are logged and may be reported.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
