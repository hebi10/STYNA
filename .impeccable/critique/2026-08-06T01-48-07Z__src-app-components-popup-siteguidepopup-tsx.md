---
target: 우측 하단 쇼핑 안내·도움말 챗봇 팝업
total_score: 27
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 2
timestamp: 2026-08-06T01-48-07Z
slug: src-app-components-popup-siteguidepopup-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | 챗봇의 답변 작성 상태는 보이지만 실패 뒤 재시도 경로가 약합니다. |
| 2 | Match System / Real World | 3 | 배송·혜택 용어는 자연스럽지만 `직접 질문하기`는 실제 지원으로 오해될 수 있습니다. |
| 3 | User Control and Freedom | 3 | 안내 팝업은 배경 클릭·Esc·닫기·포커스 복귀를 지원합니다. |
| 4 | Consistency and Standards | 3 | 흑백·44px 제어는 일관되지만 문의 경로의 명칭이 분산됩니다. |
| 5 | Error Prevention | 2 | 챗봇 입력이 먼저 비활성이고 실제 상담 불가 고지가 행동 뒤에 강화됩니다. |
| 6 | Recognition Rather Than Recall | 3 | 빠른 선택지와 배송조회·문의 CTA가 보입니다. |
| 7 | Flexibility and Efficiency | 2 | 원하는 도움 또는 입력으로 바로 가는 경로가 제한적입니다. |
| 8 | Aesthetic and Minimalist Design | 3 | 단정하지만 안내 고지와 빠른 선택지의 위계가 충분히 분리되지 않았습니다. |
| 9 | Error Recovery | 2 | 일반 오류 문구는 있으나 인라인 재시도·대체 행동 연결이 약합니다. |
| 10 | Help and Documentation | 3 | 맥락 안 도움말은 제공하지만 두 고정 진입점이 경쟁합니다. |
| **Total** | | **27/40** | **Acceptable — significant improvements needed** |

#### Design Specificity Verdict

STYNA의 흑백·저채도 쇼핑 경험과 데모 고지는 반영됐지만, 두 팝업의 검은 헤더·흰 본문·사각 버튼 조합은 다른 커머스에도 그대로 적용 가능한 범용 패턴입니다. 특히 `쇼핑 안내`와 `도움말 챗봇`이 모두 도움·문의 성격이라 첫 선택이 불분명합니다.

자동 진단은 `SiteGuidePopup.tsx/.module.css`, `ChatWidget.tsx/.module.css`에서 0건이었습니다. 데스크톱 1280×720과 모바일 375px 콘텐츠 폭에서 두 팝업의 가로 넘침과 콘솔 오류는 없었고, 포커스 이동·Esc/닫기 후 트리거 복귀도 확인됐습니다.

#### Overall Impression

구현 완성도와 접근성 기초는 탄탄합니다. 가장 큰 기회는 두 고정 버튼을 서로 경쟁하는 일반 도움말이 아니라 목적이 분명한 지원 경로로 재정의하는 것입니다.

#### What's Working

- 흑백 대비, 얇은 테두리, 44px 이상 제어 크기로 스토어의 디자인 언어가 일관됩니다.
- 쇼핑 안내는 포커스 트랩·Esc 종료·이전 포커스 복귀와 모바일 하단 배치가 안정적입니다.
- 챗봇은 배송·반품·상품·혜택을 빠른 선택으로 제공하고 데모 한계를 초기에 고지합니다.

#### Priority Issues

- **[P1] 두 플로팅 진입점의 역할 경쟁**: 사용자가 `쇼핑 안내`와 `도움말 챗봇` 중 무엇을 열지 판단해야 합니다. 하나의 도움말 런처로 통합하거나 `배송·쇼핑 안내`와 `빠른 FAQ`처럼 목적이 분리된 이름을 쓰세요. Suggested command: `$impeccable shape`.
- **[P1] `직접 질문하기`와 실제 지원 기대의 불일치**: 바로 입력할 수 없고 데모 응답이라는 사실이 이후에 다시 나옵니다. `데모 질문 입력하기`로 명확히 이름 붙이고, `1:1 문의로 이동`은 별도 CTA로 분리하세요. Suggested command: `$impeccable clarify`.
- **[P2] 쇼핑 안내의 고지 밀도와 동등한 정보 위계**: 배송·혜택·데모 정책·운영 정책이 모두 같은 리스트 무게입니다. 배송·혜택을 핵심 영역으로 두고 데모 이용 조건은 별도 고지 블록으로 압축하세요. Suggested command: `$impeccable layout`.
- **[P2] 모바일 챗봇의 큰 빈 면적**: 375px 화면에서 창이 351×640으로 상품 탐색의 맥락을 크게 가립니다. 첫 진입은 콘텐츠 기반 높이로 줄이고 대화가 쌓일 때 확장하거나 하단 시트로 정리하세요. Suggested command: `$impeccable adapt`.
- **[P3] 중복된 종료 제어와 그림자**: 안내에는 X·배경 클릭·Esc·하단 닫기가 함께 있고 두 팝업의 그림자는 제품의 신규 UI 무그림자 기준과 맞지 않습니다. 하단 닫기를 제거하거나 낮추고 오버레이와 테두리만으로 분리하세요. Suggested command: `$impeccable distill`.

#### Persona Red Flags

- **Casey (모바일 사용자)**: 버튼은 엄지 영역에 있지만 두 진입점이 연속 배치되어 선택 부담이 생깁니다. 챗봇을 열면 넓은 빈 대화 영역 때문에 상품 맥락을 잃기 쉽습니다.
- **Riley (엣지 케이스 사용자)**: 데모 질문, 1:1 문의 기록, 답변 보장 여부가 여러 위치에 흩어져 있어 지원 범위를 검증하려면 흐름을 왕복해야 합니다.
- **Jordan (첫 방문 사용자)**: `상품 문의`, `1:1 문의`, `직접 질문하기`의 차이를 5초 안에 구분하기 어렵고 비활성 입력창이 첫 행동을 멈춥니다.

#### Minor Observations

- 챗봇의 `↻`는 접근성 이름은 있지만 시각적으로는 새로 시작의 의미를 한 번 해석해야 합니다.
- `직접 질문하기`만 검정색이라 우선순위는 분명하지만 실제 상담 연결로 오해될 위험도 커집니다.
