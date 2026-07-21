/** @jest-environment node */

afterEach(() => {
  jest.resetModules();
  jest.dontMock("dotenv");
  jest.dontMock("firebase/app");
  jest.dontMock("firebase/firestore");
});

test("always creates active and expired coupon fixtures from the KST run day", () => {
  const { buildCouponSeedData } = require("./coupon-seed-data");

  const data = buildCouponSeedData(new Date("2026-07-20T15:30:00.000Z"));

  expect(data.coupons.some(
    (coupon) => coupon.isActive && coupon.expiryDate > "2026-07-21",
  )).toBe(true);
  expect(data.userCoupons.some((coupon) => coupon.status === "기간만료")).toBe(true);
});

test("uses July 21 in Seoul after 15:00 UTC", () => {
  const { buildCouponSeedData, toKstDateKey } = require("./coupon-seed-data");

  const now = new Date("2026-07-20T15:00:00.000Z");
  const data = buildCouponSeedData(now);

  expect(toKstDateKey(now)).toBe("2026-07-21");
  expect(data.runDate).toBe("2026-07-21");
});

test("builds every seed date relative to the KST run day", () => {
  const { buildCouponSeedData } = require("./coupon-seed-data");

  const data = buildCouponSeedData(new Date("2026-07-20T14:59:59.999Z"));
  const couponsById = Object.fromEntries(data.coupons.map((coupon) => [coupon.id, coupon]));
  const userCouponsByCouponId = Object.fromEntries(
    data.userCoupons.map((coupon) => [coupon.couponId, coupon]),
  );

  expect(data.runDate).toBe("2026-07-20");
  expect(couponsById.C001.expiryDate).toBe("2026-08-19");
  expect(couponsById.C002.expiryDate).toBe("2026-09-18");
  expect(couponsById.C003.expiryDate).toBe("2026-08-03");
  expect(couponsById.C004).toMatchObject({ expiryDate: "2026-07-19", isActive: false });
  expect(couponsById.C005.expiryDate).toBe("2026-09-18");

  expect(userCouponsByCouponId.C001.issuedDate).toBe("2026-07-18");
  expect(userCouponsByCouponId.C002.issuedDate).toBe("2026-07-18");
  expect(userCouponsByCouponId.C005.issuedDate).toBe("2026-07-18");
  expect(userCouponsByCouponId.C003).toMatchObject({
    issuedDate: "2026-07-10",
    usedDate: "2026-07-19",
    status: "사용완료",
  });
  expect(userCouponsByCouponId.C004).toMatchObject({
    issuedDate: "2026-06-20",
    expiredDate: "2026-07-20",
    status: "기간만료",
  });

  for (const record of [...data.coupons, ...data.userCoupons]) {
    expect(record).not.toHaveProperty("createdAt");
    expect(record).not.toHaveProperty("updatedAt");
  }
});

test("preserves the existing fixed coupon identities and labels", () => {
  const { buildCouponSeedData } = require("./coupon-seed-data");

  const data = buildCouponSeedData(new Date("2026-07-20T15:00:00.000Z"));

  expect(data.coupons.map(({ id, name }) => ({ id, name }))).toEqual([
    { id: "C001", name: "신규회원 환영 쿠폰" },
    { id: "C002", name: "겨울 세일 쿠폰" },
    { id: "C003", name: "무료배송 쿠폰" },
    { id: "C004", name: "추석 특가 쿠폰" },
    { id: "C005", name: "신년 맞이 특가" },
  ]);
});

test("adds KST calendar days across month and year boundaries", () => {
  const { addKstDays } = require("./coupon-seed-data");

  expect(addKstDays("2024-02-28", 1)).toBe("2024-02-29");
  expect(addKstDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addKstDays("2026-01-01", -1)).toBe("2025-12-31");
});

test("imports the coupon CLI without loading Firebase or dotenv", () => {
  const dotenvConfig = jest.fn();
  const initializeApp = jest.fn();
  const getFirestore = jest.fn();
  let dotenvLoaded = false;
  let firebaseAppLoaded = false;
  let firestoreLoaded = false;

  jest.doMock("dotenv", () => {
    dotenvLoaded = true;
    return { config: dotenvConfig };
  });
  jest.doMock("firebase/app", () => {
    firebaseAppLoaded = true;
    return { initializeApp };
  });
  jest.doMock("firebase/firestore", () => {
    firestoreLoaded = true;
    return { getFirestore };
  });

  let couponSeedCli;
  jest.isolateModules(() => {
    couponSeedCli = require("./seed-coupons");
  });

  expect(couponSeedCli).toEqual(expect.objectContaining({
    loadCouponSeedRuntime: expect.any(Function),
    seedCouponData: expect.any(Function),
  }));
  expect(dotenvLoaded).toBe(false);
  expect(firebaseAppLoaded).toBe(false);
  expect(firestoreLoaded).toBe(false);
  expect(dotenvConfig).not.toHaveBeenCalled();
  expect(initializeApp).not.toHaveBeenCalled();
  expect(getFirestore).not.toHaveBeenCalled();
});

test("writes only through the injected runtime and adds timestamps at write time", async () => {
  const { buildCouponSeedData } = require("./coupon-seed-data");
  const { seedCouponData } = require("./seed-coupons");
  const app = { name: "seed-app" };
  const db = { name: "seed-db" };
  const timestamp = { seconds: 123, nanoseconds: 0 };
  const runtime = {
    firebase: {
      initializeApp: jest.fn(() => app),
    },
    firestore: {
      getFirestore: jest.fn(() => db),
      collection: jest.fn((database, name) => ({ database, name })),
      doc: jest.fn((database, collectionName, id) => ({ database, collectionName, id })),
      setDoc: jest.fn().mockResolvedValue(undefined),
      addDoc: jest.fn().mockResolvedValue(undefined),
      Timestamp: {
        now: jest.fn(() => timestamp),
      },
    },
  };
  const data = buildCouponSeedData(new Date("2026-07-20T15:00:00.000Z"));

  await seedCouponData(data, runtime);

  expect(runtime.firebase.initializeApp).toHaveBeenCalledTimes(1);
  expect(runtime.firestore.getFirestore).toHaveBeenCalledWith(app);
  expect(runtime.firestore.setDoc).toHaveBeenCalledTimes(data.coupons.length);
  expect(runtime.firestore.addDoc).toHaveBeenCalledTimes(data.userCoupons.length);
  for (const [, record] of runtime.firestore.setDoc.mock.calls) {
    expect(record).toEqual(expect.objectContaining({
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }
  for (const [, record] of runtime.firestore.addDoc.mock.calls) {
    expect(record).toEqual(expect.objectContaining({
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }
});
