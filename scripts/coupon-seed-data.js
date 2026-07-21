const KST_TIME_ZONE = "Asia/Seoul";
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const kstDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: KST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toKstDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("A valid Date is required.");
  }

  const parts = Object.fromEntries(
    kstDateFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addKstDays(dayKey, days) {
  const match = DATE_KEY_PATTERN.exec(dayKey);
  if (!match || !Number.isInteger(days)) {
    throw new TypeError("A YYYY-MM-DD day key and integer day offset are required.");
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  const normalizedInput = date.toISOString().slice(0, 10);

  if (normalizedInput !== dayKey) {
    throw new RangeError("The KST day key is not a valid calendar date.");
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildCouponSeedData(now) {
  const runDate = toKstDateKey(now);
  const availableIssuedDate = addKstDays(runDate, -2);

  const coupons = [
    {
      id: "C001",
      name: "신규회원 환영 쿠폰",
      type: "할인금액",
      value: 10000,
      minOrderAmount: 50000,
      expiryDate: addKstDays(runDate, 30),
      description: "첫 구매 시 사용 가능한 특별 할인 쿠폰",
      isActive: true,
    },
    {
      id: "C002",
      name: "겨울 세일 쿠폰",
      type: "할인율",
      value: 20,
      minOrderAmount: 100000,
      expiryDate: addKstDays(runDate, 60),
      description: "겨울 상품 전용 할인 쿠폰",
      isActive: true,
    },
    {
      id: "C003",
      name: "무료배송 쿠폰",
      type: "무료배송",
      value: 0,
      expiryDate: addKstDays(runDate, 14),
      description: "배송비 무료 혜택",
      isActive: true,
    },
    {
      id: "C004",
      name: "추석 특가 쿠폰",
      type: "할인율",
      value: 15,
      minOrderAmount: 80000,
      expiryDate: addKstDays(runDate, -1),
      description: "추석 연휴 특별 할인",
      isActive: false,
    },
    {
      id: "C005",
      name: "신년 맞이 특가",
      type: "할인금액",
      value: 15000,
      minOrderAmount: 120000,
      expiryDate: addKstDays(runDate, 60),
      description: "새해 첫 구매 특별 혜택",
      isActive: true,
    },
  ];

  const userCoupons = [
    {
      uid: "user_1234",
      couponId: "C001",
      status: "사용가능",
      issuedDate: availableIssuedDate,
    },
    {
      uid: "user_1234",
      couponId: "C003",
      status: "사용완료",
      issuedDate: addKstDays(runDate, -10),
      usedDate: addKstDays(runDate, -1),
      orderId: "ORDER_001",
    },
    {
      uid: "user_1234",
      couponId: "C002",
      status: "사용가능",
      issuedDate: availableIssuedDate,
    },
    {
      uid: "user_1234",
      couponId: "C005",
      status: "사용가능",
      issuedDate: availableIssuedDate,
    },
    {
      uid: "user_5678",
      couponId: "C004",
      status: "기간만료",
      issuedDate: addKstDays(runDate, -30),
      expiredDate: runDate,
    },
  ];

  return { runDate, coupons, userCoupons };
}

module.exports = {
  addKstDays,
  buildCouponSeedData,
  toKstDateKey,
};
