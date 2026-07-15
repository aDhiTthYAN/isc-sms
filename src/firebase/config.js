import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCj95Mv7stlz-owyiaj4yo_0DH3qzS4l0E",
  authDomain: "isc-sms-test.firebaseapp.com",
  projectId: "isc-sms-test",
  storageBucket: "isc-sms-test.firebasestorage.app",
  messagingSenderId: "4958345315",
  appId: "1:4958345315:web:77c9a7543fb5ae31f74056",
  measurementId: "G-KMM31KQ5BF"
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

// FCM — only initialise when the browser supports it
export const getMessagingInstance = async () => {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
};

export default app;
