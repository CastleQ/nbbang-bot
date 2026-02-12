"use client";

import { useState, useEffect } from "react";
import styles from "./Dashboard.module.css";

// 파이어베이스 관련 임포트
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// [NEW] 히스토리 매니저 임포트
import { getHistory, removeFromHistory } from "../lib/historyManager";

import { useToast } from "./ToastProvider";

interface Props {
  onCreateClick: () => void;
  onItemClick: (item: any) => void; 
}

export default function Dashboard({ onCreateClick, onItemClick }: Props) {
  const { showToast } = useToast();

  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true); // 로딩 상태 추가
  
  // 편집 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);
  
  // 선택된 항목들의 ID를 담는 배열
  const [selectedIds, setSelectedIds] = useState<any[]>([]);

  // [수정됨] 데이터 불러오기: 내 로컬 히스토리에 있는 ID만 조회
  useEffect(() => {
    const fetchMySettlements = async () => {
      setIsLoading(true);
      const myIds = getHistory(); // 로컬 스토리지에서 ID 목록 가져오기

      if (myIds.length === 0) {
        setHistory([]);
        setIsLoading(false);
        return;
      }

      try {
        // ID 목록을 순회하며 하나씩 DB에서 가져옴 (병렬 처리)
        const promises = myIds.map((id) => getDoc(doc(db, "settlements", id)));
        const docs = await Promise.all(promises);

        const list = docs
          .filter((doc) => doc.exists()) // 삭제된 정산은 제외
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          // 최신순 정렬 (작성일 기준 내림차순)
          .sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

        setHistory(list);
      } catch (error) {
        console.error("정산 목록 불러오기 실패:", error);
        showToast("목록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMySettlements();
  }, [showToast]);

  // 편집 모드 토글
  const toggleEditMode = () => {
    setIsEditMode((prev) => !prev);
    setSelectedIds([]); 
  };

  // 카드 클릭 핸들러
  const handleCardClick = (item: any) => {
    if (isEditMode) {
      // 편집 모드일 땐 선택/해제
      setSelectedIds((prev) => {
        if (prev.includes(item.id)) {
          return prev.filter((id) => id !== item.id);
        } else {
          return [...prev, item.id];
        }
      });
    } else {
      // 일반 모드일 땐 상세 페이지 이동
      onItemClick(item);
    }
  };

  // [수정됨] 삭제 실행 함수: DB 삭제가 아니라 '내 목록에서 숨기기'
  const handleDelete = async () => {
    if (selectedIds.length === 0) return;

    if (window.confirm(`선택한 ${selectedIds.length}개의 정산을 내 목록에서 지울까요? (데이터는 유지됩니다)`)) {
      try {
        // 1. 로컬 스토리지에서 제거
        selectedIds.forEach((id) => removeFromHistory(id));

        // 2. 화면 목록에서도 제거
        setHistory((prev) => prev.filter((item) => !selectedIds.includes(item.id)));

        setIsEditMode(false);
        setSelectedIds([]);
        
        showToast("내 목록에서 삭제되었습니다."); 
        
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
          <button 
            className={styles.editButton} 
            onClick={toggleEditMode}
            style={{ color: isEditMode ? "#0064FF" : "#8b95a1" }}
          >
            {isEditMode ? "취소" : "편집"}
          </button>
        )}
      </div>

      {/* 2. 리스트 영역 */}
      {isLoading ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>불러오는 중...</p>
        </div>
      ) : history.length === 0 ? (
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
              style={{ cursor: "pointer" }}
            >
              {/* 편집 모드일 때 체크박스 표시 영역 */}
              {isEditMode && (
                <div className={`${styles.checkbox} ${selectedIds.includes(item.id) ? styles.checkboxSelected : ""}`}>
                  {selectedIds.includes(item.id) && <span className={styles.checkIcon}>✔</span>}
                </div>
              )}

              {/* 카드 내용물 영역 */}
              <div className={styles.cardContent} style={{ marginLeft: isEditMode ? "36px" : "0", transition: "all 0.2s" }}>
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
                    {Number(item.totalAmount).toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. 하단 버튼 영역 */}
      {isEditMode ? (
        <div className={styles.bottomBar}>
            <button 
            className={styles.deleteButton} 
            onClick={handleDelete}
            disabled={selectedIds.length === 0}
            style={{ 
                opacity: selectedIds.length === 0 ? 0.5 : 1,
                backgroundColor: "#ff4b4b",
                color: "white",
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                border: "none",
                fontWeight: "bold",
                fontSize: "16px"
            }}
            >
            삭제하기 ({selectedIds.length})
            </button>
        </div>
      ) : (
        <button className={styles.createButton} onClick={onCreateClick}>
          + 새 정산 만들기
        </button>
      )}
      
    </div>
  );
}