import { useState, useRef } from 'react';
import { addStudent, getBatches } from '../firebase/services';
import { Toast } from '../components/ui';
import { Upload, Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const REQUIRED = ['name', 'phone', 'course'];
const TEMPLATE_HEADERS = ['name','phone','parentPhone','email','course','batchName','joiningDate','location','education','staffAssigned','classplusId','status','notes'];

function downloadTemplate() {
  const csv = TEMPLATE_HEADERS.join(',') + '\n' +
    'Fathima Aysha,+91 98432 11234,+91 94432 98765,fathima@email.com,Python,Python Batch A,2026-01-01,Kochi,B.Sc CS,Priya S.,CP-2401,active,Good student\n' +
    'Rahul Kumar,+91 94472 88765,,rahul@email.com,Data Science,Data Science B,2026-02-15,Ernakulam,B.Tech,Arjun M.,CP-2402,active,';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'isc_students_template.csv'; a.click();
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (vals.every(v => !v)) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

export default function BulkImport() {
  const [preview, setPreview] = useState(null);   // parsed rows
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);   // { success, failed }
  const [toast, setToast] = useState(null);
  const [batches, setBatches] = useState([]);
  const fileRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    const errs = [];
    rows.forEach((row, i) => {
      REQUIRED.forEach(field => {
        if (!row[field]) errs.push(`Row ${i + 2}: missing '${field}'`);
      });
    });
    setErrors(errs);
    setPreview(rows);
    setResults(null);
    const b = await getBatches();
    setBatches(b);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    let success = 0, failed = 0;
    for (const row of preview) {
      try {
        const batch = batches.find(b => b.name?.toLowerCase() === row.batchname?.toLowerCase());
        await addStudent({
          name: row.name,
          phone: row.phone,
          parentPhone: row.parentphone || '',
          email: row.email || '',
          course: row.course,
          batchId: batch?.id || '',
          joiningDate: row.joiningdate || '',
          location: row.location || '',
          education: row.education || '',
          staffAssigned: row.staffassigned || '',
          classplusId: row.classplusid || '',
          status: row.status || 'active',
          notes: row.notes || '',
        });
        success++;
      } catch {
        failed++;
      }
    }
    setResults({ success, failed });
    setImporting(false);
    setPreview(null);
    setErrors([]);
    setToast({ message: `Import complete: ${success} added, ${failed} failed.`, type: success > 0 ? 'success' : 'error' });
  };

  return (
    <div>
      <div className="page-header">
        <h2>Bulk Import Students</h2>
        <button className="btn btn-ghost" onClick={downloadTemplate}>
          <Download size={15} /> Download Template CSV
        </button>
      </div>

      {/* Instructions */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>How it works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { step: '1', title: 'Download template', desc: 'Get the CSV template with all required columns' },
            { step: '2', title: 'Fill it in Excel', desc: 'Add your student data — name, phone, course are required' },
            { step: '3', title: 'Upload & import', desc: 'Upload the CSV and we\'ll add all students at once' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E53935', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{s.step}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* File upload */}
      {!results && (
        <div className="card" style={{ marginBottom: 16 }}>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleFile} />
          <div
            onClick={() => fileRef.current.click()}
            style={{
              border: '2px dashed #E5E7EB', borderRadius: 10, padding: '32px',
              textAlign: 'center', cursor: 'pointer', background: '#FAFAFA',
              transition: 'border 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#E53935'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
          >
            <Upload size={28} style={{ color: '#9CA3AF', marginBottom: 8 }} />
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Click to upload your CSV file</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>Supports .csv and .xlsx files</div>
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: '#FECACA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#991B1B' }}>
            <AlertTriangle size={16} /> <span style={{ fontWeight: 600 }}>{errors.length} validation error{errors.length > 1 ? 's' : ''}</span>
          </div>
          {errors.map((err, i) => (
            <div key={i} style={{ fontSize: 12, color: '#991B1B', padding: '3px 0' }}>• {err}</div>
          ))}
        </div>
      )}

      {/* Preview table */}
      {preview && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Preview — {preview.length} students</div>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing || errors.length > 0}
            >
              {importing ? 'Importing...' : `Import ${preview.length} Students`}
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>#</th><th>Name</th><th>Phone</th><th>Course</th><th>Batch</th><th>Staff</th><th>Status</th></tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    <td style={{ color: '#9CA3AF' }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td>{row.phone}</td>
                    <td>{row.course}</td>
                    <td>{row.batchname || '—'}</td>
                    <td>{row.staffassigned || '—'}</td>
                    <td><span className={`badge ${row.status === 'active' || !row.status ? 'badge-green' : 'badge-gray'}`}>{row.status || 'active'}</span></td>
                  </tr>
                ))}
                {preview.length > 20 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6B7280', padding: 12 }}>...and {preview.length - 20} more rows</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Import Complete</h3>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={20} style={{ color: '#10B981' }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#10B981' }}>{results.success}</span>
              <span style={{ fontSize: 13, color: '#6B7280' }}>students imported successfully</span>
            </div>
            {results.failed > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <XCircle size={20} style={{ color: '#EF4444' }} />
                <span style={{ fontSize: 16, fontWeight: 700, color: '#EF4444' }}>{results.failed}</span>
                <span style={{ fontSize: 13, color: '#6B7280' }}>failed</span>
              </div>
            )}
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setResults(null)}>
            Import another file
          </button>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
