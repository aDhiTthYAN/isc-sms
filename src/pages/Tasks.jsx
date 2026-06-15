import { useEffect, useState } from 'react';
import { getTasks, addTask, updateTask, addNotification, getStaffProfiles } from '../firebase/services';
import { sendTaskEmail } from '../firebase/emailService';
import { Modal, Toast, Loading, FormRow } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Plus, CheckCircle2, Circle, Loader2, Mail } from 'lucide-react';

const COLUMNS = [
  { key: 'pending',     label: 'Pending',     color: '#9CA3AF', icon: Circle },
  { key: 'in-progress', label: 'In Progress', color: '#F59E0B', icon: Loader2 },
  { key: 'completed',   label: 'Completed',   color: '#10B981', icon: CheckCircle2 },
];

export default function Tasks() {
  const { profile, user } = useAuth();
  const [tasks, setTasks]         = useState([]);
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({
    title: '', staffIds: [], dueDate: '', priority: 'normal', notes: ''
  });

  const toggleStaff = (id) => {
    setForm(prev => ({
      ...prev,
      staffIds: prev.staffIds.includes(id)
        ? prev.staffIds.filter(x => x !== id)
        : [...prev.staffIds, id],
    }));
  };

  const isCEOorAdmin = profile?.role === 'ceo' || profile?.role === 'admin';

  const load = async () => {
    const [allTasks, allStaff] = await Promise.all([getTasks(), getStaffProfiles()]);
    // Staff only see their own tasks (matched by their login email)
    if (!isCEOorAdmin) {
      setTasks(allTasks.filter(t => t.assignedToEmail === user?.email));
    } else {
      setTasks(allTasks);
    }
    setStaff(allStaff.filter(s => s.active !== false && s.role !== 'ceo'));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const selectedStaff = staff.filter(s => form.staffIds.includes(s.id));
      if (selectedStaff.length === 0) {
        setToast({ message: 'Please select at least one staff member.', type: 'error' });
        setSaving(false);
        return;
      }

      const notifMessage = `New task assigned by ${profile?.name}: "${form.title}"${form.dueDate ? ` — due ${form.dueDate}` : ''}${form.notes ? ` | ${form.notes}` : ''}`;

      await Promise.all(selectedStaff.map(async (s) => {
        await addTask({
          title:           form.title,
          assignedTo:      s.name,
          assignedToEmail: s.email,
          dueDate:         form.dueDate,
          priority:        form.priority,
          notes:           form.notes,
          assignedBy:      profile?.name,
          assignedByEmail: user?.email,
        });

        addNotification({
          toEmail:  s.email,
          toName:   s.name,
          fromName: profile?.name,
          type:     'task',
          message:  notifMessage,
        }).catch(() => {});

        sendTaskEmail({
          toEmail:    s.email,
          toName:     s.name,
          taskTitle:  form.title,
          dueDate:    form.dueDate,
          priority:   form.priority,
          assignedBy: profile?.name,
        }).catch(() => {});
      }));

      const names = selectedStaff.map(s => s.name).join(', ');
      setToast({ message: `Task assigned to ${names}!`, type: 'success' });
      setShowModal(false);
      setForm({ title: '', staffIds: [], dueDate: '', priority: 'normal', notes: '' });
      load();
    } catch (err) {
      setToast({ message: 'Failed to assign task: ' + err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const moveTask = async (id, newStatus) => {
    await updateTask(id, { status: newStatus });
    load();
  };

  if (loading) return <Loading />;

  const grouped = { pending: [], 'in-progress': [], completed: [] };
  tasks.forEach(t => { (grouped[t.status] || grouped.pending).push(t); });

  return (
    <div>
      <div className="page-header">
        <h2>Staff Tasks</h2>
        {isCEOorAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Assign Task
          </button>
        )}
      </div>

      {isCEOorAdmin && (
        <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, fontSize: 12, color: '#1E40AF', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Mail size={14} />
          Staff receive an email + in-app notification instantly when you assign a task. Email is pulled automatically from their account.
        </div>
      )}

      <div className="grid-3" style={{ alignItems: 'start' }}>
        {COLUMNS.map(col => {
          const Icon = col.icon;
          const colTasks = grouped[col.key] || [];
          return (
            <div key={col.key} style={{ background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: 'var(--white)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={15} style={{ color: col.color }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{col.label}</span>
                <span className={`badge ${col.key === 'completed' ? 'badge-green' : col.key === 'in-progress' ? 'badge-amber' : 'badge-gray'}`} style={{ marginLeft: 'auto' }}>
                  {colTasks.length}
                </span>
              </div>
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
                {colTasks.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '20px 0' }}>No tasks</div>
                )}
                {colTasks.map(task => (
                  <div key={task.id} style={{ background: 'var(--white)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 500, fontSize: 13, flex: 1, lineHeight: 1.4 }}>{task.title}</span>
                      {task.priority === 'urgent' && <span className="badge badge-red">Urgent</span>}
                      {task.priority === 'high'   && <span className="badge badge-amber">High</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                      👤 {task.assignedTo}
                      {task.dueDate && <span style={{ marginLeft: 8 }}>📅 {task.dueDate}</span>}
                    </div>
                    {task.notes && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontStyle: 'italic' }}>{task.notes}</div>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {col.key !== 'pending' && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                          onClick={() => moveTask(task.id, col.key === 'in-progress' ? 'pending' : 'in-progress')}>
                          ← Back
                        </button>
                      )}
                      {col.key !== 'completed' && (
                        <button style={{ fontSize: 11, padding: '4px 8px', background: '#D1FAE5', color: '#065F46', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                          onClick={() => moveTask(task.id, col.key === 'pending' ? 'in-progress' : 'completed')}>
                          {col.key === 'pending' ? 'Start →' : 'Complete ✓'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <Modal title="Assign Task to Staff" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '10px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 12, color: '#065F46' }}>
              ✅ Staff email is pulled automatically from their account — you just select their name.
            </div>
            <div className="form-group">
              <label className="form-label">Task Title *</label>
              <input className="form-input" required placeholder="e.g. Call 20 at-risk students"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Assign To * <span style={{ fontWeight: 400, color: '#6B7280' }}>(select one or more)</span></label>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {staff.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.staffIds.includes(s.id)} onChange={() => toggleStaff(s.id)} />
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{s.role}</span>
                  </label>
                ))}
              </div>
              {form.staffIds.length > 0 && (
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                  📧 Notifying {form.staffIds.length} staff member{form.staffIds.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
            <FormRow>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input className="form-input" type="date" value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-input" value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </FormRow>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} placeholder="Additional instructions..."
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Assigning...' : <><Mail size={14} /> Assign & Notify</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}