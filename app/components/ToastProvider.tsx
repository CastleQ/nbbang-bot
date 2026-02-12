"use client";

import { createContext, useContext, useState, useRef, ReactNode } from "react";
// CSS 파일명은 사용자분 환경에 맞춰주세요
import styles from "./Toast.module.css";

interface ToastContextType {
  showToast: (message: string, position?: "top" | "bottom") => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
    closing: boolean; // [NEW] 사라지는 애니메이션 실행용 상태
    position: "top" | "bottom";
  }>({
    message: "",
    visible: false,
    closing: false,
    position: "bottom",
  });

  // 타이머 ID 저장소 (연속 호출 시 기존 타이머 취소용)
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, position: "top" | "bottom" = "bottom") => {
    // 1. 기존에 돌고 있던 '사라지기 타이머'가 있다면 취소 (새 메시지가 우선)
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // 2. 새 토스트 즉시 표시 (closing은 false로 초기화)
    setToast({ message, visible: true, closing: false, position });
    
    // 3. 3초 유지 후 '사라지는 상태'로 전환
    timerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, closing: true }));

      // 4. 애니메이션 시간(0.4초)만큼 기다린 뒤 완전히 삭제
      // (CSS의 fadeOut 애니메이션 시간이 0.3~0.4초이므로 그에 맞춤)
      setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 400); 
    }, 1000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast.visible && (
        <div 
          className={`${styles.container} ${toast.position === "top" ? styles.top : styles.bottom}`}
        >
          {/* closing 상태일 때 styles.hiding 클래스를 붙여서 fadeOut 애니메이션 발동 */}
          <div className={`${styles.toast} ${toast.closing ? styles.hiding : ""}`}>
            {toast.message}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}