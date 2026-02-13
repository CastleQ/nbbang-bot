"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/app/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

import SettlementItems from "@/app/components/SettlementItems";

export default function SettlementEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 관리자 권한 체크 (로컬 스토리지 키 확인)
    const isCreator = localStorage.getItem(`isCreator_${id}`);
    if (isCreator !== "true") {
      alert("수정 권한이 없습니다.");
      router.replace(`/settlement/${id}/result`); // 권한 없으면 결과 페이지로 튕겨냄
      return;
    }

    // 2. 데이터 가져오기
    const fetchData = async () => {
      try {
        const docRef = doc(db, "settlements", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData(docSnap.data());
        } else {
          alert("존재하지 않는 정산입니다.");
          router.push("/");
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, router]);

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#6b7684" }}>로딩 중...</div>;
  if (!data) return null;

  return (
    // 기존 컴포넌트에 initialData와 docId를 넘겨주면 '수정 모드'로 작동
    <SettlementItems initialData={data} docId={id} />
  );
}