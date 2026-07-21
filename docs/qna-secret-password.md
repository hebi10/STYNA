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
- `/api/qna/verify-secret`은 Cloud Functions에서 공개글 조회와 비밀글의 활성 작성자·엄격 관리자 권한 검증을 처리한다.
- `/api/qna/public`은 공개 목록을 Cloud Functions에서 조회하며 `isSecret == false`를 서버에서 강제한다.
- 비밀글 본문은 활성 작성자 또는 엄격 관리자에게만 반환하며, 비로그인 요청에는 401, 다른 로그인 사용자에게는 403을 반환한다.
- Firestore 규칙은 QnA 작성 시 작성자·대기 상태·초기 조회수만 허용하고, 일반 사용자가 답변·조회수·작성자를 변경하지 못하게 제한한다.
- 기존 `password`, `passwordHash`, `passwordSalt` 필드는 새 작성·수정 흐름에서 더 이상 생성하거나 검증하지 않으며, API 응답에서도 항상 제외한다.
- 브라우저의 QnA 직접 읽기는 활성 작성자 또는 엄격 관리자에게만 허용한다. 공개 목록·상세는 서버의 명시적 DTO를 사용해 email, uid, 알림 설정, 레거시 필드를 제외하고 작성자명과 답변자명을 마스킹한다.
- `isSecret`이 `false`가 아닌 레거시 문서는 공개로 추정하지 않고 활성 작성자·엄격 관리자 권한을 요구한다.

## Firestore 필드 계약

### QnA

- 생성 필수 필드: `userId`, `userEmail`, `userName`, `category`, `title`, `content`, `images`, `isSecret`, `status`, `views`, `isNotified`, `createdAt`, `updatedAt`. `title`은 1~100자, `content`는 1~2,000자이며 `images`는 최대 5개의 1~2,048자 문자열만 허용한다.
- 생성 선택 필드: 1~128자 문자열 `productId`, 1~200자 문자열 `productName`만 허용한다. 그 외 임의 필드는 거부한다.
- `userId`는 Auth uid, `userEmail`은 Auth token과 사용자 문서 email, `userName`은 사용자 문서 name과 각각 일치해야 한다. category는 `product`, `size`, `delivery`, `return`, `payment`, `general`, `other` 중 하나이며 초기값은 `status: waiting`, `views: 0`, `createdAt/updatedAt: request.time`이다.
- 활성 작성자 수정 허용 필드: `title`, `content`, `category`, `images`, `isSecret`, `isNotified`, `updatedAt`, 종료 목적의 `status: closed`. 수정 후 본문 필드의 타입·길이·이미지 상한과 `updatedAt == request.time`을 다시 검증한다.
- 엄격 관리자 수정 허용 필드: `answer`, `status`, `updatedAt`. status는 `waiting`, `answered`, `closed` 중 하나이고, answer는 `content`, `answeredBy`, `answeredAt`, `isAdmin`만 포함한다. 답변 내용은 1~2,000자, 답변자 표시는 1~200자이며 `answeredAt == request.time`, `isAdmin == true`여야 한다.
- 답변·조회수·작성자 식별자·생성 시각을 작성자가 바꾸거나 누구든 문서를 hard delete하는 동작은 허용하지 않는다.

### 일반 문의

- 생성은 `userId`, `userEmail`, `userName`, `category`, `title`, `content`, `status`, `createdAt`, `updatedAt`의 정확한 필드 집합만 허용한다. `title`은 1~100자, `content`는 1~2,000자여야 한다.
- 사용자 식별 정보는 QnA와 같은 Auth token·사용자 문서 일치 조건을 사용한다. category는 `order`, `delivery`, `exchange`, `product`, `account`, `other` 중 하나이며 `status: waiting`, `createdAt/updatedAt: request.time`이어야 한다.
- 작성자 수정은 허용하지 않는다. 엄격 관리자만 `answer`, `status`, `updatedAt`을 바꿀 수 있고, answer는 `content`, `answeredBy`, `answeredAt`의 정확한 필드 집합을 사용한다. 답변 내용은 1~2,000자, 답변자 표시는 1~200자이며 `answeredAt == request.time`을 요구한다.
- status는 `waiting`, `answered`, `closed`만 허용하며 hard delete는 모든 사용자에게 거부한다.

## 체크 포인트
- 2026-05-11 `npx tsc --noEmit --pretty false -p tsconfig.json` 통과.
- 2026-07-10 `npm test`: 비로그인 사용자가 비밀글 비밀번호만으로 본문에 접근할 수 없음을 포함해 검증.
- `functions:build`: 성공.

## 마무리 검토
- `src/app/qna/[id]/page.tsx`는 모든 상세 조회를 `QnAService.getQnAWithAccessCheck`로 처리하고, 비밀글은 권한 부족 안내를 표시한다.
- `src/app/qna/page.tsx`와 상품 상세 Q&A는 공개 전용 API만 사용하며 비공개·작성자 필터 입력을 받지 않는다.
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

## 2026-07-20 공개 조회·삭제 경계
- 공개 목록 필터는 category, status, productId 중 하나만 허용한다. 목록은 `createdAt desc` 최신 1페이지와 최대 50건만 조회하며 Firestore `offset`·집계 `count`를 사용하지 않는다. 호환 pagination은 현재 batch 길이와 page 1을 반환한다.
- 공개·비밀 상세 API는 조회수를 증가시키거나 문서를 수정하지 않는 완전한 읽기 전용 처리이며, 목록·상세 UI에서도 갱신되지 않는 조회수를 노출하지 않는다.
- 운영 반영 시 공개 caller와 서버 계약이 어긋나지 않도록 Functions, Firestore Rules, QnA 복합 인덱스를 같은 릴리스에서 배포한다.
- 존재하지 않는 `/qna/edit/[id]`로 이동하던 수정 버튼과 호출되지 않는 중복 QnA 서비스 메서드를 제거했다.
- QnA 문서의 직접 hard delete는 관리자도 허용하지 않으며, 종료는 `status: closed` 상태 변경으로 처리한다.
