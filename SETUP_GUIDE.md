# ISC Student Management System
## Complete Setup Guide — Step by Step

---

## What You're Getting
A full web app (PWA) that works on mobile and desktop, with:
- Student profiles, follow-ups, assessments
- Staff tasks, daily reports, lead pipeline
- Document uploads, batch management, concerns tracker
- CEO dashboard with live stats
- Login system with role-based access (CEO vs Staff)

---

## STEP 1 — Install Node.js on Your Computer

1. Go to: https://nodejs.org
2. Download the **LTS version** (recommended)
3. Install it (just click Next → Next → Install)
4. Open **Command Prompt** (Windows) or **Terminal** (Mac)
5. Type: `node --version` — you should see something like `v20.x.x`

---

## STEP 2 — Set Up Firebase (Your Database)

Firebase is free for your usage level. It stores all student data securely.

### 2a. Create a Firebase Project
1. Go to: https://console.firebase.google.com
2. Click **"Add project"**
3. Name it: `isc-sms` (or anything you like)
4. Disable Google Analytics (not needed) → Click **Create project**

### 2b. Enable Authentication
1. In the left sidebar → click **Authentication**
2. Click **"Get started"**
3. Click **Email/Password** → Toggle it **ON** → Save

### 2c. Create Firestore Database
1. In the left sidebar → click **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → Next
4. Select region: **asia-south1 (Mumbai)** → Enable

### 2d. Enable Storage (for document uploads)
1. In the left sidebar → click **Storage**
2. Click **"Get started"** → Next → Done

### 2e. Get Your Firebase Config
1. Click the **gear icon** (⚙️) → **Project settings**
2. Scroll down to **"Your apps"**
3. Click the **Web icon** (`</>`)
4. App nickname: `isc-web` → Click **Register app**
5. You'll see a `firebaseConfig` object like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "isc-sms.firebaseapp.com",
     projectId: "isc-sms",
     storageBucket: "isc-sms.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
6. **Copy these values** — you need them in the next step.

### 2f. Set Security Rules
1. In Firestore → click **Rules** tab
2. Replace everything with the contents of `firestore.rules` file → **Publish**
3. In Storage → click **Rules** tab
4. Replace everything with the contents of `storage.rules` file → **Publish**

---

## STEP 3 — Configure the App

1. Open the project folder `isc-sms`
2. Open file: `src/firebase/config.js`
3. Replace the placeholder values with your Firebase config from Step 2e:

```js
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_KEY_HERE",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
};
```

---

## STEP 4 — Create Staff Accounts

### Create users in Firebase Auth:
1. Go to Firebase Console → **Authentication** → **Users** tab
2. Click **"Add user"**
3. Enter email + password for each staff member
4. Copy the **UID** shown after creating (looks like: `abc123xyz...`)

### Set roles in Firestore:
1. Go to Firebase Console → **Firestore Database**
2. Click **"Start collection"** → Collection ID: `staff` → Next
3. Document ID: paste the UID from above
4. Add these fields:
   - Field: `name` | Type: `string` | Value: `Staff Member Name`
   - Field: `role` | Type: `string` | Value: `ceo` (for CEO) or `staff` (for staff)
   - Field: `email` | Type: `string` | Value: their email
5. Click **Save**
6. Repeat for each staff member

---

## STEP 5 — Run Locally (Test First)

Open Terminal / Command Prompt in the `isc-sms` folder:

```bash
npm install
npm run dev
```

Open browser: **http://localhost:5173**

Login with the CEO email and password you created in Step 4.

---

## STEP 6 — Deploy to Vercel (Free Hosting)

Vercel gives you a live URL your staff can open from anywhere.

### 6a. Install Vercel CLI
```bash
npm install -g vercel
```

### 6b. Deploy
```bash
cd isc-sms
vercel
```

Follow the prompts:
- **Set up and deploy?** → Y
- **Which scope?** → Select your account
- **Link to existing project?** → N
- **Project name?** → isc-sms
- **In which directory is your code?** → ./ (just press Enter)
- **Override settings?** → N

Vercel will give you a URL like: `https://isc-sms.vercel.app`

### 6c. Set Custom Domain (Optional)
1. Go to: https://vercel.com → your project
2. Settings → Domains
3. Add: `sms.internationalskillsclub.com` (if you have a domain)

---

## STEP 7 — Install on Staff Phones (PWA)

### Android:
1. Open Chrome on the phone
2. Go to your Vercel URL
3. Tap the **three-dot menu** (⋮)
4. Tap **"Add to Home screen"**
5. Name it **ISC SMS** → Add
6. It now appears as an app icon on their phone!

### iPhone (iOS):
1. Open **Safari** on the phone
2. Go to your Vercel URL
3. Tap the **Share button** (box with arrow)
4. Scroll down → Tap **"Add to Home Screen"**
5. Name it **ISC SMS** → Add

---

## STEP 8 — Share Access

Only share the URL with your team:
`https://isc-sms.vercel.app`

Each staff member logs in with their own email/password (created in Step 4).
Nobody outside your team can log in — Firebase Authentication protects it.

---

## Staff List (Update This in the App Code)

Currently these names appear in dropdowns. Edit `src/pages/Students.jsx` line:
```js
const STAFF_LIST = ['Priya S.', 'Arjun M.', 'Meena R.', 'John K.', 'Arun P.'];
```
Replace with your actual staff names. Do the same in `Tasks.jsx` and `Reports.jsx`.

---

## Updating the App Later

If you make any changes to the code:
```bash
cd isc-sms
vercel --prod
```
The update goes live in about 30 seconds.

---

## Cost

| Service | Cost |
|---------|------|
| Firebase Firestore | Free (up to 50,000 reads/day) |
| Firebase Storage | Free (up to 1GB) |
| Firebase Auth | Free (unlimited users) |
| Vercel Hosting | Free |
| **Total** | **₹0 / month** |

For a school of 250 students with 5 staff, you'll stay in the free tier easily.

---

## Support

If you get stuck on any step, share the exact error message and I can help.
