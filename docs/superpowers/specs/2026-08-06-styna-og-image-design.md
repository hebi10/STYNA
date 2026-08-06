# STYNA OG 이미지 제작 기획

## 목적

- 홈과 공개 목록 페이지를 공유할 때 노출되는 `public/thum.png`를 STYNA 브랜드에 맞게 교체한다.
- 작은 공유 카드에서도 브랜드와 대표 상품군이 즉시 인지되도록 한다.

## 확정 콘셉트

브랜드 로고 중심의 미니멀 커머스 에디토리얼 정물 이미지.

- 중심 요소: 이미지 중앙의 대형 `STYNA` 워드마크
- 상품: 오프화이트 반팔 셔츠, 밝은 톤의 로우프로파일 스니커즈, 구조감 있는 토트백
- 배경: 차콜 블랙과 웜그레이 스포트라이트의 매트한 스튜디오
- 조명: 절제된 자연광과 깊은 그림자
- 브랜드 표기: 생성 단계에서 정확히 `STYNA`만 포함한다. 추가 문구, 가격, 할인, 버튼, CTA는 넣지 않는다.

## 구도와 안전 영역

- 결과물은 1200 × 630px PNG로 제작한다.
- `STYNA`를 프레임의 가로·세로 중앙에 크게 둔다.
- 셔츠는 좌측, 스니커즈는 우하단, 토트백은 우측에 두어 로고를 감싼다.
- 상품은 로고를 가리거나 문자와 겹치지 않는다.
- 가장자리 60px 안쪽에는 필수 상품이나 문구를 두지 않아 플랫폼별 크롭에 대응한다.

## 시각 원칙

- 메인 화면의 차분한 에디토리얼 톤을 유지한다.
- 차콜 블랙, 웜그레이, 아이보리, 오프화이트를 중심으로 하고 강한 원색은 사용하지 않는다.
- 실제 착용 인물, 손, 과도한 소품, 복잡한 배경, 읽기 어려운 작은 문구는 제외한다.
- 로고 철자는 반드시 `STYNA`로 사용하며 이전 브랜드명 `HEBIMALL`과 다른 모든 텍스트는 포함하지 않는다.

## 이미지 생성 프롬프트

```text
Premium Korean fashion e-commerce editorial for a brand social sharing image. Charcoal-black premium studio with a warm gray spotlight. An off-white short-sleeve shirt at left, clean low-profile sneakers at lower right, and a structured charcoal utility tote bag at right frame the composition. Put the exact word STYNA in very large crisp white bold geometric sans-serif uppercase letters at the exact center. The products must not cover the letters. No people, hands, discount labels, prices, buttons, clutter, watermarks, or other text.
```

## 적용 기준

- 생성 원본 안의 `STYNA` 철자를 검수한 뒤 별도 텍스트 합성 없이 사용한다.
- 적용 시 `public/thum.png`를 교체하고, 기존 메타데이터가 참조하는 1200 × 630 PNG 규격을 유지한다.
