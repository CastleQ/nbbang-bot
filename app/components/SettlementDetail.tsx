"use client";

import { useState } from "react";
import styles from "./SettlementDetail.module.css";

// Firebase 모듈
import { db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

// [NEW] 토스트 훅 가져오기
import { useToast } from "./ToastProvider";

interface Props {
  data: any; 
  onBack: () => void; 
  onLinkTest: () => void;
}

export default function SettlementDetail({ data, onBack, onLinkTest }: Props) {
  
  // [NEW] 토스트 리모컨 꺼내기
  const { showToast } = useToast();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isTotalExpanded, setIsTotalExpanded] = useState(false);

  // 참여자 목록 State
  const [participants, setParticipants] = useState<any[]>(data.participants || []);

  const toggleAccordion = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // [유틸] 시간 차이(분 단위) 계산 함수
  const getDurationMinutes = (start?: string, end?: string) => {
    if (!start || !end) return 0;
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    let diff = endTotal - startTotal;
    if (diff < 0) diff += 1440;
    return diff;
  };

  // [유틸] 시간 표시용 텍스트 변환
  const formatDuration = (minutes: number) => {
    if (minutes === 0) return "0시간";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    let text = "";
    if (h > 0) text += `${h}시간 `;
    if (m > 0) text += `${m}분`;
    return text.trim();
  };

  // [핵심] 정산 계산 로직
  const calculateSettlement = () => {
    const results: Record<number, { total: 0, details: any[] }> = {};
    
    participants.forEach((p: any) => {
      results[p.id] = { total: 0, details: [] };
    });

    data.items.forEach((item: any) => {
      const itemPrice = parseInt(item.price.replace(/,/g, "")) || 0;
      
      const joinedParticipants = participants.filter((p: any) => p.selections[item.id]?.joined);
      const joinedCount = joinedParticipants.length;

      if (joinedCount === 0) return; 

      // A. 시간 당 정산
      if (item.method === "hourly") {
        let totalMinutes = 0;
        joinedParticipants.forEach((p: any) => {
          const sel = p.selections[item.id];
          totalMinutes += getDurationMinutes(sel.startTime, sel.endTime);
        });

        if (totalMinutes > 0) {
          const pricePerMinute = itemPrice / totalMinutes; 

          joinedParticipants.forEach((p: any) => {
            const sel = p.selections[item.id];
            const myMinutes = getDurationMinutes(sel.startTime, sel.endTime);
            
            // 1원 단위 올림 처리
            const rawCost = myMinutes * pricePerMinute;
            const myCost = Math.ceil(rawCost / 10) * 10; 

            if (results[p.id]) {
              results[p.id].total += myCost;
              results[p.id].details.push({
                category: item.category,
                info: `${sel.startTime}~${sel.endTime} (${formatDuration(myMinutes)})`,
                cost: myCost,
                isHourly: true
              });
            }
          });
        }
      } 
      // B. 일반 정산
      else {
        // 1원 단위 올림 처리
        const splitPrice = Math.ceil((itemPrice / joinedCount) / 10) * 10; 

        joinedParticipants.forEach((p: any) => {
          if (results[p.id]) {
            results[p.id].total += splitPrice;
            results[p.id].details.push({
              category: item.category,
              info: "참여",
              cost: splitPrice,
              isHourly: false
            });
          }
        });
      }
    });

    return results;
  };

  const settlementResults = calculateSettlement();

  // 참여자 삭제(내보내기) 함수
  const handleDeleteParticipant = async (participantId: number, participantName: string) => {
    // 삭제 확인(Confirm)은 안전을 위해 Alert가 아닌 브라우저 기본 창 유지
    if (!confirm(`'${participantName}'님을 목록에서 제외하시겠습니까?\n(이 작업은 되돌릴 수 없습니다.)`)) {
      return;
    }

    try {
      const newParticipants = participants.filter((p) => p.id !== participantId);

      const docRef = doc(db, "settlements", data.id);
      await updateDoc(docRef, {
        participants: newParticipants
      });

      setParticipants(newParticipants);
      
      // [수정] Alert -> Toast
      showToast("참여자가 삭제되었습니다.");

    } catch (error) {
      console.error("Error removing participant:", error);
      showToast("삭제 중 오류가 발생했습니다.");
    }
  };


  // 정산 결과 텍스트 복사 함수
  const handleCopyResult = () => {
    const settlerInfoStr = localStorage.getItem("settlerInfo");
    let bankText = "";
    if (settlerInfoStr) {
      const { bankName, accountNumber, accountHolder } = JSON.parse(settlerInfoStr);
      bankText = `${bankName} ${accountNumber} (${accountHolder})`;
    }

    let resultText = `[${data.title}]\n`;
    resultText += `총 ${data.totalAmount.toLocaleString()}원\n\n`;
    resultText += `👇 정산 결과\n`;

    if (participants.length === 0) {
      resultText += `(아직 참여자가 없습니다)\n`;
    } else {
      participants.forEach((p: any) => {
        const amount = settlementResults[p.id]?.total || 0;
        resultText += `- ${p.name}: ${amount.toLocaleString()}원\n`;
      });
    }

    resultText += `\n💸 입금 계좌\n${bankText}`;
    
    navigator.clipboard.writeText(resultText)
      // [수정] Alert -> Toast (성공 시 메시지 간소화)
      .then(() => showToast("정산 결과가 복사되었습니다!"))
      .catch(() => showToast("복사에 실패했습니다."));
  };

  // 참여 링크 복사 함수
  const handleCopyLink = () => {
    const link = `${window.location.origin}/settlement/${data.id}`;
    
    navigator.clipboard.writeText(link)
      // [수정] Alert -> Toast
      .then(() => showToast("참여 링크가 복사되었습니다!"))
      .catch(() => showToast("링크 복사에 실패했습니다."));
  };

  return (
    <div className={styles.container}>
      <nav className={styles.nav}>
        <button onClick={onBack} className={styles.backButton}>
          ← 목록으로 돌아가기
        </button>
      </nav>

      <header className={styles.header}>
        <h1 className={styles.title}>{data.title}</h1>
        <div className={styles.date}>
          {new Date(data.createdAt).toLocaleDateString()}
        </div>
        <div className={styles.infoText}>
          정산자: {data.settler} · 참여자 {participants.length}명
        </div>
      </header>

      {/* 총액 아코디언 */}
      <div 
        className={`${styles.accordionItem} ${isTotalExpanded ? styles.accordionItemOpen : ""}`}
        style={{ marginBottom: "30px" }}
      >
        <div 
          className={`${styles.accordionHeader} ${styles.totalHeader}`}
          onClick={() => setIsTotalExpanded(!isTotalExpanded)}
        >
          <span className={styles.totalLabel}>전체 지출 총액</span>
          <div className={styles.totalAmount}>
            {data.totalAmount.toLocaleString()}원
            <span className={`${styles.arrow} ${isTotalExpanded ? styles.arrowOpen : ""}`}>
              ▼
            </span>
          </div>
        </div>

        {isTotalExpanded && (
          <div className={styles.accordionContent}>
            {data.items.map((item: any) => (
              <div key={item.id} className={styles.detailRow}>
                <div className={styles.detailLeft}>
                  <span>{item.category}</span>
                  {item.method === "hourly" ? (
                    <span className={styles.detailTime}>시간당 정산 (전체 {item.price}원)</span>
                  ) : (
                    <span className={styles.detailTime}>일반 정산</span>
                  )}
                </div>
                <span>{parseInt(item.price.replace(/,/g, "")).toLocaleString()}원</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 참여자별 정산 현황 */}
      <section>
        <h3 className={styles.sectionTitle}>참여자별 정산 현황</h3>
        
        {participants.length === 0 && (
          <div style={{ textAlign: "center", color: "#8b95a1", padding: "20px", fontSize: "14px" }}>
            아직 입력한 참여자가 없습니다.<br/>
            아래 버튼을 통해 참여자 입력을 테스트해보세요.
          </div>
        )}

        <div className={styles.accordionList}>
          {participants.map((person: any) => {
            const isOpen = expandedId === person.id;
            const myResult = settlementResults[person.id] || { total: 0, details: [] };

            return (
              <div 
                key={person.id} 
                className={`${styles.accordionItem} ${isOpen ? styles.accordionItemOpen : ""}`}
              >
                <div 
                  className={styles.accordionHeader} 
                  onClick={() => toggleAccordion(person.id)}
                >
                  <span className={styles.userName}>{person.name}</span>
                  <div className={styles.userTotal}>
                    {myResult.total.toLocaleString()}원
                    <span className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ""}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className={styles.accordionContent}>
                    {myResult.details.map((detail: any, idx: number) => (
                      <div key={idx} className={styles.detailRow}>
                        <div className={styles.detailLeft}>
                          <span>{detail.category}</span>
                          <span className={styles.detailTime}>{detail.info}</span>
                        </div>
                        <span style={{ fontWeight: 600, color: "#333d4b" }}>
                          {detail.cost.toLocaleString()}원
                        </span>
                      </div>
                    ))}
                    {person.contact && (
                      <div style={{ marginTop: "12px", fontSize: "13px", color: "#6b7684", borderTop: "1px dashed #e5e8eb", paddingTop: "8px" }}>
                        📞 {person.contact}
                      </div>
                    )}
                    
                    {/* 참여자 삭제 버튼 */}
                    <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #f2f4f6", textAlign: "right" }}>
                      <button 
                        onClick={() => handleDeleteParticipant(person.id, person.name)}
                        style={{
                          backgroundColor: "#fff0f0",
                          color: "#ff4b4b",
                          border: "none",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: "bold",
                          cursor: "pointer"
                        }}
                      >
                        🗑️ 참여자 내보내기
                      </button>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 하단 액션 버튼 그룹 */}
      <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "10px" }}>
        
        {/* 1. 결과 복사 버튼 (메인) */}
        <button 
          onClick={handleCopyResult}
          style={{
            width: "100%",
            padding: "16px",
            backgroundColor: "#0064FF",
            color: "white",
            fontSize: "16px",
            fontWeight: "bold",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0, 100, 255, 0.2)"
          }}
        >
          📋 정산 결과 복사하기 (계좌 포함)
        </button>

        {/* 2. 참여 링크 복사 버튼 (서브 메인) */}
        <button 
          onClick={handleCopyLink}
          style={{
            width: "100%",
            padding: "16px",
            backgroundColor: "#ffffff",
            color: "#0064FF",
            fontSize: "16px",
            fontWeight: "bold",
            border: "1px solid #0064FF",
            borderRadius: "12px",
            cursor: "pointer"
          }}
        >
          🔗 참여 링크 복사하기
        </button>
      </div>

    </div>
  );
}