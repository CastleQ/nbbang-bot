// app/lib/settlement.ts
// 쓰스로(Sssro) 정산 "계산 두뇌" — 순수 함수 모음.
// - 화면(SettlementDetail.tsx)에서 분리해 재사용·테스트가 가능하도록 함. [M1]
// - React 등 화면 의존성 없음. 입력을 넣으면 결과만 반환하는 순수 함수.

import type { Item, Participant } from "./types";

/** 참여자 1명의 정산 상세 한 줄 */
export interface SettlementDetailLine {
  category: string; // 항목 이름
  info: string; // 부가 설명 (참여 / 시간 / 직접 추가 등)
  cost: number; // 이 줄에서 부담할 금액(원)
  isHourly: boolean; // 시간당 정산 여부
  isCustom?: boolean; // 참여자가 직접 추가한 항목 여부
}

/** 참여자 1명의 정산 결과 */
export interface ParticipantResult {
  total: number; // 총 부담액(원)
  details: SettlementDetailLine[];
}

/** 참여자 id → 결과 (key = Participant.id) */
export type SettlementResults = Record<string, ParticipantResult>;

/**
 * [F3 해결 + 하위호환 A안]
 * "1,000"(문자열)·1000(숫자)·빈값 무엇이 들어와도 안전하게 숫자(원)로 변환.
 * 옛 데이터(문자열 금액)와 새 데이터(숫자 금액)를 동시에 안전 처리.
 */
export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = parseInt(value.replace(/,/g, ""), 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * 시작~끝 시각을 분(minute)으로 계산. "HH:MM" 형식.
 * 끝이 시작보다 이르면 자정을 넘긴 것으로 보고 +1440분(24시간) 보정.
 */
export function getDurationMinutes(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  let diff = endTotal - startTotal;
  if (diff < 0) diff += 1440;
  return diff;
}

/** 분(minute)을 "N시간 M분" 형태의 한국어 문자열로 변환. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0시간";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  let text = "";
  if (h > 0) text += `${h}시간 `;
  if (m > 0) text += `${m}분`;
  return text.trim();
}

/** 개인 부담액을 10원 단위로 올림. (기존 설계 유지) */
function roundUpTo10(amount: number): number {
  return Math.ceil(amount / 10) * 10;
}

/**
 * 핵심 정산 계산.
 * - 일반(general): 참여자 수로 1/N 분배(개인별 10원 올림).
 * - 시간당(hourly): 참여 시간 비례 분배(개인별 10원 올림).
 * - [F1 해결] 각 참여자가 직접 추가한 항목(customItems)을 그 사람 몫에 100% 합산.
 */
export function calculateSettlement(
  items: Item[],
  participants: Participant[]
): SettlementResults {
  const results: SettlementResults = {};

  // 1) 참여자별 결과 그릇 초기화
  participants.forEach((p) => {
    results[p.id] = { total: 0, details: [] };
  });

  // 2) 정산자 공통 항목 분배
  items.forEach((item) => {
    const itemPrice = toNumber(item.price);
    const joined = participants.filter(
      (p) => p.selections?.[item.id]?.joined
    );
    if (joined.length === 0) return;

    if (item.method === "hourly") {
      const totalMinutes = joined.reduce((sum, p) => {
        const sel = p.selections[item.id];
        return sum + getDurationMinutes(sel.startTime, sel.endTime);
      }, 0);
      if (totalMinutes <= 0) return;

      const pricePerMinute = itemPrice / totalMinutes;
      joined.forEach((p) => {
        const sel = p.selections[item.id];
        const myMinutes = getDurationMinutes(sel.startTime, sel.endTime);
        const myCost = roundUpTo10(myMinutes * pricePerMinute);
        results[p.id].total += myCost;
        results[p.id].details.push({
          category: item.category,
          info: `${sel.startTime}~${sel.endTime} (${formatDuration(myMinutes)})`,
          cost: myCost,
          isHourly: true,
        });
      });
    } else {
      const splitPrice = roundUpTo10(itemPrice / joined.length);
      joined.forEach((p) => {
        results[p.id].total += splitPrice;
        results[p.id].details.push({
          category: item.category,
          info: "참여",
          cost: splitPrice,
          isHourly: false,
        });
      });
    }
  });

  // 3) [F1] 참여자 직접 추가 항목(customItems)을 본인 몫에 합산
  participants.forEach((p) => {
    const customItems = p.customItems ?? [];
    customItems.forEach((c) => {
      const cost = toNumber(c.price);
      results[p.id].total += cost;
      results[p.id].details.push({
        category: c.category,
        info: "직접 추가",
        cost,
        isHourly: false,
        isCustom: true,
      });
    });
  });

  return results;
}

/**
 * [F2 방어 + 총액 A안]
 * 저장된 값에 의존하지 않고 항상 계산으로 총액을 도출.
 * 전체 총액 = 정산자 공통항목 합계 + 모든 참여자의 직접 추가항목 합계.
 */
export function getTotalAmount(
  items: Item[],
  participants: Participant[]
): number {
  const itemsTotal = items.reduce((sum, it) => sum + toNumber(it.price), 0);
  const customTotal = participants.reduce(
    (sum, p) =>
      sum + (p.customItems ?? []).reduce((s, c) => s + toNumber(c.price), 0),
    0
  );
  return itemsTotal + customTotal;
}
