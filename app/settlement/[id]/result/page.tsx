"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

// 이미 만들어둔 컴포넌트 임포트
import SettlementDetail from "@/app/components/SettlementDetail";

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 실시간 데이터 구독 (Real-time Listener)
  useEffect(() => {
    if (!id) return;

    // getDoc 대신 onSnapshot을 사용하여 실시간 변화 감지
    const unsubscribe = onSnapshot(doc(db, "settlements", id), (doc) => {
      if (doc.exists()) {
        setData({ id: doc.id, ...doc.data() });
      } else {
        alert("존재하지 않는 정산입니다.");
        router.push("/");
      }
      setLoading(false);
    });

    // 컴포넌트가 꺼질 때 구독 해제 (메모리 누수 방지)
    return () => unsubscribe();
  }, [id, router]);

  // 로딩 중 표시
  if (loading) return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      height: "100vh", 
      color: "#6b7684",
      fontSize: "14px"
    }}>
      결과 불러오는 중...
    </div>
  );

  if (!data) return null;

  return (
    <SettlementDetail 
      data={data}
      onBack={() => router.push("/")} // '목록으로 돌아가기' 버튼 클릭 시 홈으로 이동
      onLinkTest={() => console.log("Link test clicked")} // (테스트용 기능은 로그만 출력)
    />
  );
}