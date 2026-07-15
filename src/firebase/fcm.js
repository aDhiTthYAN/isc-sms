import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db, getMessagingInstance } from './config';

// VAPID key from Firebase console → Project Settings → Cloud Messaging → Web Push certificates
// Replace this with your actual VAPID key from Firebase console
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export const registerFCMToken = async (userId) => {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token || !userId) return null;

    // Store token in staff document
    await updateDoc(doc(db, 'staff', userId), {
      fcmToken: token,
      fcmTokenUpdatedAt: new Date().toISOString(),
    }).catch(() => {});

    return token;
  } catch (err) {
    import.meta.env.DEV && console.warn('FCM registration failed:', err.message);
    return null;
  }
};

export const onForegroundMessage = async (callback) => {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
};
