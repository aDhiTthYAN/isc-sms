import { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, updateDoc, doc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { registerFCMToken, onForegroundMessage } from '../firebase/fcm';

const NotifContext = createContext(null);

export function NotifProvider({ children }) {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [foregroundNotif, setForegroundNotif] = useState(null);

  // Register FCM token when user logs in
  useEffect(() => {
    if (!user?.uid) return;
    registerFCMToken(user.uid);
  }, [user?.uid]);

  // Listen for foreground FCM messages (app is open)
  useEffect(() => {
    if (!user) return;
    let unsub = () => {};
    onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      setForegroundNotif({ title, body, id: Date.now() });
      // Auto-dismiss after 5s
      setTimeout(() => setForegroundNotif(null), 5000);
    }).then(fn => { unsub = fn; });
    return () => unsub();
  }, [user?.uid]);

  // In-app Firestore notification listener
  useEffect(() => {
    if (!user || !profile?.email) return;

    const q = query(
      collection(db, 'notifications'),
      where('toEmail', '==', profile.email),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubFirestore = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    }, (err) => {
      import.meta.env.DEV && console.warn('Notifications listener error:', err.message);
    });

    return unsubFirestore;
  }, [user, profile?.email]);

  const markRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch {}
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n =>
      updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})
    ));
  };

  return (
    <NotifContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
      {/* Foreground push notification toast */}
      {foregroundNotif && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:9999,
          background:'#1A1A2E', color:'#fff', borderRadius:12,
          padding:'14px 18px', maxWidth:320, boxShadow:'0 8px 32px rgba(0,0,0,0.3)',
          animation:'slideUp 0.3s ease',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>
                🔔 {foregroundNotif.title}
              </div>
              {foregroundNotif.body && (
                <div style={{ fontSize:13, opacity:0.8 }}>{foregroundNotif.body}</div>
              )}
            </div>
            <button onClick={() => setForegroundNotif(null)}
              style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer', fontSize:16, padding:0 }}>×</button>
          </div>
        </div>
      )}
    </NotifContext.Provider>
  );
}

export const useNotifs = () => useContext(NotifContext);
