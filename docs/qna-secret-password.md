# QnA 비밀글 접근 권한

## 작업 대상
- `src/shared/types/qna.ts`
- `src/shared/services/qnaService.ts`
- `src/shared/services/simpleQnAService.ts`
- `src/app/qna/page.tsx`
- `src/app/qna/[id]/page.tsx`
- `src/app/mypage/qa/page.tsx`
- `functions/src/handlers/qna.ts`
- `functions/src/index.ts`
- `firebase.json`
- `firestore.rules`

## 변경 내용
- 비밀글은 4자리 비밀번호가 아닌 Firebase 로그인 권한으로 보호한다.
- `/api/qna/verify-secret`은 Cloud Functions에서 공개글 조회와 비밀글의 작성자·관리자 권한 검증을 처리한다.
- 비밀글 본문은 작성자 또는 관리자에게만 반환하며, 비로그인 요청에는 401, 다른 로그인 사용자에게는 403을 반환한다.
- Firestore 규칙은 QnA 작성 시 작성자·대기 상태·초기 조회수만 허용하고, 일반 사용자가 답변·조회수·작성자를 변경하지 못하게 제한한다.
- 기존 `password`, `passwordHash`, `passwordSalt` 필드는 새 작성·수정 흐름에서 더 이상 생성하거나 검증하지 않으며, API 응답에서도 항상 제외한다.

## 체크 포인트
- 2026-05-11 `npx tsc --noEmit --pretty false -p tsconfig.json` 통과.
- 2026-07-10 `npm test`: 비로그인 사용자가 비밀글 비밀번호만으로 본문에 접근할 수 없음을 포함해 검증.
- `functions:build`: 성공.

## 마무리 검토
- `src/app/qna/[id]/page.tsx`는 모든 상세 조회를 `QnAService.getQnAWithAccessCheck`로 처리하고, 비밀글은 권한 부족 안내를 표시한다.
- `src/app/qna/page.tsx`는 비밀글 목록 노출을 막기 위해 `isSecret:false` 필터 기본 적용.
- `src/app/mypage/qa/page.tsx`는 사용자 문서 조회로 전환되어 비밀글 직접 조회 의존 제거.

## 2026-05-12 QnA UI 톤 정리
- QnA 목록/상세/작성 화면은 기존 접근 제어와 비밀글 권한 흐름을 유지하고 CSS만 보정했다.
- 파랑 CTA, 컬러 카테고리 배지, 둥근 안내 박스를 메인 상품 매대와 같은 검정 액션, 2px radius, 얇은 보더 중심으로 낮췄다.

## 2026-06-12 로컬 비밀글 권한 확인 프록시
- 로컬 Next dev에서도 `/api/qna/verify-secret`이 Cloud Function `qna`로 프록시되도록 App Router route를 추가했다.
- 권한 부족/미존재 응답은 HTML 404가 아니라 JSON 응답으로 유지된다.

## 2026-06-22 작성 로그 정리
- QnA 작성 화면과 `simpleQnAService`에서 작성 데이터와 사용자 식별자 흐름을 노출하던 진행 로그를 제거했다.
- 비밀글은 별도 비밀번호를 수집하지 않으며, 실패 시 사용자에게 일반 오류 메시지만 표시한다.
