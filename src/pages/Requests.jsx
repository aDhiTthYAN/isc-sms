import { useEffect, useState } from 'react';
import { getRequests, updateRequest, updateBatch, addNotification, getBatch } from '../firebase/services';
import { Loading, Toast } from '../components/ui';
import { Inbox, UserMinus, CalendarDays, ClipboardCheck, KeyRound } from 'lucide-react';

const TYPE_META = {
  removal:    { label:'Removal',    cls:'badge-red',    Icon: UserMinus },
  leave:      { label:'Leave',      cls:'badge-blue',   Icon: CalendarDays },
  assessment: { label:'Assessment', cls:'badge-violet', Icon: ClipboardCheck },
  access:     { label:'Access',     cls:'badge-amber',  Icon: KeyRound },
};
const typeBg = { removal:'var(--red-soft)', leave:'var(--blue-soft)', assessment:'var(--violet-soft)', access:'var(--amber-soft)' };
const typeInk = { removal:'var(--red-ink)', leave:'var(--blue-ink)', assessment:'var(--violet-ink)', access:'var(--amber-ink)' };

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

  const STATUS = {
    pending:  { label:'Pending',  cls:'badge-amber' },
    accepted: { label:'Accepted', cls:'badge-green' },
    rejected: { label:'Rejected', cls:'badge-red'   },
  };

  const counts = {
    all:      requests.length,
    pending:  requests.filter(r => (r.status || 'pending') === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };
  const TABS = [
    { key:'pending',  label:'Pending'  },
    { key:'accepted', label:'Accepted' },
    { key:'rejected', label:'Rejected' },
    { key:'',         label:'All'      },
  ];

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:18 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <h2 style={{ fontSize:24, fontWeight:700 }}>Staff Requests</h2>
            {counts.pending > 0 && <span className="badge badge-amber"><span className="dot" />{counts.pending} pending</span>}
          </div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>Review and approve requests raised by your team.</div>
        </div>
        <div className="segmented">
          {TABS.map(t => (
            <button key={t.key || 'all'} className={filter === t.key ? 'active' : ''} onClick={() => setFilter(t.key)}>
              {t.label}<span className="seg-count">{counts[t.key || 'all']}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? <Loading /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:860 }}>
          {requests.length === 0 && (
            <div style={{ padding:'48px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:13.5, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14 }}>
              No requests in this view.
            </div>
          )}
          {requests.map(req => {
            const meta = TYPE_META[req.type] || { label: req.type || 'Request', cls:'badge-gray', Icon: Inbox };
            const Icon = meta.Icon;
            const st = STATUS[req.status] || STATUS.pending;
            const pending = (req.status || 'pending') === 'pending';
            return (
              <div key={req.id} className="card" style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div style={{ width:40, height:40, borderRadius:11, background: typeBg[req.type] || 'var(--surface-sunken)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Icon size={18} style={{ color: typeInk[req.type] || 'var(--text-sub)' }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:14, fontWeight:600 }}>{req.title || `${meta.label} request`}{req.targetName ? ` · ${req.targetName}` : ''}</span>
                      <span className="chip">{meta.label}</span>
                    </div>
                    <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>
                      From <b style={{ color:'var(--text)', fontWeight:600 }}>{req.requestedByName || '—'}</b> &nbsp;·&nbsp; {formatDate(req.createdAt)}
                    </div>
                    {req.reason && (
                      <div style={{ fontSize:12.5, color:'var(--text-sub)', marginTop:8, background:'var(--surface-sunken)', borderRadius:9, padding:'9px 12px' }}>{req.reason}</div>
                    )}
                  </div>
                  <div style={{ flexShrink:0 }}>
                    {pending ? (
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => handleReject(req)}>Reject</button>
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => handleAccept(req)}>Approve</button>
                      </div>
                    ) : (
                      <span className={`badge ${st.cls}`}><span className="dot" />{st.label}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
