# 쓰스로(Sssro) / nbbang-bot

Next.js(App Router) + Firestore 정산 앱. 실서비스 운영 중: https://nbbang-bot.vercel.app/

## 배포
- `main` 푸시 = Vercel 실서버 즉시 배포. 화면이 바뀌는 수정은 작업 브랜치 → Vercel Preview 확인 → `main` 병합.
- 리팩터링 진행 계획·체크리스트는 `sssro_plan.md` (Phase 단위, 완료 시 `[x]`).

## 검증
- `npm ci && npx tsc --noEmit -p .` - 타입 검사(테스트 러너 없음). `next lint`는 `--quiet` 미지원.

## 데이터 주의 (Firestore `settlements`)
- 옛 문서와 현재 저장값이 `app/lib/types.ts` 표준 모양과 다름: 금액 `"1,000"` 문자열, id `Date.now()` 숫자, `participantCount` `"5"`/`""` 문자열, 계좌 미입력 시 `bankInfo: null`. 읽을 때 정규화 전제(계획서 0-2 A안: 하위호환 유지, 데이터 삭제 금지).
- 시간당(hourly) 항목 시간은 `"HH:MM"`만 저장, 날짜 없음. 종료 < 시작이면 익일로 해석(+1440분). 시간 선택지는 세 화면 모두 30분 단위.
- 시간 선택 UI는 `ParticipantInput.tsx`(참여자)와 `SettlementDetail.tsx`(정산자의 참여자 수정) 두 곳에 중복 — 하나 고치면 다른 쪽도 확인.
