# QnA 비밀글 보안 변경

## 작업 대상
- `src/shared/types/qna.ts`
- `src/shared/utils/qnaSecret.ts`
- `src/shared/services/qnaService.ts`
- `src/app/qna/page.tsx`
- `src/app/qna/[id]/page.tsx`
- `src/app/mypage/qa/page.tsx`
- `functions/src/handlers/qna.ts`
- `functions/src/index.ts`
- `firebase.json`
- `firestore.rules`

## 변경 내용
- `QnA` 타입에서 `password` 평문 필드를 제거하고 `passwordHash`, `passwordSalt`로 변경.
- 클라이언트에서 비밀번호 비교 함수 제거 후 생성/수정 시 해시 저장으로 변경.
- `/api/qna/verify-secret`은 Cloud Functions로 이동해 비밀글 접근 검증과 조회를 처리.
- 비밀번호가 일치하는 요청만 비밀글 본문을 반환, `password*` 원문/해시 필드 모두 응답에서 제외.
- 비밀글 규칙을 `비공개/공개`로 분리하여 Firestore 기본 read는 공개글(`isSecret != true`)만 허용, 작성자/관리자만 비밀글 조회 가능.
- 기존 평문 데이터는 첫 검증 성공 시 `passwordHash/passwordSalt`로 1회 마이그레이션되고 `password` 필드는 삭제.

## 체크 포인트
- 2026-05-11 `npx tsc --noEmit --pretty false -p tsconfig.json` 통과.
- 2026-05-11 `npm test`: 통과. QnA 도메인 테스트에서 salted hash 검증, legacy 평문 마이그레이션 호환, 안전 응답의 password material 제거를 검증.
- `functions:build`: 성공.

## 마무리 검토
- `src/app/qna/[id]/page.tsx`는 비밀글인 경우 `QnAService.getQnAWithAccessCheck`로만 본문 조회.
- `src/app/qna/page.tsx`는 비밀글 목록 노출을 막기 위해 `isSecret:false` 필터 기본 적용.
- `src/app/mypage/qa/page.tsx`는 사용자 문서 조회로 전환되어 비밀글 직접 조회 의존 제거.

## 2026-05-12 QnA UI 톤 정리
- QnA 목록/상세/작성 화면은 기존 접근 제어와 비밀글 검증 흐름을 유지하고 CSS만 보정했다.
- 파랑 CTA, 컬러 카테고리 배지, 둥근 안내 박스를 메인 상품 매대와 같은 검정 액션, 2px radius, 얇은 보더 중심으로 낮췄다.
- 비밀글 비밀번호 모달과 작성 폼도 같은 입력 focus/버튼 톤을 사용한다.

## 2026-06-12 로컬 비밀글 검증 프록시
- 로컬 Next dev에서도 `/api/qna/verify-secret`이 Cloud Function `qna`로 프록시되도록 App Router route를 추가했다.
- 비밀글 검증 실패/미존재 응답은 HTML 404가 아니라 JSON 응답으로 유지된다.

## 2026-06-22 작성 로그 정리
- QnA 작성 화면과 `simpleQnAService`에서 작성 데이터, 사용자 식별자, 비밀글 입력값 흐름을 노출하던 진행 로그를 제거했다.
- 비밀글 작성/해시 저장 흐름은 유지하며, 실패 시 사용자에게 일반 오류 메시지만 표시한다.
