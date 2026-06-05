import { useEffect, useState } from 'react';
import { getRequests, updateRequest, updateBatch, addNotification, getBatch } from '../firebase/services';
import { Loading, Toast } from '../components/ui';
import { Inbox } from 'lucide-react';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [busy,     setBusy]     = useState(false);
  const [filter,   setFilter]   = useState('pending');

  const load = async () => {
    setLoading(true);
    try {
      setRequests(await getRequests(filter || undefined));
    } catch { setRequests([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleAccept = async (req) => {
    if (!window.confirm('Accept this removal request?')) return;
    setBusy(true);
    try {
      // Remove staff from batch if targetType === 'batch'
      if (req.targetType === 'batch') {
        const batch = await getBatch(req.targetId);
        if (batch) {
          const updatedStaffIds = (batch.staffIds || []).filter(id => id !== req.requestedBy);
          const updatedStaffDetails = (batch.staffDetails || []).filter(s => s.uid !== req.requestedBy);
          await updateBatch(req.targetId, { staffIds: updatedStaffIds, staffDetails: updatedStaffDetails });
        }
      }
      await updateRequest(req.id, { status: 'accepted' });
      // Notify staff
      if (req.requestedByEmail) {
        await addNotification({
          toEmail: req.requestedByEmail, title: 'Removal Request Accepted',
          body: `Your removal request from ${req.targetName} has been accepted.`,
          type: 'request_update', read: false,
        });
      }
      setToast({ message: 'Request accepted.', type: 'success' });
      load();
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
    setBusy(false);
  };

  const handleReject = async (req) => {
    setBusy(true);
    try {
      await updateRequest(req.id, { status: 'rejected' });
      if (req.requestedByEmail) {
        await addNotification({
          toEmail: req.requestedByEmail, title: 'Removal Request Rejected',
          body: `Your removal request from ${req.targetName} was not approved.`,
          type: 'request_update', read: false,
        });
      }
      setToast({ message: 'Request rejected.', type: 'success' });
      load();
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

  const statusColor = (s) => s === 'pending' ? { bg:'#FEF3C7', col:'#92400E' } : s === 'accepted' ? { bg:'#D1FAE5', col:'#065F46' } : { bg:'#FEE2E2', col:'#991B1B' };

  return (
    <div>
      <div className="page-header">
        <h2><Inbox size={20} style={{ marginRight:8, verticalAlign:'middle' }} />Staff Requests</h2>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['pending','accepted','rejected',''].map(s => (
          <button key={s||'all'} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(s)}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Staff Name</th><th>Request Type</th><th>Target</th><th>Reason</th><th>Date</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'#9CA3AF', padding:40 }}>No requests found.</td></tr>
              )}
              {requests.map(req => {
                const sc = statusColor(req.status);
                return (
                  <tr key={req.id}>
                    <td style={{ fontWeight:600 }}>{req.requestedByName || '—'}</td>
                    <td style={{ color:'#6B7280', textTransform:'capitalize' }}>{req.type} ({req.targetType})</td>
                    <td style={{ color:'#6B7280' }}>{req.targetName || '—'}</td>
                    <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#374151' }}>{req.reason || '—'}</td>
                    <td style={{ color:'#6B7280' }}>{formatDate(req.createdAt)}</td>
                    <td>
                      <span style={{ fontSize:11, padding:'2px 9px', borderRadius:10, fontWeight:600, background:sc.bg, color:sc.col, textTransform:'capitalize' }}>
                        {req.status}
                      </span>
                    </td>
                    <td>
                      {req.status === 'pending' && (
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-sm" style={{ background:'#D1FAE5', color:'#065F46', border:'none' }}
                            disabled={busy} onClick={() => handleAccept(req)}>Accept</button>
                          <button className="btn btn-sm" style={{ background:'#FEE2E2', color:'#991B1B', border:'none' }}
                            disabled={busy} onClick={() => handleReject(req)}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
