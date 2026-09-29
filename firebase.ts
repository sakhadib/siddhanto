// Import the functions you need from the SDKs you need
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getFirestore, type Firestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCDctl8Kc0E3ZS6BTXsUNy9R3Shw-bJ_JU",
  authDomain: "siddhanto.firebaseapp.com",
  projectId: "siddhanto",
  storageBucket: "siddhanto.firebasestorage.app",
  messagingSenderId: "134678649279",
  appId: "1:134678649279:web:a1fda4283cd3b230d8a90a",
  measurementId: "G-PPF8JQK66P"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);
const db: Firestore = getFirestore(app);

// Analytics only works in the browser — guard it so SSR (Vercel) doesn't crash
let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) analytics = getAnalytics(app);
  });
}

export { app, analytics, db };
