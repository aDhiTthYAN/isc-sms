import { useEffect, useState } from 'react';
import { getDailyReports, addReport } from '../firebase/services';
import { Toast, Loading, FormRow } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';

const STAFF_LIST = ['Priya S.', 'Arjun M.', 'Meena R.', 'John K.', 'Arun P.'];

export default function Reports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState({
    staffName: profile?.name || '',
    studentsContacted: '',
    followupsDone: '',
    newAdmissions: '',
    problemsFound: '',
    summary: '',
  });

  const load = async () => {
    const r = await getDailyReports();
    setReports(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await addReport({ ...form, date: new Date().toLocaleDateString('en-IN') });
    setToast({ message: 'Report submitted successfully!', type: 'success' });
    setForm({ staffName: profile?.name || '', studentsContacted: '', followupsDone: '', newAdmissions: '', problemsFound: '', summary: '' });
    load();
    setSaving(false);
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // Group by date
  const grouped = {};
  reports.forEach(r => {
    const key = r.date || formatDate(r.createdAt);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h2>Daily Staff Reports</h2>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Submit form */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>📝 Submit Today's Report</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Staff Name *</label>
              <select className="form-input" required value={form.staffName} onChange={e => setForm({ ...form, staffName: e.target.value })}>
                <option value="">Select your name</option>
                {STAFF_LIST.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Students Contacted</label>
                <input className="form-input" type="number" min="0" placeholder="0" value={form.studentsContacted} onChange={e => setForm({ ...form, studentsContacted: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Follow-Ups Done</label>
                <input className="form-input" type="number" min="0" placeholder="0" value={form.followupsDone} onChange={e => setForm({ ...form, followupsDone: e.target.value })} />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">New Admissions</label>
                <input className="form-input" type="number" min="0" placeholder="0" value={form.newAdmissions} onChange={e => setForm({ ...form, newAdmissions: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Problems Found</label>
                <input className="form-input" type="number" min="0" placeholder="0" value={form.problemsFound} onChange={e => setForm({ ...form, problemsFound: e.target.value })} />
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Summary / Notes</label>
              <textarea className="form-input" rows={4} placeholder="What did you accomplish today? Any important updates for the CEO?" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
              <Send size={15} /> {saving ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        </div>

        {/* CEO view */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: '#6B7280' }}>
            📊 All Reports ({reports.length} total)
          </h3>
          {Object.keys(grouped).length === 0 && (
            <div className="card" style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>No reports submitted yet.</div>
          )}
          {Object.entries(grouped).map(([date, dayReports]) => (
            <div key={date} style={{ marginBottom: 12 }}>
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [date]: !prev[date] }))}
                style={{
                  width: '100%', padding: '10px 16px',
                  background: '#fff', border: '1px solid #E5E7EB',
                  borderRadius: expanded[date] ? '10px 10px 0 0' : 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', fontWeight: 600, fontSize: 14
                }}
              >
                <span>📅 {date}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 400 }}>{dayReports.length} report{dayReports.length > 1 ? 's' : ''}</span>
                  {expanded[date] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {expanded[date] && (
                <div style={{ border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                  {dayReports.map((r, i) => (
                    <div key={r.id} style={{
                      padding: '14px 16px',
                      borderBottom: i < dayReports.length - 1 ? '1px solid #F3F4F6' : 'none',
                      background: '#FAFAFA'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{r.staffName}</span>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{formatTime(r.createdAt)}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                        {[
                          { label: 'Contacted', value: r.studentsContacted, color: '#3B82F6' },
                          { label: 'Follow-ups', value: r.followupsDone, color: '#8B5CF6' },
                          { label: 'Admissions', value: r.newAdmissions, color: '#10B981' },
                          { label: 'Problems', value: r.problemsFound, color: '#EF4444' },
                        ].map(item => (
                          <div key={item.label} style={{ background: '#fff', borderRadius: 8, padding: '8px 12px', border: '1px solid #E5E7EB' }}>
                            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>{item.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk', color: item.color }}>
                              {r[item.label === 'Contacted' ? 'studentsContacted' : item.label === 'Follow-ups' ? 'followupsDone' : item.label === 'Admissions' ? 'newAdmissions' : 'problemsFound'] || 0}
                            </div>
                          </div>
                        ))}
                      </div>
                      {r.summary && (
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                          {r.summary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
