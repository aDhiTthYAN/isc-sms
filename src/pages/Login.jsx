import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { setError('Enter your email first.'); return; }
    await resetPassword(email);
    setResetSent(true);
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: '#F4F6F9',
    }}>
      {/* Left panel */}
      <div style={{
        width: 420, background: '#1A1A2E',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 48px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <div style={{
            width: 44, height: 44, background: '#E53935',
            borderRadius: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: 'Space Grotesk',
            fontWeight: 700, color: '#fff', fontSize: 16
          }}>ISC</div>
          <div>
            <div style={{ color: '#fff', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15 }}>
              International Skills Club
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Student Management System</div>
          </div>
        </div>
        <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
          Welcome back
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.7 }}>
          Sign in to manage students, track follow-ups, and monitor your team's daily operations.
        </p>
        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { emoji: '🎓', text: '248 students tracked' },
            { emoji: '📊', text: 'Real-time CEO dashboard' },
            { emoji: '📞', text: 'Follow-up management' },
            { emoji: '📝', text: 'Daily staff reporting' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18 }}>{item.emoji}</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Sign In</h3>
          <p style={{ color: '#6B7280', fontSize: 13, marginBottom: 32 }}>
            Use your registered email and password.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@internationalskillsclub.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
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
                  required
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)', background: 'none',
                    border: 'none', cursor: 'pointer', color: '#6B7280'
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: '#FEE2E2', color: '#991B1B',
                padding: '10px 14px', borderRadius: 8, fontSize: 13
              }}>{error}</div>
            )}

            {resetSent && (
              <div style={{
                background: '#D1FAE5', color: '#065F46',
                padding: '10px 14px', borderRadius: 8, fontSize: 13
              }}>Password reset email sent. Check your inbox.</div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: 14 }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <button
            onClick={handleReset}
            style={{
              background: 'none', border: 'none',
              color: '#E53935', fontSize: 13, cursor: 'pointer',
              marginTop: 16, padding: 0
            }}
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}
