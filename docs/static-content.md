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

추천 상품은 `FeaturedProductService`와 `/admin/featured-products`에서 관리한다. 홈 연결은 후속 성능·큐레이션 단계에서 진행한다.

## 초기 데이터 반영

```bash
npm run seed:content
```

위 명령은 기존 문서를 삭제하지 않고 같은 문서 ID에 `merge`로 upsert한다.

## 보안 규칙

- 공개 화면 콘텐츠(`faqs`, `notices`, `mainBanners`, `featuredProducts`, `offlineStores`, `offlineServices`, `offlineInfo`)는 공개 읽기를 허용한다.
- 모든 쓰기는 Firebase Custom Claims 관리자 권한 기준이다.
