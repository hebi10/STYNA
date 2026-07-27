function normalizeProjectId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validateFirestoreMigrationRuntime(runtime) {
  if (!runtime || !runtime.db || !runtime.admin) {
    throw new Error('A Firestore migration runtime must provide Admin SDK and database access.');
  }

  let appProjectId = null;
  try {
    appProjectId = normalizeProjectId(runtime.admin.app().options.projectId);
  } catch {
    appProjectId = null;
  }
  const reportedProjectId = normalizeProjectId(runtime.projectId);
  const credentialProjectId = normalizeProjectId(runtime.credentialProjectId);
  if (!appProjectId) {
    throw new Error('Firestore migration target project could not be verified.');
  }
  const projectIds = [reportedProjectId, appProjectId, credentialProjectId].filter(Boolean);
  const uniqueProjectIds = new Set(projectIds);
  if (uniqueProjectIds.size === 0) {
    throw new Error('Firestore migration target project could not be verified.');
  }
  if (uniqueProjectIds.size > 1) {
    throw new Error('Firestore migration project mismatch. Refusing to access any project.');
  }

  const projectId = appProjectId || credentialProjectId || reportedProjectId;
  return {
    ...runtime,
    projectId,
    targetProjectVerified: true,
  };
}

function loadFirestoreMigrationRuntime() {
  return validateFirestoreMigrationRuntime(require('./util-firestore-admin'));
}

module.exports = {
  loadFirestoreMigrationRuntime,
  validateFirestoreMigrationRuntime,
};
