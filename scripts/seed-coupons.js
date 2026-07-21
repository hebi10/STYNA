// Firestore 쿠폰 시드 데이터 스크립트 (JavaScript)
const { buildCouponSeedData } = require("./coupon-seed-data");

function loadCouponSeedRuntime() {
  require("dotenv").config({ path: ".env.local" });

  return {
    firebase: require("firebase/app"),
    firestore: require("firebase/firestore"),
  };
}

async function seedCouponData(data, runtime) {
  const { firebase, firestore } = runtime;
  const app = firebase.initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  const db = firestore.getFirestore(app);

  for (const coupon of data.coupons) {
    const timestamp = firestore.Timestamp.now();
    await firestore.setDoc(
      firestore.doc(db, "coupons", coupon.id),
      {
        ...coupon,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    );
  }

  const userCouponsCollection = firestore.collection(db, "user_coupons");
  for (const userCoupon of data.userCoupons) {
    const timestamp = firestore.Timestamp.now();
    await firestore.addDoc(userCouponsCollection, {
      ...userCoupon,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
}

async function main() {
  const runtime = loadCouponSeedRuntime();
  const data = buildCouponSeedData(new Date());

  await seedCouponData(data, runtime);
  console.log("✅ 쿠폰 시드 데이터 생성 완료");
}

if (require.main === module) {
  void main().catch((error) => {
    console.error("❌ 시드 데이터 생성 중 오류 발생:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  loadCouponSeedRuntime,
  seedCouponData,
};
