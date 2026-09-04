import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app;
if (getApps().length > 0) {
  app = getApp();
} else if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase app initialization failed", e);
  }
}

let auth: any = null;
let db: any = null;
let storage: any = null;

if (app) {
  try {
    auth = getAuth(app);
  } catch (e) {
    console.error("Firebase auth initialization failed", e);
  }

  try {
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch (error) {
    try {
      db = getFirestore(app);
    } catch (e) {
      console.error("Firebase firestore initialization failed", e);
    }
  }

  try {
    storage = getStorage(app);
  } catch (e) {
    console.error("Firebase storage initialization failed", e);
  }
}

export { auth, db, storage };
export default app;
