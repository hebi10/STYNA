const { admin, db, projectId } = require('./util-firestore-admin');

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    execute: args.has('--execute'),
    uid: process.env.PORTFOLIO_DEMO_ADMIN_UID?.trim() || '',
  };
}

async function countOtherActiveAdmins(db, demoUid) {
  const snapshot = await db.collection('users')
    .where('role', '==', 'admin')
    .where('status', '==', 'active')
    .get();

  return snapshot.docs.filter((document) => document.id !== demoUid).length;
}

async function run() {
  const { execute, uid } = parseArgs(process.argv);
  if (!uid) {
    throw new Error('PORTFOLIO_DEMO_ADMIN_UID must be set.');
  }

  const [userSnapshot, authUser] = await Promise.all([
    db.collection('users').doc(uid).get(),
    admin.auth().getUser(uid),
  ]);
  if (!userSnapshot.exists) {
    throw new Error('Demo administrator user document was not found.');
  }

  const otherAdminCount = await countOtherActiveAdmins(db, uid);
  if (otherAdminCount < 1) {
    throw new Error('Refusing to remove the only active full administrator. Provision another full administrator first.');
  }

  const claims = { ...(authUser.customClaims || {}) };
  delete claims.admin;
  claims.role = 'demo_admin';
  claims.demoAdmin = true;

  const summary = {
    projectId,
    uid,
    mode: execute ? 'execute' : 'dry-run',
    otherActiveAdminCount: otherAdminCount,
    nextRole: 'demo_admin',
    nextClaims: { role: 'demo_admin', demoAdmin: true },
  };

  if (!execute) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await admin.auth().setCustomUserClaims(uid, claims);
  await db.collection('users').doc(uid).update({
    role: 'demo_admin',
    isAdmin: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await admin.auth().revokeRefreshTokens(uid);
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
