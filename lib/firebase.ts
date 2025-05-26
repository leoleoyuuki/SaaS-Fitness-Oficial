import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Firebase configuration will be added here
 apiKey: "AIzaSyDScdZ1qIT3I9sGMOtvnGYrMAnQ-W-02ZM",
  authDomain: "saas-fitness1.firebaseapp.com",
  projectId: "saas-fitness1",
  storageBucket: "saas-fitness1.firebasestorage.app",
  messagingSenderId: "593509228481",
  appId: "1:593509228481:web:c01b1664df9a0fd8b19940"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
