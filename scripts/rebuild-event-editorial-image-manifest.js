const fs = require('fs');
const sourceManifest = require('./event-image-refresh-manifest.json');

const VERSION = '20260715';
const OUTPUT = 'scripts/event-editorial-image-manifest.json';
const TARGET = Object.freeze({ width: 1000, height: 1500 });

const ROLE_CONFIG = Object.freeze({
  benefit: Object.freeze({
    assetType: '이벤트 상세 도입 세로 콘텐츠',
    flows: Object.freeze([
      '상단 캠페인 오프닝',
      '중단 핵심 혜택',
      '하단 기간/참여 안내',
    ]),
  }),
  styling: Object.freeze({
    assetType: '이벤트 상세 스타일 제안 세로 콘텐츠',
    flows: Object.freeze([
      '상단 전신 룩',
      '중단 스타일 조합',
      '하단 소재 디테일',
    ]),
  }),
  product: Object.freeze({
    assetType: '이벤트 상세 상품 연결 세로 콘텐츠',
    flows: Object.freeze([
      '상단 제품 정물',
      '중단 소재 클로즈업',
      '하단 추천 상품 연결',
    ]),
  }),
});

const STORIES = Object.freeze({
  'event-2026-01-layering-sale': {
    mood:
      '차콜 콘크리트 도심, 아이스 블루 니트, 카멜 머플러, 흐린 겨울 자연광',
    benefit: {
      purpose: '겨울 레이어링 행사를 도입하고 할인 폭과 착장 이유를 설명한다.',
      texts: ['윈터 레이어링 세일', '최대 45% 혜택', '겹쳐 입는 겨울', '아우터부터 니트까지'],
      scenes: [
        '콘크리트 육교 아래 남녀 2인이 서로 다른 겨울 레이어링으로 걷는 캠페인 오프닝',
        '울 코트, 패딩 베스트, 터틀넥 니트가 함께 놓인 할인 혜택 장면',
        '무지 쿠폰 카드와 접힌 머플러를 둔 차분한 참여 안내 장면',
      ],
    },
    styling: {
      purpose: '도심 겨울 스타일을 실제 착장 조합으로 제안한다.',
      texts: ['윈터 레이어링 세일', 'MD 추천 겨울 레이어링', '코트 안에 패딩 베스트', '머플러로 완성'],
      scenes: [
        '혼성 모델 2인의 울 코트, 패딩 베스트, 머플러 전신 워킹 룩',
        '코트 안쪽 패딩, 니트, 와이드 팬츠 조합을 보여 주는 착장 클로즈업',
        '울 조직, 퀼팅, 니트 립, 머플러 프린지를 연결한 소재 디테일',
      ],
    },
    product: {
      purpose: '상품 매대로 넘어가기 전 핵심 겨울 제품군을 정리한다.',
      texts: ['윈터 레이어링 세일', '겨울 아우터 셀렉션', '울 코트', '퀼팅 패딩'],
      scenes: [
        '울 코트 소매, 퀼팅 패딩, 회색 니트, 카멜 머플러의 프리미엄 정물',
        '울 짜임, 패딩 봉제선, 니트 목 조직의 촉감 있는 매크로 컷',
        '겨울 아우터와 니트를 무지 태그와 함께 정돈한 상품 연결 장면',
      ],
    },
  },
  'event-2026-01-welcome-coupon': {
    mood: '딥 네이비 박스, 아이보리 니트, 절제된 골드, 새해 첫 주문의 아침빛',
    benefit: {
      purpose: '첫 구매 쿠폰과 새해 첫 주문 분위기를 제품 정물로 소개한다.',
      texts: ['새해 웰컴 쿠폰', '첫 구매 20% 쿠폰', '첫 주문을 여는 순간', '신규 고객 혜택'],
      scenes: [
        '무지 새해 달력, 열린 첫 주문 박스, 아이보리 니트, 골드 쿠폰 티켓 정물',
        '쿠폰 티켓과 패키지 속 니트를 가까이 보여 주는 혜택 장면',
        '무지 카드, 포장지, 지갑을 둔 첫 쇼핑 참여 안내 장면',
      ],
    },
    styling: {
      purpose: '쿠폰을 받은 뒤 바로 구매하기 좋은 첫 쇼핑 룩을 제안한다.',
      texts: ['새해 웰컴 쿠폰', '첫 쇼핑 MD 추천', '아이보리 니트', '네이비 팬츠'],
      scenes: [
        '남성 모델이 아이보리 니트와 네이비 팬츠를 입고 첫 주문 박스를 드는 전신 장면',
        '니트, 지갑, 벨트, 슈즈를 한 벌 코디처럼 배열한 스타일 조합',
        '니트 립, 무지 지갑 가죽, 골드 버클을 보여 주는 소재 디테일',
      ],
    },
    product: {
      purpose: '첫 구매에 어울리는 기본 상품을 묶어 상품 매대로 연결한다.',
      texts: ['새해 웰컴 쿠폰', '첫 구매 에센셜', '니트와 지갑', '기본템 패키지'],
      scenes: [
        '아이보리 니트, 네이비 지갑, 골드 버클 벨트, 무지 쿠폰 티켓 플랫레이',
        '니트 조직, 지갑 가죽, 버클 금속 질감 클로즈업',
        '첫 구매 기본템을 포장 박스에 정리한 상품 연결 장면',
      ],
    },
  },
  'event-2026-02-knit-review': {
    mood: '버건디 니트, 오트밀 니트, 오래된 카페, 따뜻한 나무와 실내 자연광',
    benefit: {
      purpose: '착용 리뷰를 남기고 리워드를 받는 이벤트를 따뜻하게 소개한다.',
      texts: ['니트 리뷰 리워드', '리뷰 작성 시 2천원', '입어본 느낌 그대로', '착용 후기를 남겨요'],
      scenes: [
        '여성 모델이 버건디 케이블 니트를 입고 조용한 카페 창가에 앉은 착용 장면',
        '니트 표면과 커피잔 옆에 리뷰 리워드 문구를 배치한 혜택 장면',
        '접힌 니트와 완전히 무지인 리뷰 카드가 놓인 참여 안내 장면',
      ],
    },
    styling: {
      purpose: '리뷰가 잘 나오는 니트 코디와 착용 디테일을 보여 준다.',
      texts: ['니트 리뷰 리워드', 'MD 추천 니트 룩', '케이블 니트', '새틴 스커트'],
      scenes: [
        '여성 모델의 버건디 케이블 니트와 새틴 스커트 전신 카페 룩',
        '니트 소매, 스커트 드레이프, 심플 백을 함께 보여 주는 스타일 조합',
        '케이블 짜임, 립 조직, 부드러운 베이지 니트 소재 디테일',
      ],
    },
    product: {
      purpose: '리뷰 대상 니트의 소재 차이를 보여 주고 상품 목록으로 넘긴다.',
      texts: ['니트 리뷰 리워드', '직접 입어본 니트', '케이블 짜임', '부드러운 촉감'],
      scenes: [
        '오트밀 립 니트, 버건디 케이블 니트, 베이지 소프트 니트를 쌓은 정물',
        '케이블 조직, 소매 립, 기모감 있는 섬유 매크로 패널',
        '접힌 니트와 무지 리뷰 카드를 둔 상품 연결 장면',
      ],
    },
  },
  'event-2026-02-spring-preview': {
    mood: '유리 온실, 세이지 그린, 페일 옐로, 스카이 블루, 밝은 봄 자연광',
    benefit: {
      purpose: '봄 신상품을 먼저 공개하는 프리뷰 행사임을 밝게 소개한다.',
      texts: ['스프링 프리뷰', '봄 신상품 선공개', '가벼워진 컬러', '먼저 만나는 봄'],
      scenes: [
        '유리 온실 통로에서 혼성 모델 3인이 봄 신상품을 입고 걷는 오프닝',
        '세이지 재킷, 페일 옐로 셔츠, 스카이 블루 카디건과 선공개 문구 장면',
        '봄 원단 스와치와 무지 카드가 놓인 프리뷰 안내 장면',
      ],
    },
    styling: {
      purpose: '봄 컬러 조합과 전신 룩을 구체적으로 제안한다.',
      texts: ['스프링 프리뷰', '봄 신상 MD 픽', '세이지 재킷', '스카이 블루 니트'],
      scenes: [
        '혼성 모델 3인의 온실 계단 전신 룩북',
        '재킷, 셔츠, 카디건, 화이트 팬츠, 미니백 조합 정물',
        '얇은 코튼, 라이트 니트, 투명한 봄 원단 소재 디테일',
      ],
    },
    product: {
      purpose: '봄 신상품의 컬러와 소재를 상품 매대처럼 정리한다.',
      texts: ['스프링 프리뷰', '먼저 만나는 봄', '라이트 재킷', '컬러 니트'],
      scenes: [
        '라이트 재킷, 셔츠, 카디건을 무지 행거에 색상 순서로 전시한 장면',
        '세이지, 옐로, 블루 원단의 결을 보여 주는 클로즈업',
        '접힌 봄 상품과 완전 무지 태그를 둔 상품 연결 장면',
      ],
    },
  },
});

const FALLBACK_BY_ID = Object.freeze({
  'event-2026-03-trench-week': {
    mood: '트렌치 베이지, 레인 블루, 차콜, 비에 젖은 역 플랫폼',
    texts: {
      benefit: ['트렌치 위크', '아우터 최대 35%', '비 오는 날의 아우터', '이번 주 트렌치'],
      styling: ['트렌치 위크', '비 오는 날의 MD 룩', '벨티드 실루엣', '차콜 셋업'],
      product: ['트렌치 위크', '트렌치 디테일', '발수 코튼', '소뿔 단추'],
    },
    subjects: ['우산을 든 남성 모델의 젖은 플랫폼 오프닝', '벨티드 트렌치 전신 룩', '견장과 단추와 빗방울 소재 정물'],
  },
  'event-2026-03-photo-review': {
    mood: '화이트, 블랙, 시안과 코랄, 실제 사용자형 UGC 스냅',
    texts: {
      benefit: ['포토 리뷰 챌린지', '최대 5천원 적립', '착용 사진으로 참여', '나만의 리뷰 컷'],
      styling: ['포토 리뷰 챌린지', '리뷰어 스타일 셋', '세 가지 일상룩', '거리에서 찍은 룩'],
      product: ['포토 리뷰 챌린지', '리뷰 속 디테일', '스니커즈 끈', '가방 스트랩'],
    },
    subjects: ['직선형 UGC 모자이크', '세 명의 서로 다른 캐주얼 전신 스냅', '운동화 끈과 재킷 포켓과 가방 스트랩'],
  },
  'event-2026-03-white-day-coupon': {
    mood: '펄 화이트, 블러시 핑크, 딥 레드, 갤러리 선물 정물',
    texts: {
      benefit: ['화이트데이 쿠폰', '선물 아이템 15%', '마음을 담은 선물', '쿠폰으로 준비'],
      styling: ['화이트데이 쿠폰', '선물하는 날의 룩', '블러시 셔츠', '딥 레드 미니백'],
      product: ['화이트데이 쿠폰', '선물 아이템 셀렉션', '실버 이어링', '실크 스카프'],
    },
    subjects: ['펄 전시대 위 선물 상자와 쿠폰 카드', '여성 모델의 미술관 전신 룩', '이어링, 미니백, 스카프 제품 단독 전시'],
  },
  'event-2026-04-shirt-collection': {
    mood: '크리스프 화이트, 옥스퍼드 블루, 그래파이트, 재단실과 셔츠 스택',
    texts: {
      benefit: ['셔츠 컬렉션 런칭', '런칭 한정 혜택', '새로운 셔츠 실루엣', '한정 공개'],
      styling: ['셔츠 컬렉션 런칭', '새로운 셔츠 실루엣', '비대칭 칼라', '와이드 팬츠'],
      product: ['셔츠 컬렉션 런칭', '셔츠 디테일', '칼라와 커프스', '옥스퍼드 조직'],
    },
    subjects: ['건축적으로 쌓은 셔츠 스택', '남성 모델의 재단실 전신 셔츠 룩', '칼라, 커프스, 원단 조직 매크로'],
  },
  'event-2026-04-office-look': {
    mood: '네이비, 쿨 그레이, 코발트, 현대 오피스 복도',
    texts: {
      benefit: ['오피스룩 기획전', '출근룩 최대 40%', '월요일부터 금요일까지', '출근 준비 완료'],
      styling: ['오피스룩 기획전', '5일 출근룩', '네이비 셋업', '코발트 셔츠'],
      product: ['오피스룩 기획전', '오피스 에센셜', '셔츠와 슬랙스', '토트백 정리'],
    },
    subjects: ['혼성 모델의 사무 공간 출근 장면', '긴 오피스 복도 전신 투샷', '셔츠, 슬랙스, 토트백 정물'],
  },
  'event-2026-04-styling-coupon': {
    mood: '웜 베이지, 올리브, 블랙, 피팅룸 상담 장면',
    texts: {
      benefit: ['스타일링 상담 쿠폰', '3만원 쿠폰', '나에게 맞는 조합', '상담 혜택 받기'],
      styling: ['스타일링 상담 쿠폰', '나만의 MD 스타일링', '올리브 아우터', '베이지 이너'],
      product: ['스타일링 상담 쿠폰', '상담 후 추천템', '아우터와 이너', '핏 비교'],
    },
    subjects: ['스타일리스트와 고객의 옷걸이 앞 상담', '거울 앞 혼성 피팅 비교', '행거와 소재 스와치와 추천 상품 정물'],
  },
  'event-2026-05-denim-festival': {
    mood: '딥 인디고, 에크루, 번트 오렌지, 워싱 공장과 데님 질감',
    texts: {
      benefit: ['데님 페스티벌', '데님 최대 50%', '핏별로 고르는 데님', '워싱까지 한눈에'],
      styling: ['데님 페스티벌', '세 가지 데님 핏', '와이드 핏', '커브드 핏'],
      product: ['데님 페스티벌', '데님 워싱 디테일', '인디고 컬러', '스티치 포인트'],
    },
    subjects: ['여러 데님 핏이 걸린 활기찬 오프닝', '체형이 다른 혼성 모델 3인의 데님 전신 룩', '워싱, 스티치, 리벳 매크로'],
  },
  'event-2026-05-family-coupon': {
    mood: '크림, 포레스트 그린, 석류색, 따뜻한 정원과 가족 선물',
    texts: {
      benefit: ['패밀리 먼스 쿠폰', '추가 10% 쿠폰', '함께 고르는 선물', '가족 쇼핑 혜택'],
      styling: ['패밀리 먼스 쿠폰', '함께 입는 주말 룩', '세대별 컬러 매치', '편안한 주말'],
      product: ['패밀리 먼스 쿠폰', '패밀리 셀렉션', '카디건과 셔츠', '선물 포장'],
    },
    subjects: ['가족이 패션 선물을 건네는 생활 장면', '세대별 주말룩 전신 그룹', '접힌 카디건, 셔츠, 선물 포장 정물'],
  },
  'event-2026-05-best-review': {
    mood: '블랙, 화이트, 메탈릭 골드, 갤러리 리뷰 어워즈',
    texts: {
      benefit: ['베스트 리뷰 어워즈', '베스트 리뷰 1만원', '후기로 받는 혜택', '이달의 리뷰'],
      styling: ['베스트 리뷰 어워즈', '리뷰어 초이스 룩', '블랙 셋업', '골드 포인트'],
      product: ['베스트 리뷰 어워즈', '인기 리뷰 상품', '별점 받은 아이템', '리뷰 카드'],
    },
    subjects: ['상품 사진과 후기 카드 전시 벽', '남성 모델의 갤러리 전신 룩', '상품 카드, 별점 모티프, 무지 리뷰 카드 정물'],
  },
  'event-2026-06-midyear-sale': {
    mood: '검정, 크림, 강한 세일 레드, 대형 편집숍 랙',
    texts: {
      benefit: ['미드이어 세일', '베스트 최대 60%', '상반기 베스트', '지금 담아야 할 가격'],
      styling: ['미드이어 세일', '세일 첫날 MD 픽', '크림 셔츠', '블랙 와이드 팬츠'],
      product: ['미드이어 세일', '세일 랙 셀렉션', '베스트 아이템', '가격표 없는 정리'],
    },
    subjects: ['대형 상품 랙과 레드 세일 포인트', '여성 모델의 매장 통로 전신 룩', '크림/블랙 상품 랙과 무지 레드 태그 정물'],
  },
  'event-2026-06-summer-linen': {
    mood: '샌드 베이지, 스카이 블루, 터쿼이즈, 바닷바람 리넨',
    texts: {
      benefit: ['썸머 리넨 컬렉션', '시원한 리넨 신상', '바람이 통하는 옷', '여름 소재 공개'],
      styling: ['썸머 리넨 컬렉션', '바람을 입는 리넨', '리넨 셔츠', '샌드 셋업'],
      product: ['썸머 리넨 컬렉션', '리넨 소재 셀렉션', '통기성 조직', '가벼운 셔츠'],
    },
    subjects: ['해변 자연광의 혼성 리넨 룩북 오프닝', '남녀 모델의 해변 전신 투샷', '리넨 조직, 셔츠, 팬츠 소재 정물'],
  },
  'event-2026-07-vacation-coupon': {
    mood: '오션 블루, 선 옐로, 코랄, 공항과 휴가 짐',
    texts: {
      benefit: ['바캉스 쿠폰팩', '휴가룩 쿠폰 3종', '출발 전 준비', '여행룩 혜택'],
      styling: ['바캉스 쿠폰팩', '출발 전 휴가 룩', '리조트 셔츠', '코랄 쇼츠'],
      product: ['바캉스 쿠폰팩', '휴가 필수템', '셔츠와 샌들', '위빙백'],
    },
    subjects: ['공항 출발 장면과 캐리어 쿠폰팩', '혼성 여행 그룹의 무빙워크 전신 룩', '휴가 셔츠, 샌들, 선글라스 정물'],
  },
  'event-2026-07-cool-touch': {
    mood: '아이스 블루, 실버, 딥 네이비, 물결과 냉감 소재',
    texts: {
      benefit: ['쿨터치 데일리 세일', '최대 35% 할인', '도시의 냉감 소재', '하루 종일 시원하게'],
      styling: ['쿨터치 데일리 세일', '도시의 쿨터치 룩', '기능성 셔츠', '네이비 팬츠'],
      product: ['쿨터치 데일리 세일', '시원함의 구조', '통기 조직', '빠른 건조'],
    },
    subjects: ['강변 계단과 냉감 소재 그래픽 오프닝', '남성 모델의 강변 전신 기능성 룩', '물방울, 통기 구멍, 냉감 원단 매크로'],
  },
  'event-2026-07-summer-review': {
    mood: '화이트, 아쿠아, 라임, 여름 일상 UGC',
    texts: {
      benefit: ['여름 착용 리뷰', '리뷰 적립금 2배', '여름 착장 공유', '입어본 순간 기록'],
      styling: ['여름 착용 리뷰', '리뷰어의 여름 룩', '아쿠아 팬츠', '화이트 민소매'],
      product: ['여름 착용 리뷰', '입어본 여름 디테일', '셔츠 옆선', '샌들 스트랩'],
    },
    subjects: ['일상 착용 스냅 콜라주', '여성 모델의 옥상 여름 전신 룩', '셔츠 옆선, 팬츠 허리, 샌들 스트랩 착용 디테일'],
  },
  'event-2026-08-pre-fall': {
    mood: '버건디, 올리브, 차콜, 어두운 도심 프리폴',
    texts: {
      benefit: ['프리폴 컬렉션', '가을 신상품 선공개', '먼저 만나는 가을', '가벼운 레이어링'],
      styling: ['프리폴 컬렉션', 'MD 추천 프리폴 스타일', '라이트 재킷', '니트 레이어링'],
      product: ['프리폴 컬렉션', '프리폴 에센셜', '버건디 가죽', '가을 니트'],
    },
    subjects: ['어두운 도심 횡단보도의 프리폴 오프닝', '남녀 모델의 재킷과 니트 전신 워킹 룩', '라이트 재킷, 니트, 버건디 가죽 소품 정물'],
  },
  'event-2026-08-last-summer': {
    mood: '선셋 오렌지, 코코아 브라운, 일렉트릭 블루, 시즌 마감 리조트',
    texts: {
      benefit: ['라스트 썸머 클리어런스', '마지막 최대 70%', '여름의 마지막 가격', '시즌 마감 혜택'],
      styling: ['라스트 썸머 클리어런스', '마지막 여름 룩', '코코아 셔츠', '블루 쇼츠'],
      product: ['라스트 썸머 클리어런스', '라스트 썸머 셀렉션', '샌들과 셔츠', '위빙백'],
    },
    subjects: ['노을 리조트 수영장 가장자리의 세일 정물', '남성 모델의 수영장 데크 전신 여름 룩', '셔츠, 샌들, 선글라스, 위빙백 플랫레이'],
  },
  h1WITXqWE2BL3G0ACiza: {
    mood: '코발트 블루, 화이트, 비비드 오렌지, 미니멀 로프트 첫 주문',
    texts: {
      benefit: ['신규 회원 가입 이벤트', '첫 구매 20% 쿠폰', '가입하고 바로 혜택', '첫 주문 시작'],
      styling: ['신규 회원 가입 이벤트', '첫 쇼핑 추천 룩', '코발트 셔츠', '화이트 데님'],
      product: ['신규 회원 가입 이벤트', '첫 주문 패키지', '셔츠와 스니커즈', '오렌지 지갑'],
    },
    subjects: ['모바일 기기와 첫 주문 박스 정물', '여성 모델의 로프트 전신 첫 쇼핑 룩', '코발트 셔츠, 스니커즈, 오렌지 카드지갑 언박싱'],
  },
  PacCrKVG9TikHo7lambG: {
    mood: '스프링 그린, 소프트 핑크, 코발트 블루, 꽃시장 봄 스트리트',
    texts: {
      benefit: ['봄맞이 특가 세일', '봄 신상품 최대 50%', '봄 거리의 특가', '신상품을 가볍게'],
      styling: ['봄맞이 특가 세일', '봄 거리의 MD 픽', '그린 재킷', '핑크 셔츠'],
      product: ['봄맞이 특가 세일', '봄 신상품 월', '재킷과 셔츠', '코발트 백'],
    },
    subjects: ['꽃시장 골목의 혼성 모델 3인 오프닝', '꽃시장 계단의 봄 스트리트 전신 룩', '봄 재킷, 스트라이프 셔츠, 코발트 백 선반 정물'],
  },
});

function buildStoryFromFallback(source) {
  const fallback = FALLBACK_BY_ID[source.id];
  if (!fallback) {
    throw new Error(`Missing story config for ${source.id}`);
  }

  return {
    mood: fallback.mood,
    benefit: {
      purpose: `${source.title}의 행사 성격과 핵심 혜택을 도입한다.`,
      texts: fallback.texts.benefit,
      scenes: [
        fallback.subjects[0],
        `${source.benefit}을 중심으로 상품과 무지 쿠폰 카드를 함께 구성한 혜택 장면`,
        '완전히 무지인 안내 카드와 관련 상품 소품을 둔 참여 안내 장면',
      ],
    },
    styling: {
      purpose: `${source.title}에 어울리는 실제 착장과 스타일 조합을 제안한다.`,
      texts: fallback.texts.styling,
      scenes: [
        fallback.subjects[1],
        '상의, 하의, 가방 또는 신발을 한 벌 코디처럼 보여 주는 스타일 조합 장면',
        '대표 원단, 여밈, 스트랩, 스티치 중 해당 상품군의 소재 디테일 장면',
      ],
    },
    product: {
      purpose: `${source.title}의 추천 상품군을 상품 매대처럼 정리한다.`,
      texts: fallback.texts.product,
      scenes: [
        fallback.subjects[2],
        '핵심 원단과 제품 구조를 실제 쇼핑몰 상세처럼 보여 주는 클로즈업',
        '완전히 무지인 태그와 함께 관련 상품을 정돈한 상품 연결 장면',
      ],
    },
  };
}

function buildPrompt({ event, role, story }) {
  const roleConfig = ROLE_CONFIG[role];
  const flow = roleConfig.flows;
  return [
    'Use case: ads-marketing',
    `Asset type: ${roleConfig.assetType}`,
    `Section purpose: ${story.purpose}`,
    `Primary request: ${flow[0]}: ${story.scenes[0]}. ${flow[1]}: ${story.scenes[1]}. ${flow[2]}: ${story.scenes[2]}.`,
    `Text (verbatim): ${story.texts.map((text) => `"${text}"`).join(', ')}`,
    `Campaign direction: 실제 한국 종합 패션몰 이벤트 상세 본문. ${event.campaignCommand} 이번 이미지는 같은 이벤트의 다른 장면과 내용이 이어지되, 이전 이미지와 동일한 구도나 같은 모델 클로즈업을 반복하지 않는다.`,
    'Constraints: 세로 2:3, 단일 포스터 금지, 위에서 아래로 자연스럽게 이어지는 사진 장면 2~3개, 사진 장면 3개 이하, 제목 포함 한글 카피 4개 이하, 가로 중앙 안전 영역 88%, 정확한 한글, 이미지 내 텍스트는 Text (verbatim)의 문구만 사용, 그 외 한글·영문·의미 없는 문구 금지, 타사 브랜드·로고·워터마크 금지, 가짜 로고와 워터마크 없음, 앱 UI 없음, 목 라벨과 상품 태그에는 글자 없음, 둥근 장식과 그림자 없음',
  ].join('\n');
}

function buildEvent(source) {
  const detailed = STORIES[source.id] || buildStoryFromFallback(source);
  const event = {
    id: source.id,
    title: source.title,
    benefit: source.benefit,
    referenceImage: source.wideOutput,
    campaignCommand: `실제 한국 종합 패션몰의 ${source.title} 기획전. 원본 팔레트: ${source.palette}. 확장 무드: ${detailed.mood}. ${source.concept}을 세 이미지에서 일관되게 유지한다.`,
    images: [],
  };

  for (const role of ['benefit', 'styling', 'product']) {
    const story = detailed[role];
    event.images.push({
      role,
      story: {
        purpose: story.purpose,
        scenes: story.scenes,
        texts: story.texts,
      },
      prompt: buildPrompt({ event, role, story }),
      output: `public/events/2026-editorial/${source.id}-${VERSION}-${role}.webp`,
    });
  }

  return event;
}

const manifest = {
  version: VERSION,
  target: TARGET,
  events: sourceManifest.events.map(buildEvent),
};

fs.writeFileSync(`${OUTPUT}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`);
fs.renameSync(`${OUTPUT}.tmp`, OUTPUT);
console.log(`Wrote ${OUTPUT}: ${manifest.events.length} events, ${manifest.events.flatMap((event) => event.images).length} images`);
