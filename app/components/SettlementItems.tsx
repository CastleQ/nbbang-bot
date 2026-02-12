"use client";

import { useState, useEffect } from "react";
import styles from "./SettlementItems.module.css";
import { useRouter } from "next/navigation";

import { db } from "../lib/firebase";
import { collection, addDoc } from "firebase/firestore"; 

// 히스토리 매니저 임포트
import { addToHistory } from "../lib/historyManager";

interface Item {
  id: number;
  category: string;
  price: string;
  method: "general" | "hourly";
  startTime?: string;
  endTime?: string;
}

export default function SettlementItems() {
  const router = useRouter();
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [participantCount, setParticipantCount] = useState("");
  const [items, setItems] = useState<Item[]>([
    { id: Date.now(), category: "", price: "", method: "general" }
  ]);
  const [totalAmount, setTotalAmount] = useState(0);

  const participantOptions = Array.from({ length: 40 }, (_, i) => i + 1);
  
  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, "0");
    return `${hour}:00`;
  });

  useEffect(() => {
    let sum = 0;
    items.forEach((item) => {
      const priceNumber = parseInt(item.price.replace(/,/g, "")) || 0;
      sum += priceNumber;
    });
    setTotalAmount(sum);
  }, [items]);

  const addItem = () => {
    const newItem: Item = {
      id: Date.now(),
      category: "",
      price: "",
      method: "general",
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (idToRemove: number) => {
    if (items.length === 1) {
      alert("최소 하나의 항목은 필요합니다.");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const handleChange = (id: number, field: keyof Item, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (field === "price") {
            value = value.replace(/[^0-9]/g, "");
            if (value) {
                value = Number(value).toLocaleString();
            }
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleMethodChange = (id: number, method: "general" | "hourly") => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return { ...item, method: method };
        }
        return item;
      })
    );
  };

  const calculateDuration = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);
    const startTotalMins = startHour * 60 + startMin;
    const endTotalMins = endHour * 60 + endMin;
    let diffMins = endTotalMins - startTotalMins;
    if (diffMins < 0) diffMins += 1440;
    if (diffMins === 0) return "0시간";
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    let text = "";
    if (hours > 0) text += `${hours}시간 `;
    if (mins > 0) text += `${mins}분`;
    if (endTotalMins < startTotalMins) {
      return `⏱️ ${text.trim()} (익일)`;
    }
    return `⏱️ 총 ${text.trim()}`;
  };

  const handleCreateSettlement = async () => {
    const sanitizedItems = items.map(item => ({
      ...item,
      price: item.price === "" ? "0" : item.price
    }));

    const sanitizedTotal = sanitizedItems.reduce((sum, item) => {
      return sum + (parseInt(item.price.replace(/,/g, "")) || 0);
    }, 0);

    if (sanitizedTotal === 0) {
      alert("총 정산 금액이 0원입니다. 금액을 확인해주세요.");
      return;
    }

    const isIncompleteTime = sanitizedItems.some(
      (item) => item.method === "hourly" && (!item.startTime || !item.endTime)
    );
    if (isIncompleteTime) {
      alert("시간 당 정산 항목의 시작/종료 시간을 모두 입력해주세요.");
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const settlerInfoStr = localStorage.getItem("settlerInfo");
      let settlerName = "알 수 없음";
      let groupName = "제목 없음";
      let settlerMessage = "";
      let bankInfo = null;

      if (settlerInfoStr) {
        const parsed = JSON.parse(settlerInfoStr);
        settlerName = parsed.accountHolder;
        groupName = parsed.groupName || new Date().toLocaleString() + " 정산";
        settlerMessage = parsed.message || "";
        
        if (parsed.bankName && parsed.accountNumber) {
            bankInfo = {
                bankName: parsed.bankName,
                accountNumber: parsed.accountNumber,
                accountHolder: parsed.accountHolder
            };
        }
      }

      const newSettlement = {
        title: groupName,
        settler: settlerName,
        settlerMessage: settlerMessage,
        participantCount: participantCount,
        items: sanitizedItems,
        totalAmount: sanitizedTotal,
        createdAt: new Date().toISOString(),
        participants: [],
        bankInfo: bankInfo
      };

      // 1. DB에 저장
      const docRef = await addDoc(collection(db, "settlements"), newSettlement);

      // 2. 히스토리 추가
      addToHistory(docRef.id);

      // [NEW] 3. 정산 생성자(관리자) 권한 부여 (로컬 스토리지에 키 저장)
      localStorage.setItem(`isCreator_${docRef.id}`, "true");

      alert("정산이 서버에 저장되었습니다! 🎉");
      window.location.reload(); 

    } catch (error) {
      console.error("Error adding document: ", error);
      alert("저장 중 오류가 발생했습니다.");
      setIsSubmitting(false); 
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>지출 항목 입력</h2>

      {items.map((item, index) => (
        <div key={item.id} className={styles.itemCard}>
          <button
            className={styles.deleteButton}
            onClick={() => removeItem(item.id)}
            title="삭제"
          >
            ×
          </button>

          <div className={styles.rowTop}>
            <input
              type="text"
              placeholder={`항목 ${index + 1} (ex. 식사)`}
              className={`${styles.input} ${styles.inputName}`}
              value={item.category}
              onChange={(e) => handleChange(item.id, "category", e.target.value)}
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="금액"
              className={`${styles.input} ${styles.inputPrice}`}
              value={item.price}
              onChange={(e) => handleChange(item.id, "price", e.target.value)}
            />
          </div>

          <div className={styles.rowBottom}>
            <div className={styles.segmentControl}>
              <button
                className={`${styles.segmentButton} ${item.method === "general" ? styles.segmentButtonActive : ""}`}
                onClick={() => handleMethodChange(item.id, "general")}
              >
                일반 정산
              </button>
              <button
                className={`${styles.segmentButton} ${item.method === "hourly" ? styles.segmentButtonActive : ""}`}
                onClick={() => handleMethodChange(item.id, "hourly")}
              >
                시간 당 정산
              </button>
            </div>

            {item.method === "hourly" && (
              <div className={styles.timeSection}>
                <div className={styles.timeInputs}>
                  <select
                    className={styles.timeSelect}
                    value={item.startTime || ""}
                    onChange={(e) => handleChange(item.id, "startTime", e.target.value)}
                  >
                    <option value="" disabled>시작 시간</option>
                    {timeOptions.map((time) => (
                      <option key={`start-${time}`} value={time}>{time}</option>
                    ))}
                  </select>
                  
                  <span style={{ margin: "0 4px", color: "#8b95a1", fontSize: "14px" }}>~</span>

                  <select
                    className={styles.timeSelect}
                    value={item.endTime || ""}
                    onChange={(e) => handleChange(item.id, "endTime", e.target.value)}
                  >
                    <option value="" disabled>종료 시간</option>
                    {timeOptions.map((time) => (
                      <option key={`end-${time}`} value={time}>{time}</option>
                    ))}
                  </select>
                </div>

                {item.startTime && item.endTime && (
                  <div className={styles.durationText}>
                    {calculateDuration(item.startTime, item.endTime)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      <button className={styles.addButton} onClick={addItem}>
        + 항목 추가하기
      </button>

      <div className={styles.participantSection}>
        <label className={styles.label}>참여 인원수</label>
        <select
          className={styles.participantSelect}
          value={participantCount}
          onChange={(e) => setParticipantCount(e.target.value)}
        >
          <option value="">선택 안함</option>
          {participantOptions.map((num) => (
            <option key={num} value={num}>
              {num}명
            </option>
          ))}
        </select>
      </div>

      <div className={styles.totalSection}>
        <span className={styles.totalLabel}>총 합계</span>
        <span className={styles.totalPrice}>
          {totalAmount.toLocaleString()}원
        </span>
      </div>

      <button 
        className={styles.nextButton} 
        onClick={handleCreateSettlement}
        disabled={isSubmitting}
        style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'wait' : 'pointer' }}
      >
        {isSubmitting ? "저장 중..." : "정산 시작하기"}
      </button>
    </div>
  );
}