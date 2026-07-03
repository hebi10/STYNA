#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    console.error('.env.local file was not found.');
    console.log(`
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
    `);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach((line) => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });

  return envVars;
}

function setFirebaseSecret(key, value) {
  try {
    console.log(`Setting secret: ${key}`);
    execSync(`firebase functions:secrets:set ${key}`, {
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    console.log(`${key} configured`);
    return true;
  } catch (error) {
    console.error(`${key} failed:`, error.message);
    return false;
  }
}

async function main() {
  try {
    execSync('firebase --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('Firebase CLI is not installed.');
    console.log('Install it with: npm install -g firebase-tools');
    process.exit(1);
  }

  try {
    execSync('firebase projects:list', { stdio: 'ignore' });
  } catch (error) {
    console.error('Firebase CLI is not logged in.');
    console.log('Log in with: firebase login');
    process.exit(1);
  }

  const envVars = loadEnvFile();
  const requiredSecrets = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_API_URL',
    'NODE_ENV',
    'NEXT_PUBLIC_USE_FIREBASE_EMULATOR',
  ];

  const secretMapping = {
    FIREBASE_API_KEY: envVars.NEXT_PUBLIC_FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: envVars.NEXT_PUBLIC_FIREBASE_APP_ID,
    OPENAI_API_KEY: envVars.OPENAI_API_KEY,
    NEXT_PUBLIC_API_URL: envVars.NEXT_PUBLIC_API_URL,
    NODE_ENV: envVars.NODE_ENV,
    NEXT_PUBLIC_USE_FIREBASE_EMULATOR: envVars.NEXT_PUBLIC_USE_FIREBASE_EMULATOR,
  };

  const missingSecrets = requiredSecrets.filter((secretKey) => !secretMapping[secretKey]);
  if (missingSecrets.length > 0) {
    console.error(`Missing required secrets: ${missingSecrets.join(', ')}`);
    process.exit(1);
  }

  let hasFailure = false;
  for (const [secretKey, value] of Object.entries(secretMapping)) {
    if (!setFirebaseSecret(secretKey, value)) {
      hasFailure = true;
    }
  }

  if (hasFailure) {
    console.error('One or more Firebase secrets failed to set.');
    process.exit(1);
  }

  console.log('Firebase Functions secrets were configured.');
  console.log('Next: cd functions && npm run build && firebase deploy --only functions');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { loadEnvFile, setFirebaseSecret };
