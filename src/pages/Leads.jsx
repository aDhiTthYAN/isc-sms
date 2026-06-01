import { useEffect, useState } from 'react';
import { getLeads, addLead, updateLead } from '../firebase/services';
import { Modal, Toast, Loading, FormRow } from '../components/ui';
import { Plus, Search, ArrowRight } from 'lucide-react';

const STAGES = ['lead', 'counselling', 'demo', 'enrolled', 'active'];
const STAGE_LABELS = { lead: 'Lead', counselling: 'Counselling', demo: 'Demo Class', enrolled: 'Enrolled', active: 'Active Student' };
const STAGE_COLORS = { lead: '#1A1A2E', counselling: '#374151', demo: '#E53935', enrolled: '#B71C1C', active: '#7B0000' };
const COURSES = ['Python', 'Data Science', 'Web Development', 'Machine Learning', 'Digital Marketing', 'Other'];

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', course: '', source: '', notes: '' });

  const load = async () => {
    const l = await getLeads();
    setLeads(l);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.course?.toLowerCase().includes(q);
    const matchS = !stageFilter || l.stage === stageFilter;
    return matchQ && matchS;
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    await addLead(form);
    setToast({ message: 'Lead added!', type: 'success' });
    setShowModal(false);
    setForm({ name: '', phone: '', email: '', course: '', source: '', notes: '' });
    load();
    setSaving(false);
  };

  const advanceStage = async (lead) => {
    const idx = STAGES.indexOf(lead.stage);
    if (idx < STAGES.length - 1) {
      await updateLead(lead.id, { stage: STAGES[idx + 1] });
      load();
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  // Funnel counts
  const stageCounts = {};
  STAGES.forEach(s => { stageCounts[s] = leads.filter(l => l.stage === s).length; });
  const totalLeads = leads.length || 1;

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h2>Lead Pipeline</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Lead</button>
      </div>

      {/* Funnel */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Conversion Funnel</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STAGES.map(stage => {
            const count = stageCounts[stage];
            const pct = Math.max(5, Math.round(count / totalLeads * 100));
            return (
              <div key={stage} className="funnel-stage">
                <div className="funnel-label">{STAGE_LABELS[stage]}</div>
                <div className="funnel-track">
                  <div className="funnel-bar" style={{ width: `${pct}%`, background: STAGE_COLORS[stage] }}>
                    {count > 0 && `${count} ${count === 1 ? 'person' : 'people'}`}
                  </div>
                </div>
                <div className="funnel-count">{count}</div>
              </div>
            );
          })}
        </div>
        {leads.length > 0 && (
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#FEE2E2', borderRadius: 8, fontSize: 13, color: '#991B1B' }}>
            <strong>{Math.round(stageCounts['active'] / totalLeads * 100)}% conversion rate</strong> — {stageCounts['active']} out of {leads.length} leads became active students.
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <Search size={16} style={{ color: '#6B7280' }} />
          <input placeholder="Search name, phone, course..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 180 }} value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr><th>Name</th><th>Phone</th><th>Course</th><th>Source</th><th>Stage</th><th>Added</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>No leads found.</td></tr>
            )}
            {filtered.map(lead => {
              const stageIdx = STAGES.indexOf(lead.stage);
              return (
                <tr key={lead.id}>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{lead.name}</div>
                    {lead.email && <div style={{ fontSize: 11, color: '#6B7280' }}>{lead.email}</div>}
                  </td>
                  <td style={{ fontSize: 13 }}>{lead.phone || '—'}</td>
                  <td style={{ fontSize: 13 }}>{lead.course || '—'}</td>
                  <td style={{ fontSize: 13, color: '#6B7280' }}>{lead.source || '—'}</td>
                  <td>
                    <span style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: STAGE_COLORS[lead.stage], color: '#fff'
                    }}>{STAGE_LABELS[lead.stage]}</span>
                  </td>
                  <td style={{ fontSize: 12, color: '#6B7280' }}>{formatDate(lead.createdAt)}</td>
                  <td>
                    {stageIdx < STAGES.length - 1 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => advanceStage(lead)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        {STAGE_LABELS[STAGES[stageIdx + 1]]} <ArrowRight size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Add New Lead" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-input" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </FormRow>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Course Interested In</label>
                <select className="form-input" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })}>
                  <option value="">Select</option>
                  {COURSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Source</label>
                <select className="form-input" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                  <option value="">Select</option>
                  <option>Instagram</option>
                  <option>WhatsApp</option>
                  <option>Referral</option>
                  <option>Walk-in</option>
                  <option>Website</option>
                  <option>Other</option>
                </select>
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any additional info..." />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Lead'}</button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
