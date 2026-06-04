import { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, updateDoc, doc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';

const NotifContext = createContext(null);

export function NotifProvider({ children }) {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);

  useEffect(() => {
    // Need both user and profile.email to set up listener
    if (!user || !profile?.email) return;

    const q = query(
      collection(db, 'notifications'),
      where('toEmail', '==', profile.email),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    // Real-time listener — fires instantly when CEO sends a task/followup/concern
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    }, (err) => {
      // Silently fail if index not set up — app still works, just no live notifs
      console.warn('Notifications listener error (may need Firestore index):', err.message);
    });

    return unsub;
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
    </NotifContext.Provider>
  );
}

export const useNotifs = () => useContext(NotifContext);