import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Firebase Functions 초기화 - 지역 명시적 설정
const functions = getFunctions(app, 'us-central1');
const db = getFirestore(app);

// 개발 환경에서만 Functions 에뮬레이터 사용 (환경변수로 제어)
if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectFunctionsEmulator(functions, 'localhost', 5002);
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log('Connected to Functions emulator');
  } catch {
    console.log('Functions emulator connection failed or already connected');
  }
}

export default app;
export const auth = getAuth(app);
export { db };
export const storage = getStorage(app);
export { functions };
