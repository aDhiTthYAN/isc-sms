import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ═══════════════════════════════════════════════════════════════
//  STEP 1 — PASTE YOUR FIREBASE CONFIG HERE
//  How to get it:
//  1. Go to https://console.firebase.google.com
//  2. Open your project (isc-sms-test)
//  3. Click gear icon ⚙️ → Project Settings → General
//  4. Scroll down to "Your apps" → click your web app
//  5. Copy the values and paste below
// ═══════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyCj95Mv7stlz-owyiaj4yo_0DH3qzS4l0E",
  authDomain: "isc-sms-test.firebaseapp.com",
  projectId: "isc-sms-test",
  storageBucket: "isc-sms-test.firebasestorage.app",
  messagingSenderId: "4958345315",
  appId: "1:4958345315:web:77c9a7543fb5ae31f74056",
  measurementId: "G-KMM31KQ5BF"
};

// ═══════════════════════════════════════════════════════════════
//  DO NOT EDIT BELOW THIS LINE
// ═══════════════════════════════════════════════════════════════
const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;
