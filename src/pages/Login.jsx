import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react';

const MAX_ATTEMPTS  = 5;
const LOCKOUT_SECS  = 5 * 60; // 5 minutes

function getRemainingLockout() {
  try {
    const ts = Number(localStorage.getItem('isc_lockout_until') || 0);
    return Math.max(0, Math.ceil((ts - Date.now()) / 1000));
  } catch { return 0; }
}

function getAttempts() {
  try { return Number(localStorage.getItem('isc_login_attempts') || 0); } catch { return 0; }
}

function setAttempts(n) {
  try { localStorage.setItem('isc_login_attempts', String(n)); } catch {}
}

function setLockout() {
  try { localStorage.setItem('isc_lockout_until', String(Date.now() + LOCKOUT_SECS * 1000)); } catch {}
}

function clearAttempts() {
  try {
    localStorage.removeItem('isc_login_attempts');
    localStorage.removeItem('isc_lockout_until');
  } catch {}
}

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

  // Lockout countdown
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await login(emailTrimmed, password);
      clearAttempts();
      navigate('/');
    } catch {
      const attempts = getAttempts() + 1;
      setAttempts(attempts);
      if (attempts >= MAX_ATTEMPTS) {
        setLockout();
        setLockoutRem(LOCKOUT_SECS);
        setError(`Too many failed attempts. Account locked for ${LOCKOUT_SECS / 60} minutes.`);
      } else {
        setError(`Invalid email or password. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) { setError('Enter your email first.'); return; }
    try {
      await resetPassword(email.trim().toLowerCase());
      setResetSent(true);
      setError('');
    } catch {
      setError('Could not send reset email. Check the address and try again.');
    }
  };

  const locked = lockoutRem > 0;
  const mins   = String(Math.floor(lockoutRem / 60)).padStart(2, '0');
  const secs   = String(lockoutRem % 60).padStart(2, '0');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F4F6FA' }}>

      {/* ── Left brand panel ────────────────────────────── */}
      <div style={{
        width: 440, flexShrink: 0,
        background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 60%, #0F3460 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 40px', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', background:'rgba(229,57,53,0.08)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(59,130,246,0.07)', pointerEvents:'none' }}/>

        {/* Logo */}
        <img
          src="/logo.svg"
          alt="International Skills Club"
          style={{ width: 84, height: 84, borderRadius: 20, marginBottom: 24, boxShadow: '0 8px 32px rgba(229,57,53,0.35)' }}
        />

        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, textAlign: 'center', marginBottom: 10, letterSpacing: '-0.02em' }}>
          International<br />Skills Club
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 280, lineHeight: 1.7, marginBottom: 36 }}>
          Student Management System — track progress, manage batches, and monitor onboarding in one place.
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 24, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 28, width: '100%', justifyContent: 'center' }}>
          {[['Batches','Managed'],['Students','Tracked'],['Staff','Access']].map(([a, b]) => (
            <div key={a} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{a}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{b}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Private system badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#FEF3C7', color: '#92400E',
            fontSize: 11, fontWeight: 600, padding: '5px 10px',
            borderRadius: 20, border: '1px solid #FDE68A', marginBottom: 24,
          }}>
            <ShieldCheck size={12} />
            Private system — authorised staff only
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, color: '#0F172A', letterSpacing: '-0.02em' }}>
            Sign In
          </h2>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 28 }}>
            Use your registered ISC staff credentials.
          </p>

          {/* Lockout banner */}
          {locked && (
            <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '12px 14px', borderRadius: 10, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={14} />
              Account locked. Try again in <strong style={{ marginLeft: 4 }}>{mins}:{secs}</strong>
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} autoComplete="on" noValidate>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@internationalskillsclub.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={locked}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={locked}
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  disabled={locked}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2,
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}
            {resetSent && (
              <div style={{ background: '#D1FAE5', color: '#065F46', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                Password reset email sent — check your inbox.
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', height: 44, fontSize: 14, fontWeight: 600, marginTop: 4 }}
              disabled={loading || locked}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={handleReset}
              style={{ background: 'none', border: 'none', color: '#E53935', fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 500 }}
              disabled={locked}
            >
              Forgot password?
            </button>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>v2.0</div>
          </div>

          <div style={{ marginTop: 32, padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.6 }}>
              <strong style={{ color: '#475569' }}>Security notice:</strong> This system is for authorised ISC staff only. Unauthorised access attempts are logged and may be reported.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
