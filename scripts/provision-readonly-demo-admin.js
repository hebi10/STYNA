const DEFAULT_DEMO_ADMIN_EMAIL = ['test', 'test.com'].join('@');
const SAFE_CLI_ERRORS = new Set([
  'A demo administrator UID or email must be configured.',
  'Configured demo administrator identifiers do not match.',
  'Demo administrator user document was not found.',
  'Refusing to remove the only active full administrator. Provision another full administrator first.',
]);

function formatCliError(error) {
  const message = error instanceof Error ? error.message : '';
  return SAFE_CLI_ERRORS.has(message)
    ? message
    : 'Demo administrator provisioning failed.';
}

function parseArgs(argv, env = process.env) {
  const args = new Set(argv.slice(2));
  const uid = env.PORTFOLIO_DEMO_ADMIN_UID?.trim() || '';
  const configuredEmail = env.PORTFOLIO_DEMO_ADMIN_EMAIL?.trim().toLowerCase() || '';
  return {
    execute: args.has('--execute'),
    uid,
    email: configuredEmail || (uid ? '' : DEFAULT_DEMO_ADMIN_EMAIL),
  };
}

async function resolveDemoAdminUser(auth, { uid, email }) {
  if (uid) {
    const user = await auth.getUser(uid);
    if (email && user.email?.trim().toLowerCase() !== email) {
      throw new Error('Configured demo administrator identifiers do not match.');
    }
    return user;
  }

  if (email) {
    return auth.getUserByEmail(email);
  }

  throw new Error('A demo administrator UID or email must be configured.');
}

async function countOtherActiveAdmins(db, demoUid) {
  const snapshot = await db.collection('users')
    .where('role', '==', 'admin')
    .where('status', '==', 'active')
    .get();

  return snapshot.docs.filter((document) => document.id !== demoUid).length;
}

async function runProvisionDemoAdmin(options, runtime) {
  const { execute, uid, email } = options;
  const { admin, db, projectId } = runtime;
  const authUser = await resolveDemoAdminUser(admin.auth(), { uid, email });
  const resolvedUid = authUser.uid;
  const userSnapshot = await db.collection('users').doc(resolvedUid).get();
  if (!userSnapshot.exists) {
    throw new Error('Demo administrator user document was not found.');
  }

  const otherAdminCount = await countOtherActiveAdmins(db, resolvedUid);
  if (otherAdminCount < 1) {
    throw new Error('Refusing to remove the only active full administrator. Provision another full administrator first.');
  }

  const userData = userSnapshot.data() || {};
  const claims = { ...(authUser.customClaims || {}) };
  delete claims.admin;
  claims.role = 'demo_admin';
  claims.demoAdmin = true;

  const summary = {
    projectId,
    mode: execute ? 'execute' : 'dry-run',
    currentRole: typeof userData.role === 'string' ? userData.role : null,
    currentClaims: {
      admin: authUser.customClaims?.admin === true,
      role: typeof authUser.customClaims?.role === 'string'
        ? authUser.customClaims.role
        : null,
      demoAdmin: authUser.customClaims?.demoAdmin === true,
    },
    otherActiveAdminCount: otherAdminCount,
    nextRole: 'demo_admin',
    nextClaims: { role: 'demo_admin', demoAdmin: true },
  };

  if (!execute) {
    return summary;
  }

  await admin.auth().setCustomUserClaims(resolvedUid, claims);
  await db.collection('users').doc(resolvedUid).update({
    role: 'demo_admin',
    isAdmin: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await admin.auth().revokeRefreshTokens(resolvedUid);
  return summary;
}

async function run() {
  const runtime = require('./util-firestore-admin');
  const summary = await runProvisionDemoAdmin(parseArgs(process.argv), runtime);
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  run().catch((error) => {
    console.error(formatCliError(error));
    process.exitCode = 1;
  });
}

module.exports = {
  formatCliError,
  parseArgs,
  resolveDemoAdminUser,
  runProvisionDemoAdmin,
};
