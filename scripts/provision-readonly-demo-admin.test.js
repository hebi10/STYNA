/** @jest-environment node */

const path = require('path');
const { spawnSync } = require('child_process');

const scriptPath = path.join(__dirname, 'provision-readonly-demo-admin.js');

const demoUid = ['portfolio', 'demo', 'uid'].join('-');
const strictAdminUid = ['strict', 'admin', 'uid'].join('-');
const demoEmail = ['test', 'test.com'].join('@');

function createRuntime({ resolvedEmail = demoEmail } = {}) {
  const writes = [];
  const auth = {
    getUser: async () => ({
      uid: demoUid,
      email: resolvedEmail,
      customClaims: { admin: true, role: 'admin' },
    }),
    getUserByEmail: async (email) => {
      if (email !== demoEmail) {
        throw new Error('Unexpected demo administrator lookup.');
      }
      return {
        uid: demoUid,
        email,
        customClaims: { admin: true, role: 'admin' },
      };
    },
    setCustomUserClaims: async (uid, claims) => writes.push(['claims', uid, claims]),
    revokeRefreshTokens: async (uid) => writes.push(['revoke', uid]),
  };
  const db = {
    collection: (name) => {
      if (name !== 'users') {
        throw new Error('Unexpected collection.');
      }
      return {
        doc: (uid) => ({
          get: async () => ({
            exists: uid === demoUid,
            data: () => ({ status: 'active', role: 'admin' }),
          }),
          update: async (data) => writes.push(['document', uid, data]),
        }),
        where: () => ({
          where: () => ({
            get: async () => ({ docs: [{ id: strictAdminUid }] }),
          }),
        }),
      };
    },
  };

  return {
    admin: {
      auth: () => auth,
      firestore: {
        FieldValue: { serverTimestamp: () => 'server-timestamp' },
      },
    },
    db,
    projectId: 'verified-project',
    writes,
  };
}

describe('read-only demo administrator provisioning', () => {
  test('imports without loading Firebase Admin or running the CLI', () => {
    const importProbe = `
      const Module = require('module');
      const originalLoad = Module._load;
      Module._load = function(request, parent, isMain) {
        if (String(request).includes('util-firestore-admin')) {
          throw new Error('Firebase Admin loaded during import');
        }
        return originalLoad.call(this, request, parent, isMain);
      };
      console.log = () => { throw new Error('import wrote to stdout'); };
      console.error = () => { throw new Error('import wrote to stderr'); };
      require(${JSON.stringify(scriptPath)});
    `;
    const result = spawnSync(process.execPath, ['-e', importProbe], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  test('resolves the portfolio demo login by email when no UID is configured', async () => {
    const { parseArgs, runProvisionDemoAdmin } = require('./provision-readonly-demo-admin');
    const runtime = createRuntime();

    const summary = await runProvisionDemoAdmin(
      parseArgs(['node', 'script'], {}),
      runtime,
    );

    expect(summary).toMatchObject({
      mode: 'dry-run',
      currentRole: 'admin',
      otherActiveAdminCount: 1,
      nextRole: 'demo_admin',
    });
    expect(runtime.writes).toEqual([]);
    const serializedSummary = JSON.stringify(summary);
    expect(serializedSummary.includes(demoUid)).toBe(false);
    expect(serializedSummary.includes(demoEmail)).toBe(false);
  });

  test('rejects mismatched UID and email configuration before any write', async () => {
    const { parseArgs, runProvisionDemoAdmin } = require('./provision-readonly-demo-admin');
    const runtime = createRuntime({
      resolvedEmail: ['different', 'example.invalid'].join('@'),
    });
    const env = {
      PORTFOLIO_DEMO_ADMIN_UID: demoUid,
      PORTFOLIO_DEMO_ADMIN_EMAIL: demoEmail,
    };

    await expect(runProvisionDemoAdmin(
      parseArgs(['node', 'script', '--execute'], env),
      runtime,
    )).rejects.toThrow('Configured demo administrator identifiers do not match.');
    expect(runtime.writes).toEqual([]);
  });

  test('redacts Firebase errors before writing them to the CLI', () => {
    const { formatCliError } = require('./provision-readonly-demo-admin');
    const externalError = new Error(
      ['Firebase lookup failed for ', demoEmail, ' and ', demoUid].join(''),
    );

    const message = formatCliError(externalError);

    expect(message).toBe('Demo administrator provisioning failed.');
    expect(message.includes(demoUid)).toBe(false);
    expect(message.includes(demoEmail)).toBe(false);
  });
});
