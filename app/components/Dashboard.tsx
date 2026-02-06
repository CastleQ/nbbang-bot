"use client";

import { useState, useEffect } from "react";
import styles from "./Dashboard.module.css";

// 파이어베이스 관련 임포트
import { db } from "../lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";

// [NEW] 토스트 훅 임포트
import { useToast } from "./ToastProvider";

interface Props {
  onCreateClick: () => void;
  onItemClick: (item: any) => void; 
}

export default function Dashboard({ onCreateClick, onItemClick }: Props) {
  // [NEW] 토스트 리모컨 꺼내기
  const { showToast } = useToast();

  const [history, setHistory] = useState<any[]>([]);
  
  // 편집 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);
  
  // 선택된 항목들의 ID를 담는 배열
  const [selectedIds, setSelectedIds] = useState<any[]>([]);

  // 데이터 불러오기
  useEffect(() => {
    const q = query(collection(db, "settlements"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id, 
        ...doc.data(), 
      }));
      
      setHistory(list);
    });

    return () => unsubscribe();
  }, []);

  // 편집 모드 토글
  const toggleEditMode = () => {
    setIsEditMode((prev) => !prev);
    setSelectedIds([]); 
  };

  // 카드 클릭 핸들러
  const handleCardClick = (item: any) => {
    if (isEditMode) {
      setSelectedIds((prev) => {
        if (prev.includes(item.id)) {
          return prev.filter((id) => id !== item.id);
        } else {
          return [...prev, item.id];
        }
      });
    } else {
      onItemClick(item);
    }
  };

  // [수정됨] 삭제 실행 함수 (Alert -> Toast)
  const handleDelete = async () => {
    if (selectedIds.length === 0) return;

    // 삭제 확인은 안전을 위해 브라우저 기본 창(confirm) 유지
    if (window.confirm(`정말 ${selectedIds.length}개의 정산 내역을 삭제하시겠습니까?`)) {
      try {
        await Promise.all(
          selectedIds.map((id) => deleteDoc(doc(db, "settlements", String(id))))
        );

        setIsEditMode(false);
        setSelectedIds([]);
        
        // [NEW] 토스트 알림으로 변경
        showToast("삭제되었습니다."); 
        
      } catch (error) {
        console.error("삭제 실패:", error);
        showToast("삭제 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className={styles.container}>
      {/* 1. 헤더 영역 */}
      <div className={styles.header}>
        <h1 className={styles.title}>내 정산 목록</h1>
        
        {/* 내역이 있을 때만 '편집' 버튼 표시 */}
        {history.length > 0 && (
          <button className={styles.editButton} onClick={toggleEditMode}>
            {isEditMode ? "완료" : "편집"}
          </button>
        )}
      </div>

      {/* 2. 리스트 영역 */}
      {history.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>아직 정산 내역이 없어요.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {history.map((item) => (
            <div 
              key={item.id} 
              className={styles.card}
              onClick={() => handleCardClick(item)}
            >
              {/* 편집 모드일 때 체크박스 표시 영역 */}
              {isEditMode && (
                <div className={`${styles.checkbox} ${selectedIds.includes(item.id) ? styles.checkboxSelected : ""}`}>
                  {selectedIds.includes(item.id) && <span className={styles.checkIcon}>✔</span>}
                </div>
              )}

              {/* 카드 내용물 영역 */}
              <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>{item.title}</span>
                  <span className={styles.cardDate}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className={styles.cardFooter}>
                  <span className={styles.cardSettler}>
                    {item.settler} {item.participantCount ? `(${item.participantCount}명)` : ""}
                  </span>
                  <span className={styles.cardAmount}>
                    {item.totalAmount.toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. 하단 버튼 영역 */}
      {isEditMode ? (
        <button 
          className={styles.deleteButton} 
          onClick={handleDelete}
          disabled={selectedIds.length === 0}
          style={{ opacity: selectedIds.length === 0 ? 0.5 : 1 }}
        >
          삭제하기 ({selectedIds.length})
        </button>
      ) : (
        <button className={styles.createButton} onClick={onCreateClick}>
          + 새 정산 만들기
        </button>
      )}
      
    </div>
  );
}