import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBEyRHxQnFVLKmuYhu4Gb6IRhANflweYtw",
  authDomain: "notetakingapp-67427.firebaseapp.com",
  projectId: "notetakingapp-67427",
  storageBucket: "notetakingapp-67427.firebasestorage.app",
  messagingSenderId: "458808912076",
  appId: "1:458808912076:web:b34282f5a18e3b29277a69",
  measurementId: "G-NVCXTCJXLN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics (Browser only)
let analytics;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

// Initialize Auth
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
