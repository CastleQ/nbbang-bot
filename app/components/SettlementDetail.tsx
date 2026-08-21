"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import styles from "./SettlementDetail.module.css";

// Firebase 모듈
import { db } from "../lib/firebase";
import { doc, runTransaction } from "firebase/firestore";

// 토스트 훅 가져오기
import { useToast } from "./ToastProvider";

// 데이터 청사진(타입) 및 검증된 계산 엔진 연결
import type { Settlement, Participant, Selection, Item } from "../lib/types";
import { calculateSettlement, getTotalAmount, toNumber } from "../lib/settlement";

interface Props {
  data: Settlement;
  onBack: () => void;
  onLinkTest: () => void;
}

export default function SettlementDetail({ data, onBack, onLinkTest }: Props) {
  const { showToast } = useToast();
  const router = useRouter();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isTotalExpanded, setIsTotalExpanded] = useState(false);

  // 참여자 목록 State
  const [participants, setParticipants] = useState<Participant[]>(data.participants || []);

  // 수정 모달 관련 State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);

  // 정산 생성자(나) 여부 State
  const [isCreator, setIsCreator] = useState(false);

  // 정산 생성자(나) 여부 확인 (useEffect)
  useEffect(() => {
    // 로컬 스토리지에서 생성자 표식 확인 (※ 클라이언트 가드일 뿐, 서버측 인증은 Phase 6에서 도입)
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

  const toggleAccordion = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // === 계산: settlement.ts의 검증된 순수 함수 사용 + useMemo로 캐싱 [M1/M2] ===
  const settlementResults = useMemo(
    () => calculateSettlement(data.items, participants),
    [data.items, participants]
  );

  // 전체 지출 총액(A안: 공통항목 + 참여자 개별항목) — 저장값 대신 계산으로 도출 [F2]
  const totalAmount = useMemo(
    () => getTotalAmount(data.items, participants),
    [data.items, participants]
  );

  // 총액 상세에 표기할 "참여자 개별 추가" 합계
  const customItemsTotal = useMemo(
    () =>
      participants.reduce(
        (sum, p) => sum + (p.customItems ?? []).reduce((s, c) => s + toNumber(c.price), 0),
        0
      ),
    [participants]
  );

  // 참여자 삭제 — 서버 최신본 기준 트랜잭션으로 동시성 유실 방지 [F5]
  const handleDeleteParticipant = async (participantId: string, participantName: string) => {
    if (!confirm(`'${participantName}'님을 목록에서 제외하시겠습니까?\n(이 작업은 되돌릴 수 없습니다.)`)) {
      return;
    }
    try {
      const docRef = doc(db, "settlements", data.id);
      const updated = await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists()) throw new Error("정산 문서를 찾을 수 없습니다.");
        const current = (snap.data().participants ?? []) as Participant[];
        const next = current.filter((p) => String(p.id) !== String(participantId));
        tx.update(docRef, { participants: next });
        return next;
      });
      setParticipants(updated);
      showToast("참여자가 삭제되었습니다.");
    } catch (error) {
      console.error("Error removing participant:", error);
      showToast("삭제 중 오류가 발생했습니다.");
    }
  };

  const openEditModal = (participant: Participant) => {
    // 깊은 복사 후 편집 (원본 즉시 변경 방지)
    const clone = JSON.parse(JSON.stringify(participant)) as Participant;
    setEditingParticipant(clone);
    setIsEditModalOpen(true);
  };

  const handleEditChange = (
    itemId: string,
    field: "joined" | "startTime" | "endTime",
    value: string | boolean
  ) => {
    setEditingParticipant((prev) => {
      if (!prev) return prev;
      const newSelections: Record<string, Selection> = { ...prev.selections };

      if (field === "joined") {
        if (newSelections[itemId]?.joined) {
          delete newSelections[itemId];
        } else {
          const item = data.items.find((i) => String(i.id) === String(itemId));
          const next: Selection = { joined: true, startTime: "", endTime: "" };
          if (item?.method === "hourly") {
            next.startTime = item.startTime || "00:00";
            next.endTime = item.endTime || "00:00";
          }
          newSelections[itemId] = next;
        }
      } else {
        const existing = newSelections[itemId] ?? { joined: true };
        newSelections[itemId] = { ...existing, [field]: String(value) };
      }
      return { ...prev, selections: newSelections };
    });
  };

  // 참여자 수정 저장 — 트랜잭션으로 동시성 유실 방지 [F5]
  const handleSaveEdit = async () => {
    if (!editingParticipant) return;
    const edited = editingParticipant;
    try {
      const docRef = doc(db, "settlements", data.id);
      const updated = await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        if (!snap.exists()) throw new Error("정산 문서를 찾을 수 없습니다.");
        const current = (snap.data().participants ?? []) as Participant[];
        const next = current.map((p) => (String(p.id) === String(edited.id) ? edited : p));
        tx.update(docRef, { participants: next });
        return next;
      });
      setParticipants(updated);
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
    resultText += `총 ${totalAmount.toLocaleString()}원\n\n`;
    resultText += `👇 정산 결과\n`;

    if (participants.length === 0) {
      resultText += `(아직 참여자가 없습니다)\n`;
    } else {
      participants.forEach((p) => {
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
      {/* 상단 네비게이션: 양쪽 정렬(Space Between) 적용 */}
      <nav className={styles.nav} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} className={styles.backButton}>
          ← 목록으로 돌아가기
        </button>

        {/* 정산 생성자(나)에게만 보이는 텍스트형 수정 버튼 */}
        {isCreator && (
          <button
            onClick={() => router.push(`/settlement/${data.id}/edit`)}
            style={{
              background: "none",
              border: "none",
              color: "#8b95a1", // 은은한 회색 (Toss Style)
              fontSize: "15px",
              fontWeight: "400",
              cursor: "pointer",
              padding: "8px", // 터치 영역 확보
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            ⚙️ 항목 추가/수정
          </button>
        )}
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
            {totalAmount.toLocaleString()}원
            <span className={`${styles.arrow} ${isTotalExpanded ? styles.arrowOpen : ""}`}>
              ▼
            </span>
          </div>
        </div>

        {isTotalExpanded && (
          <div className={styles.accordionContent}>
            {data.items.map((item: Item) => (
              <div key={item.id} className={styles.detailRow}>
                <div className={styles.detailLeft}>
                  <span>{item.category}</span>
                  {item.method === "hourly" ? (
                    <span className={styles.detailTime}>시간당 정산 (전체 {toNumber(item.price).toLocaleString()}원)</span>
                  ) : (
                    <span className={styles.detailTime}>일반 정산</span>
                  )}
                </div>
                <span>{toNumber(item.price).toLocaleString()}원</span>
              </div>
            ))}

            {/* 참여자 개별 추가 합계 (A안: 총액에 포함되므로 상세에도 표기) */}
            {customItemsTotal > 0 && (
              <div className={styles.detailRow}>
                <div className={styles.detailLeft}>
                  <span>참여자 개별 추가</span>
                  <span className={styles.detailTime}>각자 직접 추가한 항목 합계</span>
                </div>
                <span>{customItemsTotal.toLocaleString()}원</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 참여자별 정산 현황 */}
      <section>
        <h3 className={styles.sectionTitle}>참여자별 정산 현황</h3>

        {participants.length === 0 && (
          <div style={{ textAlign: "center", color: "#8b95a1", padding: "20px", fontSize: "14px" }}>
            아직 입력한 참여자가 없습니다.<br/>
            참여 링크를 복사하여 참여자들에게 공유해보세요!
          </div>
        )}

        <div className={styles.accordionList}>
          {participants.map((person: Participant) => {
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
                    {myResult.details.map((detail, idx) => (
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

                    {/* 연락처는 정산자에게만 표시 [S2] */}
                    {isCreator && person.contact && (
                      <div style={{ marginTop: "12px", fontSize: "13px", color: "#6b7684", borderTop: "1px dashed #e5e8eb", paddingTop: "8px" }}>
                        📞 {person.contact}
                      </div>
                    )}

                    {/* 수정/삭제 버튼 그룹 (정산 생성자에게만 표시) */}
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
              {data.items.map((item: Item) => {
                const isSelected = editingParticipant.selections[item.id]?.joined;
                const sel = editingParticipant.selections[item.id];

                // 시작 시간에 따른 종료 시간 필터링
                const startIdx = sel?.startTime ? timeOptions.indexOf(sel.startTime) : -1;
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
                          {toNumber(item.price).toLocaleString()}원
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
                            value={sel?.startTime || ""}
                            onChange={(e) => handleEditChange(item.id, "startTime", e.target.value)}
                            style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #d1d6db" }}
                          >
                            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <span>~</span>
                          <select
                            value={sel?.endTime || ""}
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
