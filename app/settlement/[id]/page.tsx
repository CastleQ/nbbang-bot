"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { db } from "@/app/lib/firebase"; 
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

import ParticipantInput from "@/app/components/ParticipantInput"; 

// [NEW] 토스트 훅 임포트 (경로 주의: @/app/components/...)
import { useToast } from "@/app/components/ToastProvider";

export default function SettlementPage() {
  // [NEW] 토스트 리모컨 꺼내기
  const { showToast } = useToast();

  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [settlementData, setSettlementData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. 파이어베이스에서 데이터 가져오기
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      try {
        const docRef = doc(db, "settlements", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSettlementData({ id: docSnap.id, ...docSnap.data() });
        } else {
          // [수정] Alert -> Toast
          showToast("존재하지 않거나 삭제된 정산입니다.");
          router.push("/"); // 홈으로 튕겨내기
        }
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router, showToast]);

  // 2. 참여자가 '입력 완료' 눌렀을 때 실행 (DB 업데이트)
  const handleParticipantSubmit = async (participantData: any) => {
    try {
      const docRef = doc(db, "settlements", id);
      
      // 배열에 새로운 참여자 추가 (arrayUnion 사용)
      await updateDoc(docRef, {
        participants: arrayUnion(participantData)
      });

      // [수정] Alert -> Toast + 지연 새로고침
      showToast("입력 완료! 정산자에게 전달됩니다.");
      
      // 토스트 메시지가 읽힐 시간을 주기 위해 1.5초 뒤에 새로고침
      setTimeout(() => {
        window.location.reload(); 
      }, 1000);

    } catch (error) {
      console.error("업데이트 실패:", error);
      showToast("저장 중 오류가 발생했습니다.");
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center" }}>로딩 중...</div>;
  if (!settlementData) return null;

  return (
    <div style={{ backgroundColor: "#f2f4f6", minHeight: "100vh" }}>
      <ParticipantInput 
        settlementData={settlementData}
        onSubmit={handleParticipantSubmit}
      />
    </div>
  );
}