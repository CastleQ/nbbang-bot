"use client";

import { useState } from "react";
import SettlerInfoForm from "./components/SettlerInfoForm";
import SettlementItems from "./components/SettlementItems";
import Dashboard from "./components/Dashboard";
import SettlementDetail from "./components/SettlementDetail";
import ParticipantInput from "./components/ParticipantInput";

export default function Home() {
  // view 상태: 'dashboard' | 'step1' | 'step2' | 'detail' | 'participant_view'
  const [view, setView] = useState("dashboard");
  
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);

  // [NEW] 참여자 입력 데이터 저장 로직
  const handleParticipantSubmit = (participantData: any) => {
    // 1. 현재 저장된 모든 정산 내역을 불러옴
    const savedHistory = localStorage.getItem("settlementHistory");
    if (!savedHistory || !selectedSettlement) return;

    let history = JSON.parse(savedHistory);

    // 2. 현재 선택된 정산(ID로 식별)을 찾아서 참여자 목록에 추가
    const updatedHistory = history.map((settlement: any) => {
      if (settlement.id === selectedSettlement.id) {
        // 기존 참여자 목록이 없으면 빈 배열로 시작
        const currentParticipants = settlement.participants || [];
        
        // 새로운 정산 데이터 객체 리턴 (참여자 추가됨)
        return {
          ...settlement,
          participants: [...currentParticipants, participantData]
        };
      }
      return settlement;
    });

    // 3. 로컬 스토리지 업데이트 (저장)
    localStorage.setItem("settlementHistory", JSON.stringify(updatedHistory));

    // 4. 현재 보고 있는 상세 화면(selectedSettlement)의 상태도 업데이트해줘야 바로 반영됨
    const updatedSettlement = updatedHistory.find((s: any) => s.id === selectedSettlement.id);
    setSelectedSettlement(updatedSettlement);

    // 5. 알림 및 화면 복귀
    alert(`'${participantData.name}'님의 입력이 저장되었습니다!`);
    setView("detail"); // 다시 상세 내역(영수증)으로 돌아감
  };

  return (
    <main style={{ backgroundColor: "#f2f4f6", minHeight: "100vh" }}>
      
      {/* 0. 대시보드 */}
      {view === "dashboard" && (
        <Dashboard 
          onCreateClick={() => setView("step1")} 
          onItemClick={(item) => {
            setSelectedSettlement(item);
            setView("detail");
          }}
        />
      )}

      {/* 0-1. 상세 내역 (영수증) */}
      {view === "detail" && selectedSettlement && (
        <SettlementDetail 
          data={selectedSettlement}
          onBack={() => {
            setSelectedSettlement(null);
            setView("dashboard");
          }}
          // 링크 테스트 버튼 누르면 참여자 화면으로 이동
          onLinkTest={() => setView("participant_view")}
        />
      )}

      {/* 참여자 입력 화면 (실제 데이터 저장 연결됨) */}
      {view === "participant_view" && selectedSettlement && (
        <ParticipantInput 
          settlementData={selectedSettlement}
          onSubmit={handleParticipantSubmit} // [수정됨] 저장 함수 연결
        />
      )}

      {/* 1. 정산자 정보 입력 */}
      {view === "step1" && (
        <SettlerInfoForm 
          onNext={() => setView("step2")} 
        />
      )}

      {/* 2. 지출 항목 입력 */}
      {view === "step2" && (
        <SettlementItems />
      )}

    </main>
  );
}