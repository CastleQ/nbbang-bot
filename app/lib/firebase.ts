// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ⚠️ 아까 복사해둔 본인의 키 값들로 채워넣으세요!
const firebaseConfig = {
  apiKey: "AIzaSyC1I4cYhF5TDxRUnWSXybAMbrdTuhXLHnE",
  authDomain: "nbbang-bot.firebaseapp.com",
  projectId: "nbbang-bot",
  storageBucket: "nbbang-bot.firebasestorage.app",
  messagingSenderId: "650518446284",
  appId: "1:650518446284:web:6d9004640ffa0fc915c269"
};

// 파이어베이스 초기화
const app = initializeApp(firebaseConfig);

// 데이터베이스(Firestore) 도구 내보내기
export const db = getFirestore(app);