import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getBatchSchedules } from '../firebase/services';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const ALL_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getSlotsForDate(date, schedules) {
  const dateStr = date.toISOString().split('T')[0];
  const dayName = ALL_DAYS[date.getDay()];
  return schedules.filter(s => {
    if (s.scheduledDate) return s.scheduledDate === dateStr;
    return s.day === dayName;
  }).sort((a,b) => (a.time||'').localeCompare(b.time||''));
}

function getWeekDates(refDate) {
  const d = new Date(refDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function getMonthDates(refDate) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ date: new Date(year, month, 1 - (startOffset - i)), inMonth: false });
  }
  for (let i = 1; i <= totalDays; i++) {
    cells.push({ date: new Date(year, month, i), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last);
    d.setDate(last.getDate() + 1);
    cells.push({ date: d, inMonth: false });
  }
  return cells;
}

function slotPillColor(slot) {
  if (slot.status === 'completed')   return { bg:'#D1FAE5', col:'#065F46' };
  if (slot.status === 'cancelled')   return { bg:'#FEE2E2', col:'#991B1B' };
  if (slot.status === 'rescheduled') return { bg:'#FEF3C7', col:'#92400E' };
  return { bg:'#DBEAFE', col:'#0F3460' };
}

export default function PublicSchedule() {
  const { batchId } = useParams();
  const [batch, setBatch] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calView, setCalView] = useState('week');
  const [calDate, setCalDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    Promise.all([
      getDoc(doc(db,'batches',batchId)).then(d => d.exists() ? { id: d.id, ...d.data() } : null),
      getBatchSchedules(batchId).catch(() => []),
    ]).then(([b, s]) => { setBatch(b); setSchedules(s || []); setLoading(false); });
  }, [batchId]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Inter,sans-serif', color:'#6B7280' }}>
      Loading schedule...
    </div>
  );
  if (!batch) return (
    <div style={{ textAlign:'center', padding:40, fontFamily:'Inter,sans-serif', color:'#6B7280' }}>
      Schedule not found.
    </div>
  );

  const today = new Date(); today.setHours(0,0,0,0);
  const weekDates = getWeekDates(calDate);
  const monthCells = getMonthDates(calDate);
  const monthLabel = calDate.toLocaleString('default', { month:'long', year:'numeric' });
  const weekLabel = `${weekDates[0].toLocaleDateString('default',{month:'short',day:'numeric'})} – ${weekDates[6].toLocaleDateString('default',{month:'short',day:'numeric',year:'numeric'})}`;

  return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:'32px 20px', fontFamily:'Inter,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:28 }}>
        <div style={{ width:48, height:48, background:'#E53935', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:18, flexShrink:0 }}>ISC</div>
        <div>
          <div style={{ fontWeight:700, fontSize:22, color:'#1A1A2E' }}>{batch.name}</div>
          <div style={{ color:'#6B7280', fontSize:13 }}>Class Schedule{batch.course ? ` · ${batch.course}` : ''}</div>
        </div>
      </div>

      {/* Calendar toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'#F3F4F6', borderRadius:8, padding:2 }}>
          {['week','month'].map(v => (
            <button key={v} onClick={() => setCalView(v)}
              style={{ padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                background: calView === v ? '#0F3460' : 'transparent',
                color: calView === v ? '#fff' : '#6B7280', transition:'all 0.15s' }}
            >{v.charAt(0).toUpperCase()+v.slice(1)}</button>
          ))}
        </div>
        <button onClick={() => { const d=new Date(calDate); if(calView==='week')d.setDate(d.getDate()-7); else d.setMonth(d.getMonth()-1); setCalDate(d); }}
          style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontSize:13 }}>←</button>
        <span style={{ fontSize:13, fontWeight:600, minWidth:180, textAlign:'center' }}>
          {calView === 'week' ? weekLabel : monthLabel}
        </span>
        <button onClick={() => { const d=new Date(calDate); if(calView==='week')d.setDate(d.getDate()+7); else d.setMonth(d.getMonth()+1); setCalDate(d); }}
          style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontSize:13 }}>→</button>
        <button onClick={() => setCalDate(new Date())}
          style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontSize:12, color:'#6B7280' }}>Today</button>
      </div>

      {/* Week view */}
      {calView === 'week' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8 }}>
          {weekDates.map((date, idx) => {
            const isToday = date.toDateString() === today.toDateString();
            const slots = getSlotsForDate(date, schedules);
            return (
              <div key={idx} style={{
                background:'#fff', borderRadius:10, minHeight:120, padding:'10px 8px',
                border:`2px solid ${isToday ? '#0F3460' : '#E5E7EB'}`,
                boxShadow: isToday ? '0 0 0 2px #0F346020' : '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ textAlign:'center', marginBottom:8 }}>
                  <div style={{ fontSize:11, color: isToday ? '#0F3460' : '#9CA3AF', fontWeight:600 }}>
                    {date.toLocaleDateString('default',{weekday:'short'})}
                  </div>
                  <div style={{
                    width:26, height:26, borderRadius:'50%', margin:'3px auto 0',
                    background: isToday ? '#0F3460' : 'transparent',
                    color: isToday ? '#fff' : '#1A1A2E',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight:700, fontSize:13,
                  }}>{date.getDate()}</div>
                </div>
                {slots.map(slot => {
                  const pc = slotPillColor(slot);
                  return (
                    <div key={slot.id} onClick={() => setSelectedSlot(slot)}
                      style={{ padding:'2px 6px', borderRadius:5, background:pc.bg, color:pc.col,
                        fontSize:10, fontWeight:600, cursor:'pointer', marginBottom:2,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                        border:`1px solid ${pc.col}30` }}
                      title={slot.title}
                    >{slot.time && `${slot.time} `}{slot.title}</div>
                  );
                })}
                {slots.length === 0 && <div style={{ fontSize:10, color:'#D1D5DB', textAlign:'center', marginTop:8 }}>—</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Month view */}
      {calView === 'month' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#6B7280', padding:'6px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {monthCells.map(({ date, inMonth }, idx) => {
              const isToday = date.toDateString() === today.toDateString();
              const slots = inMonth ? getSlotsForDate(date, schedules) : [];
              return (
                <div key={idx} style={{
                  background: inMonth ? '#fff' : '#F9FAFB', borderRadius:7, minHeight:72, padding:'5px',
                  border:`1px solid ${isToday ? '#0F3460' : '#E5E7EB'}`, opacity: inMonth ? 1 : 0.4,
                }}>
                  <div style={{
                    width:20, height:20, borderRadius:'50%',
                    background: isToday ? '#0F3460' : 'transparent',
                    color: isToday ? '#fff' : inMonth ? '#1A1A2E' : '#9CA3AF',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontWeight: isToday ? 700 : 500, fontSize:11, marginBottom:3,
                  }}>{date.getDate()}</div>
                  {slots.slice(0,2).map(slot => {
                    const pc = slotPillColor(slot);
                    return (
                      <div key={slot.id} onClick={() => setSelectedSlot(slot)}
                        style={{ padding:'1px 4px', borderRadius:4, background:pc.bg, color:pc.col,
                          fontSize:9, fontWeight:600, cursor:'pointer', marginBottom:1,
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
                      >{slot.title}</div>
                    );
                  })}
                  {slots.length > 2 && <div style={{ fontSize:9, color:'#9CA3AF' }}>+{slots.length-2}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {schedules.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:'#9CA3AF', background:'#F9FAFB', borderRadius:12, marginTop:16 }}>
          No classes scheduled yet.
        </div>
      )}

      {/* Slot detail modal */}
      {selectedSlot && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, padding:20 }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedSlot(null); }}>
          <div style={{ background:'#fff', borderRadius:14, padding:24, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:16, color:'#1A1A2E', flex:1 }}>{selectedSlot.title}</div>
              <button onClick={() => setSelectedSlot(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:20, lineHeight:1, marginLeft:8 }}>×</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13, color:'#374151' }}>
              <div><strong>When:</strong> {selectedSlot.scheduledDate ? selectedSlot.scheduledDate : selectedSlot.day} at {selectedSlot.time} ({selectedSlot.duration} min)</div>
              {selectedSlot.facultyName && <div><strong>Faculty:</strong> {selectedSlot.facultyName}</div>}
              {selectedSlot.meetLink && <div><strong>Join:</strong> <a href={selectedSlot.meetLink} target="_blank" rel="noreferrer" style={{ color:'#E53935' }}>{selectedSlot.meetLink}</a></div>}
              {selectedSlot.notes && <div style={{ color:'#6B7280', fontStyle:'italic' }}>{selectedSlot.notes}</div>}
              {selectedSlot.status && (
                <div>
                  <span style={{ padding:'2px 10px', borderRadius:10, fontWeight:600, fontSize:11,
                    background: selectedSlot.status==='completed'?'#D1FAE5':selectedSlot.status==='cancelled'?'#FEE2E2':'#FEF3C7',
                    color: selectedSlot.status==='completed'?'#065F46':selectedSlot.status==='cancelled'?'#991B1B':'#92400E' }}>
                    {selectedSlot.status}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop:32, textAlign:'center', fontSize:11, color:'#D1D5DB' }}>
        Powered by ISC Student Management System
      </div>
    </div>
  );
}
