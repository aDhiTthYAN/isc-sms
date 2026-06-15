import { useEffect, useState } from 'react';
import { getTrashItems, restoreFromTrash, permanentDelete } from '../firebase/services';
import { Loading, Toast } from '../components/ui';
import { Trash2, RotateCcw } from 'lucide-react';

export default function Trash() {
  const [tab, setTab]         = useState('student');
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null);
  const [busy, setBusy]       = useState(false);

  const load = async (type) => {
    setLoading(true);
    try {
      setItems(await getTrashItems(type));
    } catch { setItems([]); }
    setLoading(false);
  };

  useEffect(() => { load(tab); }, [tab]);

  const handleRestore = async (item) => {
    if (!window.confirm('Restore this item?')) return;
    setBusy(true);
    try {
      await restoreFromTrash(item.id, item.type, item.originalId, item.data);
      setToast({ message: 'Restored successfully!', type: 'success' });
      load(tab);
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setBusy(false);
  };

  const handlePermDelete = async (item) => {
    if (!window.confirm('Permanently delete? This cannot be undone.')) return;
    setBusy(true);
    try {
      await permanentDelete(item.id);
      setToast({ message: 'Permanently deleted.', type: 'success' });
      load(tab);
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setBusy(false);
  };

  const handleDeleteAll = async () => {
    if (items.length === 0) return;
    if (!window.confirm(`Permanently delete all ${items.length} item(s) in ${tab}s? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await Promise.all(items.map(item => permanentDelete(item.id)));
      setToast({ message: `All ${tab}s permanently deleted.`, type: 'success' });
      load(tab);
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setBusy(false);
  };

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      <div className="page-header">
        <h2><Trash2 size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />Trash</h2>
        {items.length > 0 && (
          <button
            className="btn btn-sm"
            style={{ background: '#EF4444', color: '#fff', border: 'none' }}
            disabled={busy}
            onClick={handleDeleteAll}
          >
            <Trash2 size={13} /> Delete All ({items.length})
          </button>
        )}
      </div>

      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {[
          { key: 'student', label: 'Students' },
          { key: 'batch',   label: 'Batches'  },
        ].map(t => (
          <div key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {loading ? <Loading /> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                {tab === 'student' && <th>Batch</th>}
                <th>Deleted Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>Trash is empty.</td></tr>
              )}
              {items.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.data?.name || item.data?.batchName || '—'}</td>
                  {tab === 'student' && <td style={{ color: '#6B7280' }}>{item.data?.batchName || '—'}</td>}
                  <td style={{ color: '#6B7280' }}>{formatDate(item.deletedAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-sm btn-ghost"
                        disabled={busy}
                        onClick={() => handleRestore(item)}
                      >
                        <RotateCcw size={13} /> Restore
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ background: '#EF4444', color: '#fff', border: 'none' }}
                        disabled={busy}
                        onClick={() => handlePermDelete(item)}
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
