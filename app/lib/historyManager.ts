// lib/historyManager.ts

const STORAGE_KEY = "nbbang_history"; // 로컬 스토리지에 저장할 키 이름

// 1. 저장된 정산 ID 목록 가져오기
export const getHistory = (): string[] => {
  if (typeof window === "undefined") return []; // 서버 사이드 렌더링(SSR) 방어 코드
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("히스토리 불러오기 실패:", error);
    return [];
  }
};

// 2. 새로운 정산 ID 추가하기 (중복 방지)
export const addToHistory = (id: string) => {
  if (typeof window === "undefined") return;

  const current = getHistory();
  
  // 이미 목록에 있다면 추가하지 않음
  if (!current.includes(id)) {
    // 최신 항목이 맨 앞에 오도록 추가
    const updated = [id, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
};

// 3. 특정 정산 ID 삭제하기 (목록에서 제거)
export const removeFromHistory = (id: string) => {
  if (typeof window === "undefined") return;

  const current = getHistory();
  const updated = current.filter((itemId) => itemId !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};