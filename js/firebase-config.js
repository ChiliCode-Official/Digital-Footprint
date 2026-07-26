import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCq2qgvlMDwi1z0Ocjm9_m0jEIerywtNE0",
  authDomain: "digital-ecom-f1579.firebaseapp.com",
  projectId: "digital-ecom-f1579",
  storageBucket: "digital-ecom-f1579.firebasestorage.app",
  messagingSenderId: "840106564062",
  appId: "1:840106564062:web:ab0c311afbd7a20362254f",
  measurementId: "G-NE5HGR8X0K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics blocked or not supported", e);
}
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { app, db, auth, provider };
