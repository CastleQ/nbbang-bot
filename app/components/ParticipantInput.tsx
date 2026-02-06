"use client";

import { useState } from "react";
import styles from "./ParticipantInput.module.css";
import { useToast } from "./ToastProvider";

interface Props {
  settlementData: any; 
  onSubmit: (participantData: any) => void;
}

// 개별 항목 타입 정의
interface CustomItem {
  id: number;
  category: string;
  price: number;
}

export default function ParticipantInput({ settlementData, onSubmit }: Props) {
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [selections, setSelections] = useState<Record<number, any>>({});

  // 개별 추가 항목 상태 관리
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  
  // 아코디언 입력 폼 상태
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [newCustomCategory, setNewCustomCategory] = useState("");
  const [newCustomPrice, setNewCustomPrice] = useState("");

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2).toString().padStart(2, "0");
    const minute = ((i % 2) * 30).toString().padStart(2, "0");
    return `${hour}:${minute}`;
  });

  const toggleItem = (itemId: number, method: string, defaultStart?: string, defaultEnd?: string) => {
    setSelections((prev) => {
      const current = prev[itemId];
      if (current?.joined) {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      }
      const newSelection: any = { joined: true };
      if (method === "hourly") {
        newSelection.startTime = defaultStart || "";
        newSelection.endTime = defaultEnd || "";
      }
      return { ...prev, [itemId]: newSelection };
    });
  };

  const handleTimeChange = (itemId: number, field: "startTime" | "endTime", value: string) => {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  // 개별 항목 추가 함수
  const handleAddCustomItem = () => {
    if (!newCustomCategory.trim()) {
      showToast("항목 이름을 입력해주세요.");
      return;
    }
    if (!newCustomPrice || parseInt(newCustomPrice.replace(/,/g, "")) === 0) {
      showToast("금액을 입력해주세요.");
      return;
    }

    const newItem: CustomItem = {
      id: Date.now(),
      category: newCustomCategory,
      price: parseInt(newCustomPrice.replace(/,/g, "")),
    };

    setCustomItems([...customItems, newItem]);
    
    // 입력창 초기화 및 닫기
    setNewCustomCategory("");
    setNewCustomPrice("");
    setIsCustomFormOpen(false);
    showToast("항목이 추가되었습니다.");
  };

  // 개별 항목 삭제 함수
  const handleDeleteCustomItem = (id: number) => {
    setCustomItems(customItems.filter((item) => item.id !== id));
  };

  // 개별 항목 금액 입력 포맷팅
  const handleCustomPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    setNewCustomPrice(value ? Number(value).toLocaleString() : "");
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      showToast("이름을 입력해주세요.");
      return;
    }

    const selectedItemsCount = Object.keys(selections).length;
    // 개별 항목이 있다면 선택된 공통 항목이 없어도 통과
    if (selectedItemsCount === 0 && customItems.length === 0) {
      showToast("최소 하나의 항목에 참여하거나 추가해야 합니다.");
      return;
    }

    for (const itemId in selections) {
      const sel = selections[itemId];
      const originalItem = settlementData.items.find((i: any) => i.id === Number(itemId));
      
      if (originalItem?.method === "hourly") {
        if (!sel.startTime || !sel.endTime) {
          showToast(`'${originalItem.category}' 항목의 시간을 선택해주세요.`);
          return;
        }
      }
    }

    const participantData = {
      id: Date.now(),
      name: name,
      contact: contact || "",
      selections: selections,
      customItems: customItems, // 개별 항목 데이터 포함
      submittedAt: new Date().toISOString(),
    };

    onSubmit(participantData);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{settlementData.title}</h1>
        <div className={styles.subtitle}>
          정산자: {settlementData.settler}
        </div>
        {settlementData.settlerMessage && (
          <div className={styles.messageBox}>
            <span className={styles.messageLabel}>📢 전달사항</span>
            {settlementData.settlerMessage}
          </div>
        )}
      </header>

      {/* 1. 이름 및 연락처 입력 */}
      <section className={styles.section}>
        <div style={{ marginBottom: "16px" }}>
          <label className={styles.label}>
            이름<span className={styles.required}>*</span>
          </label>
          <input 
            type="text" 
            className={styles.input} 
            placeholder="실명 또는 닉네임"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className={styles.label}>연락처</label>
          <input 
            type="text"
            inputMode="tel" 
            className={styles.input} 
            placeholder="010-1234-5678"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
        </div>
      </section>

      {/* 2. 항목 리스트 */}
      <section className={styles.section}>
        <label className={styles.label}>지출 항목 선택</label>
        
        <p className={styles.helperText}>
          본인이 참여한 항목을 선택해주세요.
        </p>
        
        {/* 기존 공통 항목들 */}
        {settlementData.items.map((item: any) => {
          const isSelected = selections[item.id]?.joined;
          return (
            <div 
              key={item.id} 
              className={`${styles.itemCard} ${isSelected ? styles.itemCardActive : ""}`}
            >
              <div 
                className={styles.itemHeader}
                onClick={() => toggleItem(item.id, item.method, item.startTime, item.endTime)}
              >
                <div>
                  <div className={styles.itemName}>{item.category}</div>
                  <div className={styles.itemPrice}>
                    {Number(item.price.replace(/,/g, "")).toLocaleString()}원
                    {item.method === "hourly" && <span style={{fontSize: '12px', color: '#0064FF', marginLeft: '4px'}}> (시간당)</span>}
                  </div>
                </div>
                <div className={styles.checkboxContainer}>
                  <div className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ""}`}>
                    {isSelected && "✔"}
                  </div>
                </div>
              </div>

              {item.method === "hourly" && isSelected && (
                <div className={styles.timeSection}>
                  <p className={styles.timeDesc}>참여한 시간을 설정해주세요</p>
                  <div className={styles.timeInputs}>
                    <select
                      className={styles.timeSelect}
                      value={selections[item.id].startTime || ""}
                      onChange={(e) => handleTimeChange(item.id, "startTime", e.target.value)}
                    >
                      {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span>~</span>
                    <select
                      className={styles.timeSelect}
                      value={selections[item.id].endTime || ""}
                      onChange={(e) => handleTimeChange(item.id, "endTime", e.target.value)}
                    >
                      {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* 사용자가 추가한 개별 항목들 표시 */}
        {customItems.map((item) => (
          <div key={item.id} className={`${styles.itemCard} ${styles.itemCardActive}`}>
            <div className={styles.itemHeader}>
              <div>
                <div className={styles.itemName} style={{ color: "#0064FF" }}>
                  {item.category} (직접 추가)
                </div>
                <div className={styles.itemPrice}>
                  {item.price.toLocaleString()}원
                </div>
              </div>
              
              <button 
                onClick={() => handleDeleteCustomItem(item.id)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  color: "#ff4b4b",
                  cursor: "pointer",
                  padding: "0 10px"
                }}
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {/* 항목 추가하기 버튼 및 폼 */}
        <div style={{ marginTop: "10px", borderTop: "1px dashed #e5e8eb", paddingTop: "10px" }}>
          {!isCustomFormOpen ? (
            <button
              onClick={() => setIsCustomFormOpen(true)}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#f2f4f6",
                border: "none",
                borderRadius: "8px",
                color: "#333d4b",
                fontWeight: 600,
                fontSize: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <span>+</span>항목 직접 추가하기
            </button>
          ) : (
            <div className={styles.itemCard} style={{ padding: "16px", backgroundColor: "#fff" }}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "13px", color: "#6b7684", display: "block", marginBottom: "6px" }}>항목 이름</label>
                <input 
                  type="text"
                  placeholder="예: 커피값, 내가 시킨 메뉴"
                  className={styles.input}
                  value={newCustomCategory}
                  onChange={(e) => setNewCustomCategory(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "13px", color: "#6b7684", display: "block", marginBottom: "6px" }}>금액</label>
                <input 
                  type="text"
                  inputMode="numeric"
                  placeholder="금액 입력"
                  className={styles.input}
                  value={newCustomPrice}
                  onChange={handleCustomPriceChange}
                />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setIsCustomFormOpen(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    backgroundColor: "#f2f4f6",
                    border: "none",
                    borderRadius: "8px",
                    color: "#6b7684",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleAddCustomItem}
                  style={{
                    flex: 2,
                    padding: "10px",
                    backgroundColor: "#0064FF",
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  추가하기
                </button>
              </div>

              {/* [NEW] 안내 문구 추가 */}
              <p style={{ 
                marginTop: "12px", 
                fontSize: "10px", 
                color: "#6b7684", 
                textAlign: "left" 
              }}>
                ※내가 추가로 지불할 항목이 있을 때만 추가해요.
              </p>

            </div>
          )}
        </div>

      </section>

      <button className={styles.submitButton} onClick={handleSubmit}>
        입력 완료
      </button>
      
      <div style={{ height: "60px" }}></div>
    </div>
  );
}