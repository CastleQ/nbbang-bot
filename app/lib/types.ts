// app/lib/types.ts
// 쓰스로(Sssro) 데이터 청사진(설계도)
// - 이 파일은 "데이터의 모양"을 한 곳에 정의합니다.
// - 이후 모든 화면/로직 파일이 이 타입들을 import 해서 재사용합니다. (any 대체용)
//
// [하위호환 메모 — 0-2 A안]
// 옛 정산 문서는 금액이 "1,000" 같은 문자열, id가 숫자로 저장돼 있을 수 있습니다.
// 아래 타입은 "정규화 이후"의 표준 모양(금액=number, id=string)입니다.
// Firestore에서 읽은 원본은 Phase 2의 toNumber/정규화를 거쳐 이 모양으로 변환됩니다.

/** 정산 방식: 일반(1/N) 또는 시간당 비례 */
export type SettlementMethod = "general" | "hourly";

/** 정산자가 등록한 공통 지출 항목 */
export interface Item {
  id: string; // 신규는 uuid. 옛 숫자 id도 문자열 키로 취급.
  category: string; // 항목 이름 (예: "치킨", "파티룸 대여")
  price: number; // 금액(원). 내부 표준은 숫자.
  method: SettlementMethod; // "general" | "hourly"
  startTime?: string; // "HH:MM" — 시간당(hourly)일 때만 사용
  endTime?: string; // "HH:MM"
}

/** 참여자가 자기 몫으로 직접 추가한 개별 항목 */
export interface CustomItem {
  id: string;
  category: string;
  price: number;
}

/** 참여자가 특정 항목에 참여했는지 + (시간당이면) 참여 시간 */
export interface Selection {
  joined: boolean;
  startTime?: string; // "HH:MM"
  endTime?: string; // "HH:MM"
}

/** 정산 참여자 한 명 */
export interface Participant {
  id: string;
  name: string;
  contact?: string; // 연락처(선택 입력)
  selections: Record<string, Selection>; // key = 참여한 Item의 id
  customItems: CustomItem[]; // 직접 추가한 개별 항목들
  submittedAt: string; // 제출 시각 (ISO 문자열)
}

/** 입금 계좌 정보 */
export interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

/** 정산 전체 문서 (Firestore의 settlements 컬렉션 1건) */
export interface Settlement {
  id: string;
  title: string; // 정산 제목
  settler: string; // 정산자 이름
  settlerMessage?: string; // 정산자 전달사항(선택)
  participantCount?: number; // 예상 참여 인원(선택)
  items: Item[]; // 정산자가 등록한 공통 항목들
  participants: Participant[]; // 참여자 목록
  totalAmount: number; // 공통 항목 총액(원). 참여자 개별항목은 Phase 2의 파생함수로 별도 반영.
  createdAt: string; // 생성 시각 (ISO 문자열)
  bankInfo?: BankInfo; // 입금 계좌(선택)
}
