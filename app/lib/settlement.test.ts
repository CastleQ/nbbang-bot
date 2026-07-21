// app/lib/settlement.test.ts
// 정산 계산 엔진(settlement.ts) 자동 시험지.
// 실행: npm run test
// 이 시험지가 통과하는 한, 아래 규칙들이 깨지지 않았음이 보장됨. (특히 F1 회귀 방지)

import { describe, it, expect } from "vitest";
import {
  toNumber,
  getDurationMinutes,
  calculateSettlement,
  getTotalAmount,
} from "./settlement";
import type { Item, Participant } from "./types";

describe("toNumber (F3 + 하위호환)", () => {
  it("콤마 문자열을 숫자로", () => {
    expect(toNumber("30,000")).toBe(30000);
  });
  it("숫자는 그대로", () => {
    expect(toNumber(1000)).toBe(1000);
  });
  it("빈값/undefined는 0", () => {
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("")).toBe(0);
  });
});

describe("getDurationMinutes", () => {
  it("일반 구간", () => {
    expect(getDurationMinutes("18:00", "20:30")).toBe(150);
  });
  it("자정 넘김(+1440 보정)", () => {
    expect(getDurationMinutes("23:00", "01:00")).toBe(120);
  });
  it("시간 정보 없으면 0", () => {
    expect(getDurationMinutes(undefined, "01:00")).toBe(0);
  });
});

describe("calculateSettlement", () => {
  it("일반(1/N) 3인 분배 + 옛 문자열 금액 호환", () => {
    const items: Item[] = [
      { id: "a", category: "치킨", price: "30,000" as unknown as number, method: "general" },
    ];
    const parts: Participant[] = ["p1", "p2", "p3"].map((id) => ({
      id,
      name: id,
      selections: { a: { joined: true } },
      customItems: [],
      submittedAt: "",
    }));
    const r = calculateSettlement(items, parts);
    expect(r.p1.total).toBe(10000);
    expect(r.p2.total).toBe(10000);
    expect(r.p3.total).toBe(10000);
  });

  it("시간당 비례 분배(개인별 10원 올림)", () => {
    const items: Item[] = [
      { id: "h", category: "파티룸", price: 10000, method: "hourly" },
    ];
    const parts: Participant[] = [
      { id: "x", name: "X", selections: { h: { joined: true, startTime: "00:00", endTime: "01:00" } }, customItems: [], submittedAt: "" },
      { id: "y", name: "Y", selections: { h: { joined: true, startTime: "00:00", endTime: "03:00" } }, customItems: [], submittedAt: "" },
    ];
    const r = calculateSettlement(items, parts);
    expect(r.x.total).toBe(2500);
    expect(r.y.total).toBe(7500);
  });

  it("[F1] 참여자 직접 추가 항목(customItems)이 본인 몫에 합산된다", () => {
    const items: Item[] = [
      { id: "a", category: "치킨", price: 20000, method: "general" },
    ];
    const parts: Participant[] = [
      { id: "p1", name: "A", selections: { a: { joined: true } }, customItems: [{ id: "c1", category: "내 콜라", price: 3000 }], submittedAt: "" },
      { id: "p2", name: "B", selections: { a: { joined: true } }, customItems: [], submittedAt: "" },
    ];
    const r = calculateSettlement(items, parts);
    expect(r.p1.total).toBe(13000); // 1/N 10000 + 개별 3000
    expect(r.p2.total).toBe(10000);
    // 개별 항목이 상세에 '직접 추가'로 남는지
    expect(r.p1.details.some((d) => d.isCustom && d.cost === 3000)).toBe(true);
  });

  it("아무도 참여 안 한 항목은 무시된다", () => {
    const items: Item[] = [
      { id: "a", category: "치킨", price: 10000, method: "general" },
    ];
    const parts: Participant[] = [
      { id: "p1", name: "A", selections: {}, customItems: [], submittedAt: "" },
    ];
    const r = calculateSettlement(items, parts);
    expect(r.p1.total).toBe(0);
  });
});

describe("getTotalAmount (A안: 공통 + 개별 전체)", () => {
  it("공통항목 + 참여자 개별항목 합산", () => {
    const items: Item[] = [
      { id: "a", category: "치킨", price: 20000, method: "general" },
    ];
    const parts: Participant[] = [
      { id: "p1", name: "A", selections: { a: { joined: true } }, customItems: [{ id: "c1", category: "콜라", price: 3000 }], submittedAt: "" },
      { id: "p2", name: "B", selections: { a: { joined: true } }, customItems: [], submittedAt: "" },
    ];
    expect(getTotalAmount(items, parts)).toBe(23000);
  });
});
