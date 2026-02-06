"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import styles from "./Toast.module.css";

// 1. Context 만들기 (전역에서 쓸 리모컨 정의)
interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// 2. Provider 컴포넌트 (앱 전체를 감쌀 껍데기)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isHiding, setIsHiding] = useState(false); // 사라지는 애니메이션용

  const showToast = (msg: string) => {
    setMessage(msg);
    setIsVisible(true);
    setIsHiding(false);

    // 3초 뒤에 사라지게 예약
    setTimeout(() => {
      setIsHiding(true); // 사라지는 애니메이션 시작
      setTimeout(() => {
        setIsVisible(false); // 완전히 제거
      }, 300); // CSS fadeOut 시간(0.3s)과 맞춤
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* 화면에 띄울 토스트 UI */}
      {isVisible && (
        <div className={styles.container}>
          <div className={`${styles.toast} ${isHiding ? styles.hiding : ""}`}>
            {/* 체크 아이콘 (원하면 제거 가능) */}
            <span className={styles.icon}>✔</span> 
            {message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// 3. 커스텀 훅 (다른 파일에서 쉽게 쓰도록 포장)
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}