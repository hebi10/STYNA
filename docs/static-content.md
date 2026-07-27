# 정적 콘텐츠 Firestore 관리

## 범위

런타임 화면에서 정적 배열로 관리하던 콘텐츠를 Firestore 컬렉션으로 분리했다.

- `faqs`: FAQ 목록
- `notices`: 공지사항 목록
- `mainBanners`: 메인 상단 배너
- `offlineStores`: 오프라인 매장 목록
- `offlineServices`: 오프라인 매장 서비스
- `offlineInfo/main`: 오프라인 매장 운영시간/안내사항
- `featuredProducts`: 홈 추천 상품 구성(공개 읽기, 관리자 쓰기)

오프라인 매장 콘텐츠는 예시 데이터이며 상세·길찾기 기능은 제공하지 않는다.

추천 상품은 `FeaturedProductService`와 `/admin/featured-products`에서 관리한다. 홈은 추천 설정을 한 번 읽고 공개 상품을 병렬 조회한 뒤 관리자 설정 순서대로 표시한다. 설정이 없거나 유효한 공개 상품이 없으면 섹션을 숨긴다.

추천 설정 조회가 실패한 경우에만 홈 공개 추천 결과의 앞 4개를 대체 매대로 표시한다. 추천 설정이 비활성 상태이거나 설정 조회는 성공했지만 상품이 없는 경우에는 공개 추천 결과가 있어도 섹션을 숨긴다. 설정 조회와 공개 추천 조회가 모두 실패하거나 대체 상품이 없으면 하나의 재시도 가능한 오류 상태를 표시한다.

메인 배너 링크는 사이트 내부의 `/` 경로만 허용한다. 외부 URL, protocol-relative URL, 역슬래시·제어 문자가 포함된 경로는 `/products`로 대체한다.

홈의 반복적인 에디토리얼 eyebrow와 정적 서비스 안내는 제거했다. 포트폴리오 성격의 안내는 `PortfolioDemoSection` 한 영역에서만 제공한다.

## 초기 데이터 반영

```bash
npm run seed:content
```

위 명령은 기존 문서를 삭제하지 않고 같은 문서 ID에 `merge`로 upsert한다.

## 보안 규칙

- 공개 화면 콘텐츠(`faqs`, `notices`, `mainBanners`, `featuredProducts`, `offlineStores`, `offlineServices`, `offlineInfo`)는 공개 읽기를 허용한다.
- 모든 쓰기는 Firebase Custom Claims 관리자 권한 기준이다.
