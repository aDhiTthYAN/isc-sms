import { useEffect, useState } from 'react';
import { getTasks, addTask, updateTask, addNotification, getStaffProfiles } from '../firebase/services';
import { sendTaskEmail } from '../firebase/emailService';
import { Modal, Toast, Loading, FormRow } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Plus, CheckCircle2, Circle, Loader2, Mail, Search } from 'lucide-react';

const COLUMNS = [
  { key: 'pending',     label: 'Pending',     dotColor: '#9CA3AF', badgeClass: 'badge-gray' },
  { key: 'in-progress', label: 'In Progress', dotColor: 'var(--amber)', badgeClass: 'badge-amber' },
  { key: 'completed',   label: 'Completed',   dotColor: 'var(--green)', badgeClass: 'badge-green' },
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
    title: '', staffId: '', dueDate: '', priority: 'normal', notes: ''
  });
  const [search, setSearch]                 = useState('');
  const [prioFilter, setPrioFilter]         = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

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
      // Find the selected staff member — email is pulled automatically from Firestore
      const selectedStaff = staff.find(s => s.id === form.staffId);
      if (!selectedStaff) {
        setToast({ message: 'Please select a staff member.', type: 'error' });
        setSaving(false);
        return;
      }

      const taskData = {
        title:          form.title,
        assignedTo:     selectedStaff.name,
        assignedToEmail:selectedStaff.email,  // auto from Firestore, no manual entry
        dueDate:        form.dueDate,
        priority:       form.priority,
        notes:          form.notes,
        assignedBy:     profile?.name,
        assignedByEmail:user?.email,
      };

      await addTask(taskData);

      // In-app notification — appears in staff's bell icon instantly
      await addNotification({
        toEmail:  selectedStaff.email,
        toName:   selectedStaff.name,
        fromName: profile?.name,
        type:     'task',
        message:  `New task: "${form.title}"${form.dueDate ? ` — due ${form.dueDate}` : ''}`,
      });

      // Email notification — goes to staff's registered email automatically
      await sendTaskEmail({
        toEmail:    selectedStaff.email,
        toName:     selectedStaff.name,
        taskTitle:  form.title,
        dueDate:    form.dueDate,
        priority:   form.priority,
        assignedBy: profile?.name,
      });

      setToast({ message: `Task assigned to ${selectedStaff.name}! Email sent to ${selectedStaff.email}`, type: 'success' });
      setShowModal(false);
      setForm({ title: '', staffId: '', dueDate: '', priority: 'normal', notes: '' });
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

  const allFiltered = tasks.filter(t => {
    const q = search.toLowerCase();
    if (q && !t.title?.toLowerCase().includes(q) && !t.assignedTo?.toLowerCase().includes(q)) return false;
    if (prioFilter && t.priority !== prioFilter) return false;
    if (assigneeFilter && t.assignedTo !== assigneeFilter) return false;
    return true;
  });
  const grouped = { pending: [], 'in-progress': [], completed: [] };
  allFiltered.forEach(t => { (grouped[t.status] || grouped.pending).push(t); });

  const staffNames = [...new Set(tasks.map(t => t.assignedTo).filter(Boolean))];

  const rawCounts = {
    total:      tasks.length,
    pending:    tasks.filter(t => !t.status || t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    completed:  tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0 }}>Staff Tasks</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Manage and track team assignments across all projects.
          </p>
        </div>
        {isCEOorAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Assign Task
          </button>
        )}
      </div>

      {/* KPI Strip — CEO/admin only */}
      {isCEOorAdmin && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Tasks', value: rawCounts.total,      bg: 'var(--brand)',      color: '#fff' },
            { label: 'Pending',     value: rawCounts.pending,    bg: 'var(--amber-soft)', color: 'var(--amber-ink)' },
            { label: 'In Progress', value: rawCounts.inProgress, bg: 'var(--blue-soft)',  color: 'var(--blue-ink)'  },
            { label: 'Completed',   value: rawCounts.completed,  bg: 'var(--green-soft)', color: 'var(--green-ink)' },
          ].map(tile => (
            <div key={tile.label} style={{
              flex: '1 1 140px', background: tile.bg, color: tile.color,
              borderRadius: 12, padding: '14px 18px', minWidth: 120,
            }}>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{tile.value}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{tile.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Info Banner — CEO/admin only */}
      {isCEOorAdmin && (
        <div style={{
          padding: '10px 14px', background: 'var(--blue-soft)', borderRadius: 10,
          fontSize: 12, color: 'var(--blue-ink)', marginBottom: 16,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <Mail size={14} />
          Staff receive an email + in-app notification instantly when you assign a task. Email is pulled automatically from their account.
        </div>
      )}

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-input"
          style={{ width: 160 }}
          value={prioFilter}
          onChange={e => setPrioFilter(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
        </select>
        <select
          className="form-input"
          style={{ width: 180 }}
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
        >
          <option value="">All Staff</option>
          {staffNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Kanban Board */}
      <div className="grid-3" style={{ alignItems: 'start' }}>
        {COLUMNS.map(col => {
          const colTasks = grouped[col.key] || [];
          return (
            <div key={col.key} style={{
              background: 'var(--surface)',
              borderRadius: 14,
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}>
              {/* Column Header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: col.dotColor, flexShrink: 0,
                }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', flex: 1 }}>
                  {col.label}
                </span>
                <span className={`badge ${col.badgeClass}`}>{colTasks.length}</span>
              </div>

              {/* Column Body */}
              <div style={{
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: 200,
                maxHeight: 600,
                overflowY: 'auto',
              }}>
                {colTasks.length === 0 && (
                  <div style={{
                    textAlign: 'center', color: 'var(--text-muted)',
                    fontSize: 13, padding: '32px 0',
                  }}>
                    No tasks
                  </div>
                )}
                {colTasks.map(task => (
                  <div
                    key={task.id}
                    style={{
                      background: 'var(--surface)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                  >
                    {/* Top row: title + priority badge */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, flex: 1, color: 'var(--text)', lineHeight: 1.4 }}>
                        {task.title}
                      </span>
                      {task.priority === 'urgent' && <span className="badge badge-red">Urgent</span>}
                      {task.priority === 'high'   && <span className="badge badge-amber">High</span>}
                    </div>

                    {/* Meta row */}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: task.notes ? 6 : 8 }}>
                      {task.assignedTo}
                      {task.dueDate && <span style={{ marginLeft: 8 }}>{task.dueDate}</span>}
                    </div>

                    {/* Notes */}
                    {task.notes && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8 }}>
                        {task.notes}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {col.key !== 'pending' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => moveTask(task.id, col.key === 'in-progress' ? 'pending' : 'in-progress')}
                        >
                          Back
                        </button>
                      )}
                      {col.key !== 'completed' && (
                        <button
                          style={{
                            fontSize: 11, padding: '4px 10px',
                            background: '#D1FAE5', color: '#065F46',
                            border: 'none', borderRadius: 6, cursor: 'pointer',
                          }}
                          onClick={() => moveTask(task.id, col.key === 'pending' ? 'in-progress' : 'completed')}
                        >
                          {col.key === 'pending' ? 'Start ' : 'Complete '}
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

      {/* Modal: Assign Task */}
      {showModal && (
        <Modal title="Assign Task to Staff" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '10px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 12, color: '#065F46' }}>
              Staff email is pulled automatically from their account — you just select their name.
            </div>
            <div className="form-group">
              <label className="form-label">Task Title *</label>
              <input className="form-input" required placeholder="e.g. Call 20 at-risk students"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Assign To *</label>
              <select className="form-input" required value={form.staffId}
                onChange={e => setForm({ ...form, staffId: e.target.value })}>
                <option value="">Select staff member</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.role}
                  </option>
                ))}
              </select>
              {form.staffId && (
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                  Email notification will go to: <strong>{staff.find(s => s.id === form.staffId)?.email}</strong>
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
