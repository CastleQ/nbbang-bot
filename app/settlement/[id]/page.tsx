"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { db } from "@/app/lib/firebase"; 
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

import ParticipantInput from "@/app/components/ParticipantInput"; 

// 토스트 훅 임포트
import { useToast } from "@/app/components/ToastProvider";

export default function SettlementPage() {
  const { showToast } = useToast();

  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [settlementData, setSettlementData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 중복 방지 로직
  useEffect(() => {
    if (!id) return;
    
    const isSubmitted = localStorage.getItem(`submitted_${id}`);
    
    if (isSubmitted) {
      const wantToAddMore = window.confirm("이미 참여한 정산입니다.\n추가로 작성하시겠어요?");
      
      if (!wantToAddMore) {
        router.replace(`/settlement/${id}/result`);
      }
    }
  }, [id, router]);

  // 파이어베이스에서 데이터 가져오기
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      try {
        const docRef = doc(db, "settlements", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSettlementData({ id: docSnap.id, ...docSnap.data() });
        } else {
          showToast("존재하지 않거나 삭제된 정산입니다.");
          router.push("/"); 
        }
      } catch (error) {
        console.error("데이터 로딩 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router, showToast]);

  // 참여자가 '입력 완료' 눌렀을 때 실행
  const handleParticipantSubmit = async (participantData: any) => {
    if (!window.confirm("입력한 내용으로 정산자에게 보내시겠습니까?")) {
      return;
    }

    try {
      const docRef = doc(db, "settlements", id);
      
      await updateDoc(docRef, {
        participants: arrayUnion(participantData)
      });

      // 제출 성공 시 표식 남기기
      localStorage.setItem(`submitted_${id}`, "true");

      // [수정] 두 번째 인자로 "top" 전달 -> 상단 노출 요청
      showToast("입력 완료! 결과 페이지로 이동합니다. 🚀", "top");
      
      // 즉시 이동
      router.push(`/settlement/${id}/result`);

    } catch (error) {
      console.error("업데이트 실패:", error);
      showToast("저장 중 오류가 발생했습니다.");
    }
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#6b7684" }}>로딩 중...</div>;
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