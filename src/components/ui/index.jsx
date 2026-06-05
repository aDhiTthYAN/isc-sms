import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// ── Modal ──────────────────────────────────────────────────────
export function Modal({ title, onClose, children, wide }) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // stable — only mounts/unmounts with the modal

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}>
      <div className="modal" style={wide ? { maxWidth: 680 } : {}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────
export function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = { success: '#10B981', error: '#EF4444', info: '#3B82F6' };
  return (
    <div className="toast" style={{ borderLeft: `4px solid ${colors[type] || colors.info}` }}>
      {message}
    </div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────
const avatarColors = ['#E53935','#8B5CF6','#3B82F6','#10B981','#F59E0B','#EC4899','#06B6D4'];

export function Avatar({ name = '', size = 'default' }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length];
  const cls = size === 'sm' ? 'avatar avatar-sm' : size === 'lg' ? 'avatar avatar-lg' : 'avatar';
  return (
    <div className={cls} style={{ background: color }}>{initials}</div>
  );
}

// ── Status Badge ───────────────────────────────────────────────
const statusMap = {
  active:   { cls: 'badge-green',  label: '🟢 Active' },
  moderate: { cls: 'badge-amber',  label: '🟡 Moderate' },
  'at-risk':{ cls: 'badge-red',    label: '🔴 At Risk' },
  dropped:  { cls: 'badge-gray',   label: '⚫ Dropped' },
};

export function StatusBadge({ status }) {
  const s = statusMap[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

// ── Confirm Dialog ─────────────────────────────────────────────
export function Confirm({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 380 }}>
        <p style={{ marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Loading spinner ────────────────────────────────────────────
export function Loading({ text = 'Loading...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 16 }}>
      <div className="spinner" />
      <span style={{ color: '#6B7280', fontSize: 13 }}>{text}</span>
    </div>
  );
}

// ── Form Row helper ────────────────────────────────────────────
export function FormRow({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {children}
    </div>
  );
}