import { useEffect, useState } from 'react';
import { getAllAssessments, getStudents, getBatches } from '../firebase/services';
import { Loading, Avatar } from '../components/ui';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function Assessments() {
  const [assessments, setAssessments] = useState([]);
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');

  useEffect(() => {
    Promise.all([getAllAssessments(), getStudents(), getBatches()]).then(([a, s, b]) => {
      setAssessments(a); setStudents(s); setBatches(b); setLoading(false);
    });
  }, []);

  // Group assessments by student
  const byStudent = {};
  assessments.forEach(a => {
    if (!byStudent[a.studentId]) byStudent[a.studentId] = [];
    byStudent[a.studentId].push(a);
  });

  const rows = students
    .filter(s => {
      const q = search.toLowerCase();
      const matchQ = !q || s.name?.toLowerCase().includes(q);
      const matchB = !batchFilter || s.batchId === batchFilter;
      return matchQ && matchB && byStudent[s.id]?.length > 0;
    })
    .map(s => {
      const tests = (byStudent[s.id] || []).sort((a, b) => new Date(a.date) - new Date(b.date));
      const pcts = tests.map(t => t.percentage);
      const latest = pcts[pcts.length - 1] ?? null;
      const first  = pcts[0] ?? null;
      const trend  = (latest !== null && first !== null && pcts.length > 1) ? latest - first : null;
      return { student: s, tests, latest, trend };
    });

  const batchName = (id) => batches.find(b => b.id === id)?.name || '—';

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h2>Assessments</h2>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <Search size={16} style={{ color: '#6B7280' }} />
          <input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 200 }} value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
          <option value="">All Batches</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Batch</th>
              <th>Tests Taken</th>
              <th>Latest Score</th>
              <th>All Scores</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>No assessment data yet. Add results from student profiles.</td></tr>
            )}
            {rows.map(({ student: s, tests, latest, trend }) => (
              <tr key={s.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={s.name} size="sm" />
                    <span style={{ fontWeight: 500 }}>{s.name}</span>
                  </div>
                </td>
                <td style={{ fontSize: 13, color: '#6B7280' }}>{batchName(s.batchId)}</td>
                <td style={{ fontSize: 13 }}>{tests.length}</td>
                <td>
                  {latest !== null && (
                    <span className={`badge ${latest >= 60 ? 'badge-green' : latest >= 40 ? 'badge-amber' : 'badge-red'}`}>
                      {latest}%
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {tests.map((t, i) => (
                      <span key={i} title={t.testName} className={`badge ${t.percentage >= 60 ? 'badge-green' : t.percentage >= 40 ? 'badge-amber' : 'badge-red'}`} style={{ fontSize: 10 }}>
                        T{i + 1}: {t.percentage}%
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  {trend === null ? (
                    <span style={{ color: '#9CA3AF', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><Minus size={14} /> —</span>
                  ) : trend > 0 ? (
                    <span style={{ color: '#10B981', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}><TrendingUp size={14} /> +{trend}%</span>
                  ) : trend < 0 ? (
                    <span style={{ color: '#EF4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}><TrendingDown size={14} /> {trend}%</span>
                  ) : (
                    <span style={{ color: '#9CA3AF', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}><Minus size={14} /> Flat</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
