"use client";

import { useState, useEffect } from "react";
import styles from "./SettlerInfo.module.css";

interface SettlerData {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  groupName: string;
  contact: string;
  message: string;
}

interface Props {
  onNext: () => void;
}

export default function SettlerInfoForm({ onNext }: Props) {
  const [formData, setFormData] = useState<SettlerData>({
    bankName: "",
    accountNumber: "",
    accountHolder: "",
    groupName: "",
    contact: "",
    message: "",
  });

  const getDefaultTitle = () => {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${yy}-${mm}-${dd} ${hour}:${min} 정산`;
  };

  useEffect(() => {
    const savedData = localStorage.getItem("settlerInfo");
    const defaultTitle = getDefaultTitle();

    if (savedData) {
      const parsed = JSON.parse(savedData);
      setFormData({
        ...parsed, 
        groupName: defaultTitle, 
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        groupName: defaultTitle,
      }));
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.bankName ||
      !formData.accountNumber ||
      !formData.accountHolder
    ) {
      alert("은행명, 계좌번호, 예금주는 필수입니다.");
      return;
    }

    const dataToSave = {
      ...formData,
    };

    localStorage.setItem("settlerInfo", JSON.stringify(dataToSave));
    
    alert("지출 항목 입력으로 이동할께요!");
    onNext(); 
  };

  return (
    <form className={styles.container} onSubmit={handleSubmit}>
      <h2 className={styles.title}>정산자 정보 입력</h2>

      <div className={styles.row}>
        <div className={styles.inputGroup}>
          <label className={styles.label}>
            은행명<span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            name="bankName"
            value={formData.bankName}
            onChange={handleChange}
            placeholder="예: 토스"
            className={styles.input}
          />
        </div>

        <div className={styles.inputGroup}>
          <label className={styles.label}>
            예금주<span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            name="accountHolder"
            value={formData.accountHolder}
            onChange={handleChange}
            placeholder="본인 실명"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>
          계좌번호<span className={styles.required}>*</span>
        </label>
        {/* [수정됨] 계좌번호 입력란에만 숫자 키패드 적용 */}
        <input
          type="text"
          inputMode="numeric"
          name="accountNumber"
          value={formData.accountNumber}
          onChange={handleChange}
          placeholder="하이픈(-) 없이 입력해주세요"
          className={styles.input}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>정산 이름</label>
        <input
          type="text"
          name="groupName"
          value={formData.groupName}
          onChange={handleChange}
          placeholder="예: 91-05-12 18:30 정산"
          className={styles.input}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>연락처</label>
        {/* 연락처는 다양한 입력이 가능하도록 일반 텍스트 모드 유지 */}
        <input
          type="text"
          name="contact"
          value={formData.contact}
          onChange={handleChange}
          className={styles.input}
        />
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label}>참여자 전달사항</label>
        <textarea
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder="예: 입금하시고 톡 하나 남겨주세요!"
          className={styles.input}
          style={{
            resize: "vertical",
            minHeight: "80px",
            fontFamily: "inherit",
          }}
        />
      </div>

      <button type="submit" className={styles.button}>
        입력 완료 (다음)
      </button>
    </form>
  );
}