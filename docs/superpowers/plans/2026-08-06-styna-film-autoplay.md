# STYNA FILM 무음 자동 재생 섹션 구현 계획

**Goal:** 홈에 네 개의 AI 상품 영상을 1회만 순차 자동 재생하는 브랜드 무드 섹션을 추가한다.

## 구현 단위

1. `public/videos/styna-film/`에 4개 원본 영상을 영문 파일명으로 배치한다.
2. `StynaFilm` 클라이언트 컴포넌트에서 IntersectionObserver 기반 진입·이탈 초기화와 종료 기반 순차 재생을 구현한다.
3. 큰 영상과 하단 4개 상품 링크 스트립을 CSS Modules로 반응형 구성한다.
4. 홈에서 `FeaturedProducts` 다음, 신상품 전에 조합한다.
5. 챕터 순서, 무음 고정, 네 번째 종료 뒤 정지, 재진입 초기화, 모션 감소 예외를 Jest로 검증한다.
