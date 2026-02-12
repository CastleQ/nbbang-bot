"use client";

import { useState, useEffect } from "react";
import styles from "./SettlementDetail.module.css";

// Firebase 모듈
import { db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

// 토스트 훅 가져오기
import { useToast } from "./ToastProvider";

interface Props {
  data: any; 
  onBack: () => void; 
  onLinkTest: () => void;
}

export default function SettlementDetail({ data, onBack, onLinkTest }: Props) {
  const { showToast } = useToast();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isTotalExpanded, setIsTotalExpanded] = useState(false);

  // 참여자 목록 State
  const [participants, setParticipants] = useState<any[]>(data.participants || []);

  // 수정 모달 관련 State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<any>(null);

  // 관리자(정산 생성자) 여부 State
  const [isCreator, setIsCreator] = useState(false);

  // 관리자 여부 확인 (useEffect)
  useEffect(() => {
    // 로컬 스토리지에서 생성자 표식 확인
    const creatorMark = localStorage.getItem(`isCreator_${data.id}`);
    if (creatorMark === "true") {
        setIsCreator(true);
    }
  }, [data.id]);

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2).toString().padStart(2, "0");
    const minute = ((i % 2) * 30).toString().padStart(2, "0");
    return `${hour}:${minute}`;
  });

  const toggleAccordion = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

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

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return "0시간";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    let text = "";
    if (h > 0) text += `${h}시간 `;
    if (m > 0) text += `${m}분`;
    return text.trim();
  };

  // 정산 계산 로직
  const calculateSettlement = () => {
    const results: Record<number, { total: 0, details: any[] }> = {};
    const targetParticipants = participants; 

    targetParticipants.forEach((p: any) => {
      results[p.id] = { total: 0, details: [] };
    });

    data.items.forEach((item: any) => {
      const itemPrice = parseInt(item.price.replace(/,/g, "")) || 0;
      const joinedParticipants = targetParticipants.filter((p: any) => p.selections[item.id]?.joined);
      const joinedCount = joinedParticipants.length;

      if (joinedCount === 0) return; 

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
      } else {
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

  // 참여자 삭제
  const handleDeleteParticipant = async (participantId: number, participantName: string) => {
    if (!confirm(`'${participantName}'님을 목록에서 제외하시겠습니까?\n(이 작업은 되돌릴 수 없습니다.)`)) {
      return;
    }
    try {
      const newParticipants = participants.filter((p) => p.id !== participantId);
      const docRef = doc(db, "settlements", data.id);
      await updateDoc(docRef, { participants: newParticipants });
      setParticipants(newParticipants);
      showToast("참여자가 삭제되었습니다.");
    } catch (error) {
      console.error("Error removing participant:", error);
      showToast("삭제 중 오류가 발생했습니다.");
    }
  };

  const openEditModal = (participant: any) => {
    setEditingParticipant(JSON.parse(JSON.stringify(participant)));
    setIsEditModalOpen(true);
  };

  const handleEditChange = (itemId: number, field: string, value: any) => {
    setEditingParticipant((prev: any) => {
      const newSelections = { ...prev.selections };
      if (!newSelections[itemId]) {
        newSelections[itemId] = { joined: false };
      }

      if (field === "joined") {
        if (newSelections[itemId].joined) {
           delete newSelections[itemId]; 
        } else {
           newSelections[itemId] = { joined: true, startTime: "", endTime: "" };
           const item = data.items.find((i: any) => i.id === itemId);
           if (item?.method === "hourly") {
             newSelections[itemId].startTime = item.startTime || "00:00";
             newSelections[itemId].endTime = item.endTime || "00:00";
           }
        }
      } else {
        newSelections[itemId] = { ...newSelections[itemId], [field]: value };
      }
      return { ...prev, selections: newSelections };
    });
  };

  const handleSaveEdit = async () => {
    if (!editingParticipant) return;
    try {
      const newParticipants = participants.map((p) => 
        p.id === editingParticipant.id ? editingParticipant : p
      );
      const docRef = doc(db, "settlements", data.id);
      await updateDoc(docRef, { participants: newParticipants });
      setParticipants(newParticipants);
      setIsEditModalOpen(false);
      setEditingParticipant(null);
      showToast("수정되었습니다.");
    } catch (error) {
      console.error("Error updating participant:", error);
      showToast("수정 중 오류가 발생했습니다.");
    }
  };


  const handleCopyResult = () => {
    let bankText = "";
    if (data.bankInfo) {
        bankText = `${data.bankInfo.bankName} ${data.bankInfo.accountNumber} (${data.bankInfo.accountHolder})`;
    } else {
        const settlerInfoStr = localStorage.getItem("settlerInfo");
        if (settlerInfoStr) {
            const { bankName, accountNumber, accountHolder } = JSON.parse(settlerInfoStr);
            bankText = `${bankName} ${accountNumber} (${accountHolder})`;
        }
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
      .then(() => showToast("정산 결과가 복사되었습니다!"))
      .catch(() => showToast("복사에 실패했습니다."));
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/settlement/${data.id}`;
    navigator.clipboard.writeText(link)
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
                    
                    {/* [수정] 관리 버튼 그룹 (관리자에게만 표시) */}
                    {isCreator && (
                        <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #f2f4f6", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button 
                                onClick={() => openEditModal(person)}
                                style={{
                                backgroundColor: "#f2f4f6",
                                color: "#333d4b",
                                border: "none",
                                padding: "8px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "bold",
                                cursor: "pointer"
                                }}
                            >
                                ✏️ 수정
                            </button>
                            
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
                                🗑️ 삭제
                            </button>
                        </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "10px" }}>
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

      {/* 수정 모달 */}
      {isEditModalOpen && editingParticipant && (
        <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000,
            display: "flex", justifyContent: "center", alignItems: "center", padding: "20px"
        }}>
            <div style={{
                backgroundColor: "white", width: "100%", maxWidth: "500px",
                borderRadius: "16px", padding: "24px", maxHeight: "80vh", overflowY: "auto"
            }}>
                <h3 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: "bold" }}>
                    참여자 정보 수정 ({editingParticipant.name})
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {data.items.map((item: any) => {
                        const isSelected = editingParticipant.selections[item.id]?.joined;
                        const sel = editingParticipant.selections[item.id] || {};

                        // 시작 시간에 따른 종료 시간 필터링
                        const startIdx = sel.startTime ? timeOptions.indexOf(sel.startTime) : -1;
                        const availableEndTimes = startIdx !== -1 ? timeOptions.slice(startIdx) : timeOptions;

                        return (
                            <div key={item.id} style={{ 
                                border: isSelected ? "1px solid #0064FF" : "1px solid #e5e8eb",
                                borderRadius: "12px", padding: "16px",
                                backgroundColor: isSelected ? "#f2f8ff" : "white"
                            }}>
                                <div 
                                    onClick={() => handleEditChange(item.id, "joined", !isSelected)}
                                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                                >
                                    <div>
                                        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{item.category}</div>
                                        <div style={{ fontSize: "12px", color: "#6b7684" }}>
                                            {Number(item.price.replace(/,/g, "")).toLocaleString()}원
                                            {item.method === "hourly" && " (시간당)"}
                                        </div>
                                    </div>
                                    <div style={{ 
                                        width: "24px", height: "24px", borderRadius: "50%", 
                                        border: isSelected ? "none" : "2px solid #d1d6db",
                                        backgroundColor: isSelected ? "#0064FF" : "transparent",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: "white", fontSize: "14px"
                                    }}>
                                        {isSelected && "✔"}
                                    </div>
                                </div>

                                {item.method === "hourly" && isSelected && (
                                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed #cce0ff" }}>
                                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                            <select 
                                                value={sel.startTime || ""}
                                                onChange={(e) => handleEditChange(item.id, "startTime", e.target.value)}
                                                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #d1d6db" }}
                                            >
                                                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <span>~</span>
                                            <select 
                                                value={sel.endTime || ""}
                                                onChange={(e) => handleEditChange(item.id, "endTime", e.target.value)}
                                                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #d1d6db" }}
                                            >
                                                {availableEndTimes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginTop: "24px", display: "flex", gap: "10px" }}>
                    <button 
                        onClick={() => setIsEditModalOpen(false)}
                        style={{ flex: 1, padding: "14px", borderRadius: "10px", border: "none", backgroundColor: "#f2f4f6", color: "#4e5968", fontWeight: "bold", cursor: "pointer" }}
                    >
                        취소
                    </button>
                    <button 
                        onClick={handleSaveEdit}
                        style={{ flex: 2, padding: "14px", borderRadius: "10px", border: "none", backgroundColor: "#0064FF", color: "white", fontWeight: "bold", cursor: "pointer" }}
                    >
                        수정 완료
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}