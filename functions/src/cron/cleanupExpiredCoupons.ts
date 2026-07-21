import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { isExpiredOnKstDay, toKstDayKey } from "../domain/kstDate";

/**
 * 만료 쿠폰 자동 정리 (매일 자정 KST)
 *
 * '사용가능' 상태의 유저쿠폰 중 쿠폰 마스터 만료일이
 * 지난 쿠폰을 '기간만료' 상태로 변경합니다.
 */
export const cleanupExpiredCoupons = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Asia/Seoul",
    region: "us-central1",
  },
  async () => {
    try {
      const db = getFirestore();
      const today = new Date();
      const todayStr = toKstDayKey(today);

      const expiredUserCoupons = await db
        .collection("user_coupons")
        .where("status", "==", "사용가능")
        .get();

      const batch = db.batch();
      let updateCount = 0;

      for (const userCouponDoc of expiredUserCoupons.docs) {
        const userCoupon = userCouponDoc.data();

        const couponDoc = await db.collection("coupons").doc(userCoupon.couponId).get();
        if (!couponDoc.exists) continue;

        const couponData = couponDoc.data();
        if (isExpiredOnKstDay(couponData?.expiryDate, today)) {
          batch.update(userCouponDoc.ref, {
            status: "기간만료",
            expiredDate: todayStr,
            updatedAt: FieldValue.serverTimestamp(),
          });
          updateCount++;
        }
      }

      if (updateCount > 0) {
        await batch.commit();
      }

      console.log(`만료 쿠폰 정리 완료: ${updateCount}개 처리`);
    } catch (error) {
      console.error("만료 쿠폰 정리 실패:", error);
      throw error;
    }
  }
);
