import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStudents, getBatches, getConcerns } from '../firebase/services';
import { Loading, Avatar, StatusBadge } from '../components/ui';
import { Users, School, AlertCircle, FileText, ChevronRight } from 'lucide-react';

export default function AdminDashboard() {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStudents(), getBatches(), getConcerns()]).then(([s, b, c]) => {
      setStudents(s); setBatches(b); setConcerns(c); setLoading(false);
    });
  }, []);

  if (loading) return <Loading />;

  const active   = students.filter(s => s.status === 'active').length;
  const atRisk   = students.filter(s => s.status === 'at-risk').length;
  const openC    = concerns.filter(c => c.status === 'open').length;
  const activeB  = batches.filter(b => b.status === 'active').length;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Admin Dashboard</h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          You have admin access — manage students, batches, documents and concerns.
        </p>
      </div>

      {/* Info banner */}
      <div style={{ padding: '10px 14px', background: '#EDE9FE', borderRadius: 8, fontSize: 12, color: '#5B21B6', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        🛡️ <strong>Admin role:</strong> You can manage students, batches, documents and concerns. Staff management and CEO reports are restricted to CEO only.
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Students', value: students.length, color: '#E53935', bg: '#FEE2E2', icon: Users },
          { label: 'Active Students', value: active, color: '#10B981', bg: '#D1FAE5', icon: Users },
          { label: 'At Risk', value: atRisk, color: '#F59E0B', bg: '#FEF3C7', icon: AlertCircle },
          { label: 'Active Batches', value: activeB, color: '#3B82F6', bg: '#DBEAFE', icon: School },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: card.color }}>{card.value}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick access grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Open Concerns ({openC})</h3>
            <Link to="/concerns" style={{ fontSize: 12, color: '#E53935', display: 'flex', alignItems: 'center', gap: 2 }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {concerns.filter(c => c.status === 'open').slice(0, 4).map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.studentName}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{c.type}</div>
              </div>
              <span className="badge badge-red">Open</span>
            </div>
          ))}
          {openC === 0 && <p style={{ fontSize: 13, color: '#6B7280' }}>No open concerns.</p>}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>Batches ({batches.length})</h3>
            <Link to="/batches" style={{ fontSize: 12, color: '#E53935', display: 'flex', alignItems: 'center', gap: 2 }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {batches.slice(0, 4).map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{b.mentor} · {b.course}</div>
              </div>
              <span className={`badge ${b.status === 'active' ? 'badge-green' : b.status === 'upcoming' ? 'badge-blue' : 'badge-gray'}`}>
                {b.status}
              </span>
            </div>
          ))}
          {batches.length === 0 && <p style={{ fontSize: 13, color: '#6B7280' }}>No batches yet.</p>}
        </div>
      </div>
    </div>
  );
}
