const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

function resolveConfiguredProjectId() {
  const configuredProjectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    null
  );
  return typeof configuredProjectId === "string" && configuredProjectId.trim()
    ? configuredProjectId.trim()
    : null;
}

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
const serviceAccount = fs.existsSync(serviceAccountPath)
  ? require(serviceAccountPath)
  : null;
const credentialProjectId = typeof serviceAccount?.project_id === "string"
  ? serviceAccount.project_id.trim()
  : null;

function resolveProjectId() {
  const configuredProjectId = resolveConfiguredProjectId();
  if (
    configuredProjectId &&
    credentialProjectId &&
    configuredProjectId !== credentialProjectId
  ) {
    throw new Error(
      "Firestore migration project mismatch. Refusing to initialize Admin SDK."
    );
  }
  return credentialProjectId || configuredProjectId || "hebimall";
}

function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = resolveProjectId();

  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

const app = initializeAdminApp();
const appProjectId = typeof app.options.projectId === "string"
  ? app.options.projectId.trim()
  : null;
const projectId = resolveProjectId();
if (appProjectId && appProjectId !== projectId) {
  throw new Error(
    "Firestore migration project mismatch. Refusing to create a database client."
  );
}

module.exports = {
  admin,
  db: admin.firestore(),
  projectId: appProjectId || projectId,
  credentialProjectId,
};
