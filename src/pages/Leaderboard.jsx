import { ExternalLink } from 'lucide-react';

const LEADERBOARD_URL = 'https://isc-students-dashboard.vercel.app/';

export default function Leaderboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px - 48px)' }}>
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h2>Student Leaderboard</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            ISC PointsBoard — embedded from isc-students-dashboard.vercel.app
          </p>
        </div>
        <a href={LEADERBOARD_URL} target="_blank" rel="noreferrer">
          <button className="btn btn-primary">
            <ExternalLink size={15} /> Open Full Screen
          </button>
        </a>
      </div>

      <div style={{ padding: '0 0 12px', flexShrink: 0 }}>
        <div style={{ padding: '10px 14px', background: '#FEF3C7', borderRadius: 8, fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
          🏆 During exams, use this embedded view to check rankings without leaving the management dashboard.
          Click "Open Full Screen" to share the leaderboard link with students.
        </div>
      </div>

      <div style={{
        flex: 1,
        borderRadius: 12,
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Mini topbar matching ISC branding */}
        <div style={{ background: '#1A1A2E', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, background: '#E53935', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 11 }}>ISC</div>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>ISC PointsBoard — Student Achievement Leaderboard</span>
          </div>
          <a href={LEADERBOARD_URL} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ExternalLink size={13} /> Open in new tab
          </a>
        </div>
        <iframe
          src={LEADERBOARD_URL}
          title="ISC Student Leaderboard"
          style={{ flex: 1, border: 'none', width: '100%' }}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
