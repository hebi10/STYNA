const { admin, db } = require("./util-firestore-admin");
const {
  faqs,
  notices,
  mainBanners,
  offlineStores,
  offlineServices,
  offlineInfo,
} = require("./static-content-data");

const now = () => admin.firestore.FieldValue.serverTimestamp();

async function upsertCollection(collectionName, items) {
  const batch = db.batch();

  items.forEach(({ id, ...data }) => {
    batch.set(db.collection(collectionName).doc(id), {
      ...data,
      isActive: data.isActive !== false,
      updatedAt: now(),
      createdAt: now(),
    }, { merge: true });
  });

  await batch.commit();
  console.log(`${collectionName}: ${items.length} documents upserted`);
}

async function main() {
  await upsertCollection("faqs", faqs);
  await upsertCollection("notices", notices);
  await upsertCollection("mainBanners", mainBanners);
  await upsertCollection("offlineStores", offlineStores);
  await upsertCollection("offlineServices", offlineServices);

  await db.collection("offlineInfo").doc(offlineInfo.id).set({
    weekdayHours: offlineInfo.weekdayHours,
    serviceHours: offlineInfo.serviceHours,
    noticeLines: offlineInfo.noticeLines,
    isActive: true,
    updatedAt: now(),
    createdAt: now(),
  }, { merge: true });
  console.log("offlineInfo: 1 document upserted");
}

main().catch((error) => {
  console.error("Static content seed failed:", error);
  process.exit(1);
});
