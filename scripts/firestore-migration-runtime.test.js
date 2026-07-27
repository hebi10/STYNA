const {
  validateFirestoreMigrationRuntime,
} = require('./firestore-migration-runtime');

function runtime({ reported, app, credential }) {
  return {
    admin: {
      app: () => ({ options: { projectId: app } }),
    },
    db: {},
    projectId: reported,
    credentialProjectId: credential,
  };
}

describe('Firestore migration runtime target validation', () => {
  test('reports the actual matching app and service-account target', () => {
    expect(validateFirestoreMigrationRuntime(runtime({
      reported: 'hebimall-prod',
      app: 'hebimall-prod',
      credential: 'hebimall-prod',
    }))).toMatchObject({
      projectId: 'hebimall-prod',
      targetProjectVerified: true,
    });
  });

  test('rejects a reported project that differs from the initialized Admin app', () => {
    expect(() => validateFirestoreMigrationRuntime(runtime({
      reported: 'hebimall-staging',
      app: 'hebimall-prod',
      credential: 'hebimall-prod',
    }))).toThrow('Firestore migration project mismatch');
  });

  test('rejects a service-account target that differs from configured app target', () => {
    expect(() => validateFirestoreMigrationRuntime(runtime({
      reported: 'hebimall-staging',
      app: 'hebimall-staging',
      credential: 'hebimall-prod',
    }))).toThrow('Firestore migration project mismatch');
  });

  test('derives the report target from the Admin app when no duplicate report exists', () => {
    expect(validateFirestoreMigrationRuntime(runtime({
      reported: undefined,
      app: 'hebimall-prod',
      credential: undefined,
    }))).toMatchObject({
      projectId: 'hebimall-prod',
      targetProjectVerified: true,
    });
  });

  test('rejects a runtime whose initialized Admin app has no explicit target', () => {
    expect(() => validateFirestoreMigrationRuntime(runtime({
      reported: 'hebimall-prod',
      app: undefined,
      credential: undefined,
    }))).toThrow('target project could not be verified');
  });
});
