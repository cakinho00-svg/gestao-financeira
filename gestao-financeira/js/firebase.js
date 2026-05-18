// js/firebase.js
// Substitua os valores abaixo pelo firebaseConfig do seu projeto Firebase.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDKBge8MKRsMR4bYm4vGUMsUNgngssTB5c",
  authDomain: "gestaofinanceiracaique.firebaseapp.com",
  projectId: "gestaofinanceiracaique",
  storageBucket: "gestaofinanceiracaique.firebasestorage.app",
  messagingSenderId: "13271290172",
  appId: "1:13271290172:web:4c3379a6e5b5e929848e39"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
