// ─────────────────────────────────────────────────────────────
// Creates staff Firebase Auth accounts WITHOUT logging out CEO.
// Uses a secondary Firebase app instance — free plan compatible.
// ─────────────────────────────────────────────────────────────
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './config';

const SECONDARY_APP_NAME = 'isc-staff-creator';

const getSecondaryApp = () => {
  // Check if secondary app already exists
  const existing = getApps().find(app => app.name === SECONDARY_APP_NAME);
  if (existing) return existing;

  // Create secondary app using same config as main app
  const mainApp = getApp();
  return initializeApp(mainApp.options, SECONDARY_APP_NAME);
};

// Call this from StaffManagement to create a staff account
// CEO stays logged in — secondary app is completely isolated
export const createStaffAccount = async ({ name, email, role, subjects }) => {
  // Generate a secure temporary password
  const tempPassword = generatePassword();

  try {
    // Get secondary auth instance
    const secondaryApp  = getSecondaryApp();
    const secondaryAuth = getAuth(secondaryApp);

    // Create Auth account using secondary instance — CEO NOT affected
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth, email, tempPassword
    );
    const uid = credential.user.uid;

    // Sign out from secondary instance immediately
    await signOut(secondaryAuth);

    // Save complete staff profile to Firestore with UID as document ID
    await setDoc(doc(db, 'staff', uid), {
      uid,
      name,
      email,
      role,
      subjects:       subjects || [],
      active:         true,
      needsAuthSetup: false, // no Firebase Console needed!
      createdAt:      new Date().toISOString(),
    });

    // Send password reset email — staff clicks link and sets own password
    const mainAuth = getAuth(getApp());
    await sendPasswordResetEmail(mainAuth, email);

    return { success: true, uid, tempPassword };
  } catch (err) {
    // Handle common errors with clear messages
    if (err.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Use a different email.');
    }
    if (err.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format.');
    }
    if (err.code === 'auth/weak-password') {
      throw new Error('Password too weak. Try again.');
    }
    throw new Error(err.message || 'Failed to create staff account.');
  }
};

function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const nums  = '23456789';
  const syms  = '@#$!';
  const all   = upper + lower + nums + syms;
  let pass = '';
  pass += upper[Math.floor(Math.random() * upper.length)];
  pass += lower[Math.floor(Math.random() * lower.length)];
  pass += nums[Math.floor(Math.random() * nums.length)];
  pass += syms[Math.floor(Math.random() * syms.length)];
  for (let i = 0; i < 8; i++) {
    pass += all[Math.floor(Math.random() * all.length)];
  }
  return pass.split('').sort(() => Math.random() - 0.5).join('');
}