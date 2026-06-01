import { useEffect, useState, useRef } from 'react';
import { getStudents } from '../firebase/services';
import {
  ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject
} from 'firebase/storage';
import { storage } from '../firebase/config';
import { Modal, Toast, Loading, Confirm } from '../components/ui';
import { Upload, File, Download, Trash2, Search, FileText, FileImage, Plus } from 'lucide-react';

const DOC_TYPES = ['Admission Form', 'ID Proof', 'Certificate', 'Test Report', 'Assessment PDF', 'Internal Document', 'Other'];

function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return <FileImage size={18} style={{ color: '#8B5CF6' }} />;
  return <FileText size={18} style={{ color: '#E53935' }} />;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function Documents() {
  const [students, setStudents] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [form, setForm] = useState({ studentId: '', docType: '', file: null });
  const fileRef = useRef();

  const loadDocs = async () => {
    try {
      const listRef = ref(storage, 'documents/');
      const res = await listAll(listRef);
      const items = await Promise.all(res.items.map(async item => {
        const url = await getDownloadURL(item);
        const meta = item.name;
        const parts = meta.split('__');
        return {
          fullPath: item.fullPath,
          name: item.name,
          url,
          studentId: parts[0] || '',
          docType: parts[1] || 'Document',
          fileName: parts[2] || item.name,
        };
      }));
      setDocs(items);
    } catch {
      setDocs([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    Promise.all([getStudents()]).then(([s]) => {
      setStudents(s);
      loadDocs();
    });
  }, []);

  const studentName = (id) => students.find(s => s.id === id)?.name || id || 'Unknown';

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.file || !form.studentId) return;
    setUploading(true);
    const safeName = `${form.studentId}__${form.docType}__${form.file.name}`;
    const storageRef = ref(storage, `documents/${safeName}`);
    const task = uploadBytesResumable(storageRef, form.file);
    task.on('state_changed',
      snap => setProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      () => { setToast({ message: 'Upload failed.', type: 'error' }); setUploading(false); },
      async () => {
        setToast({ message: 'Document uploaded!', type: 'success' });
        setUploading(false);
        setProgress(0);
        setShowModal(false);
        setForm({ studentId: '', docType: '', file: null });
        loadDocs();
      }
    );
  };

  const handleDelete = async () => {
    const docRef = ref(storage, deleting);
    await deleteObject(docRef);
    setDeleting(null);
    setToast({ message: 'Document deleted.', type: 'info' });
    loadDocs();
  };

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !q || studentName(d.studentId).toLowerCase().includes(q) || d.docType.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q);
    const matchS = !studentFilter || d.studentId === studentFilter;
    return matchQ && matchS;
  });

  if (loading) return <Loading />;

  return (
    <div>
      <div className="page-header">
        <h2>Document Repository <span style={{ fontSize: 16, color: '#6B7280', fontWeight: 400 }}>({filtered.length})</span></h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Upload size={16} /> Upload Document</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <Search size={16} style={{ color: '#6B7280' }} />
          <input placeholder="Search by student, document type, filename..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-input" style={{ width: 200 }} value={studentFilter} onChange={e => setStudentFilter(e.target.value)}>
          <option value="">All Students</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr><th>Document</th><th>Student</th><th>Type</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>
                No documents uploaded yet.
              </td></tr>
            )}
            {filtered.map((doc, i) => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {fileIcon(doc.fileName)}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{doc.fileName}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 13, fontWeight: 500 }}>{studentName(doc.studentId)}</td>
                <td><span className="badge badge-blue">{doc.docType}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a href={doc.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm btn-icon" title="Download">
                      <Download size={14} />
                    </a>
                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#EF4444' }} onClick={() => setDeleting(doc.fullPath)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Upload Document" onClose={() => setShowModal(false)}>
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Student *</label>
              <select className="form-input" required value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })}>
                <option value="">Select student</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Document Type *</label>
              <select className="form-input" required value={form.docType} onChange={e => setForm({ ...form, docType: e.target.value })}>
                <option value="">Select type</option>
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">File *</label>
              <input ref={fileRef} type="file" style={{ display: 'none' }}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => setForm({ ...form, file: e.target.files[0] })} />
              <div
                onClick={() => fileRef.current.click()}
                style={{
                  border: '2px dashed #E5E7EB', borderRadius: 10, padding: '20px',
                  textAlign: 'center', cursor: 'pointer', transition: 'border 0.15s',
                  background: form.file ? '#F0FDF4' : '#FAFAFA'
                }}
              >
                {form.file ? (
                  <div style={{ color: '#065F46', fontSize: 13, fontWeight: 500 }}>
                    ✅ {form.file.name} ({formatBytes(form.file.size)})
                  </div>
                ) : (
                  <div style={{ color: '#6B7280', fontSize: 13 }}>
                    <Upload size={20} style={{ margin: '0 auto 6px', display: 'block' }} />
                    Click to select a file (PDF, JPG, PNG, DOC)
                  </div>
                )}
              </div>
            </div>
            {uploading && (
              <div>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Uploading... {progress}%</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%`, background: '#10B981' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={uploading || !form.file || !form.studentId}>
                {uploading ? `Uploading ${progress}%...` : <><Upload size={14} /> Upload</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Confirm
          message="Delete this document? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
