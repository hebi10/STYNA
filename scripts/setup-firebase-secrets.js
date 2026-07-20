#!/usr/bin/env node

/**
 * Firebase Functions 환경변수 설정 스크립트
 * 
 * 사용법:
 * node scripts/setup-firebase-secrets.js
 * 
 * 이 스크립트는 .env.local 파일의 환경변수를 Firebase Functions secrets로 설정합니다.
 */

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// .env.local 파일 읽기
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local 파일을 찾을 수 없습니다.');
    console.log('📝 .env.local 파일을 생성하고 다음 환경변수들을 설정해주세요:');
    console.log(`
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
OPENAI_API_KEY=your_openai_key
CHAT_RATE_LIMIT_SALT=your_random_rate_limit_salt
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NODE_ENV=development
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
    `);
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });

  return envVars;
}

// Firebase CLI로 secret 설정
function setFirebaseSecret(key, value) {
  try {
    console.log(`🔐 Setting secret: ${key}`);
    execFileSync('firebase', ['functions:secrets:set', key], {
      input: value,
      stdio: ['pipe', 'inherit', 'inherit']
    });
    console.log(`✅ ${key} 설정 완료`);
  } catch (error) {
    console.error(`❌ ${key} 설정 실패:`, error.message);
  }
}

// 메인 실행 함수
async function main() {
  console.log('🚀 Firebase Functions 환경변수 설정을 시작합니다...\n');

  // Firebase CLI 확인
  try {
    execSync('firebase --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Firebase CLI가 설치되지 않았습니다.');
    console.log('📦 다음 명령어로 설치해주세요: npm install -g firebase-tools');
    process.exit(1);
  }

  // 로그인 확인
  try {
    execSync('firebase projects:list', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Firebase에 로그인되지 않았습니다.');
    console.log('🔐 다음 명령어로 로그인해주세요: firebase login');
    process.exit(1);
  }

  const envVars = loadEnvFile();

  // 환경변수를 Firebase Secret으로 매핑
  const secretMapping = {
    'FIREBASE_API_KEY': envVars['NEXT_PUBLIC_FIREBASE_API_KEY'],
    'FIREBASE_AUTH_DOMAIN': envVars['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'],
    'FIREBASE_PROJECT_ID': envVars['NEXT_PUBLIC_FIREBASE_PROJECT_ID'],
    'FIREBASE_STORAGE_BUCKET': envVars['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'],
    'FIREBASE_MESSAGING_SENDER_ID': envVars['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'],
    'FIREBASE_APP_ID': envVars['NEXT_PUBLIC_FIREBASE_APP_ID'],
    'OPENAI_API_KEY': envVars['OPENAI_API_KEY'],
    'CHAT_RATE_LIMIT_SALT': envVars['CHAT_RATE_LIMIT_SALT'],
    'NEXT_PUBLIC_API_URL': envVars['NEXT_PUBLIC_API_URL'],
    'NODE_ENV': envVars['NODE_ENV'],
    'NEXT_PUBLIC_USE_FIREBASE_EMULATOR': envVars['NEXT_PUBLIC_USE_FIREBASE_EMULATOR']
  };

  // 각 secret 설정
  for (const [secretKey, value] of Object.entries(secretMapping)) {
    if (value) {
      setFirebaseSecret(secretKey, value);
    } else {
      console.warn(`⚠️  ${secretKey}에 해당하는 환경변수 값이 없습니다.`);
    }
  }

  console.log('\n🎉 Firebase Functions 환경변수 설정이 완료되었습니다!');
  console.log('📝 다음 단계:');
  console.log('   1. cd functions');
  console.log('   2. npm run build');
  console.log('   3. firebase deploy --only functions');
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { loadEnvFile, setFirebaseSecret };
