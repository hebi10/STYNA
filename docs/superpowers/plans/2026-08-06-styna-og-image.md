# STYNA OG Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** STYNA 브랜드와 대표 상품 3종을 보여 주는 OG 공유 이미지를 생성하고 기존 경로에 적용한다.

**Architecture:** `public/thum.png`은 루트와 공개 페이지 메타데이터가 공통으로 참조하는 정적 OG 자산이다. 생성 이미지를 해당 파일로 교체하되, 앱 코드와 메타데이터 인터페이스는 유지한다.

**Tech Stack:** OpenAI Image Generation, PNG, Sharp, Next.js Metadata

## Global Constraints

- 결과 파일은 정확히 1200 × 630px PNG여야 한다.
- 생성 이미지에는 중앙의 대형 `STYNA`만 표기하고 `HEBIMALL`, 할인 문구, CTA, 워터마크를 포함하지 않는다.
- 실제 판매 상품군인 오프화이트 셔츠·로우프로파일 스니커즈·토트백을 사용한다.
- 프로젝트의 기존 `public/thum.png` 경로와 `routeMetadata` 참조는 변경하지 않는다.

---

### Task 1: OG 이미지 생성 및 정적 자산 적용

**Files:**
- Modify: `public/thum.png`
- Modify: `docs/README.md`
- Create: `docs/superpowers/specs/2026-08-06-styna-og-image-design.md`
- Create: `docs/superpowers/plans/2026-08-06-styna-og-image.md`

**Interfaces:**
- Consumes: `src/shared/constants/routeMetadata.ts`의 `/thum.png` OG 이미지 경로
- Produces: 모든 공개 페이지 메타데이터에서 사용할 1200 × 630 PNG 자산

- [x] **Step 1: 기존 연결과 규격 확인**

  `src/shared/constants/routeMetadata.ts`에서 root와 공개 페이지가 `/thum.png`를 참조하는지 확인하고, 현재 파일의 크기를 기록한다.

- [x] **Step 2: 이미지 생성**

  아래 프롬프트로 중앙 로고 중심의 정물형 이미지를 생성한다.

  ```text
  Use case: ads-marketing
  Asset type: STYNA fashion commerce Open Graph social-sharing image
  Primary request: premium Korean fashion e-commerce editorial with an off-white short-sleeve shirt at left, clean low-profile sneakers at lower right, and a structured utility tote bag at right
  Scene/backdrop: minimal charcoal-black studio with a warm gray spotlight
  Style/medium: high-end photorealistic commercial product photography
  Composition/framing: wide landscape, very large centered STYNA wordmark; products frame the letters without covering them and remain readable at thumbnail size
  Lighting/mood: restrained studio spotlight, deep natural shadows, calm contemporary fashion editorial
  Color palette: charcoal black, warm gray, off-white, muted stone
  Text (verbatim): "STYNA"
  Constraints: spell the brand exactly as S-T-Y-N-A; no people or hands
  Avoid: every other word, letters, numbers, discount labels, prices, CTA buttons, busy props, watermarks
  ```

- [x] **Step 3: 생성 결과 검사 및 규격 변환**

  결과물에서 중앙 `STYNA` 철자, 세 상품의 배치, 불필요한 텍스트·워터마크 유무를 확인한다. 자산을 1200 × 630px PNG로 준비해 별도 텍스트 합성 없이 `public/thum.png`에 교체한다.

- [x] **Step 4: 메타데이터 호환성 검증**

  다음 명령으로 PNG 형식과 크기를 확인한다.

  ```powershell
  @'
  const sharp = require('sharp');
  sharp('public/thum.png').metadata().then((metadata) => {
    console.log(JSON.stringify({ format: metadata.format, width: metadata.width, height: metadata.height }));
  });
  '@ | node -
  ```

  기대값: `{"format":"png","width":1200,"height":630}`.

- [x] **Step 5: 변경사항 점검**

  `git diff --check`를 실행해 공백 오류가 없는지 확인하고, 생성 이미지와 문서 변경만 포함되는지 검토한다.
