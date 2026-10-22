/**
 * Configuracion del Firebase Web SDK para el navegador.
 *
 * SOLO se exponen variables NEXT_PUBLIC_*: la API key de Firebase Web es
 * publica por diseno (la seguridad real esta en las reglas de Firestore y en
 * la verificacion de tokens del backend). La API key de Gemini NUNCA aparece
 * aqui: vive unicamente en el backend.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCqWu83eniOet8bzHbLyl6niXqmMMgacRQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "beautyvirtual.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "beautyvirtual",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "beautyvirtual.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "305283421322",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:305283421322:web:569dba72b5e39f9cbf4973",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-R7KBS071PK"
};

const requiredKeys = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

export const isFirebaseConfigured = requiredKeys.every((key) => Boolean(process.env[key]));

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
