# Firestore AI 요약 Export

## 목적
- Firestore 원본 데이터를 AI에 직접 공유하지 않고, 컬렉션 구조와 샘플 필드명만 익명화해 `firestore-ai-summary.json`으로 만든다.
- 인증은 `scripts/util-firestore-admin.js` 흐름을 사용한다.
- 로컬 서비스 계정 JSON을 쓰려면 파일을 자동 탐색하지 않고 `GOOGLE_APPLICATION_CREDENTIALS`에 경로를 명시해야 한다. 명시하지 않으면 Application Default Credentials를 사용한다.

## 명령
```bash
npm run firestore:ai-summary
```

옵션:
```bash
node scripts/firestore-ai-summary.js --output=tmp/firestore-ai-summary.json --sample-limit=5 --max-depth=2
```

## 출력 내용
- 루트 컬렉션 목록
- 컬렉션별 문서 수
- 샘플 문서 필드 구조
- 익명화된 샘플 문서
- 샘플 문서에서 발견한 하위 컬렉션 요약

`name`, `phone`, `email`, `address`, `uid`, `userId`, `token`, `password`처럼 개인정보 또는 인증정보로 추정되는 값은 `[REDACTED]`로 대체한다. 문서 ID가 포함된 경로도 `users/[DOC_ID]`처럼 ID 세그먼트를 익명화한다.

## 주의
- `count()`와 샘플 조회를 사용하므로 Firestore 읽기 비용이 발생한다.
- 하위 컬렉션은 전체 문서가 아니라 샘플 문서 기준으로 탐색한다. 누락 없는 전체 구조가 필요하면 `--sample-limit`을 올려 실행한다.
