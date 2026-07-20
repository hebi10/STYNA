/**
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

const projectId = 'demo-hebimall-rules-test';
const firestoreRules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
const storageRules = readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8');
const fixedTime = Timestamp.fromDate(new Date('2026-07-20T00:00:00.000Z'));
const onePixelPng = new Uint8Array([137, 80, 78, 71]);

let testEnv: RulesTestEnvironment;

function userData(userId: string, status = 'active', role = 'user') {
  return {
    id: userId,
    email: `${userId}@example.com`,
    name: `${userId} name`,
    status,
    role,
    createdAt: fixedTime,
    updatedAt: fixedTime,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users', 'admin-1'), userData('admin-1', 'active', 'admin')),
      setDoc(doc(db, 'users', 'admin-role-token'), userData('admin-role-token', 'active', 'admin')),
      setDoc(doc(db, 'users', 'claim-only'), userData('claim-only')),
      setDoc(doc(db, 'users', 'role-only'), userData('role-only', 'active', 'admin')),
      setDoc(doc(db, 'users', 'inactive-admin'), userData('inactive-admin', 'inactive', 'admin')),
      setDoc(doc(db, 'users', 'user-1'), userData('user-1')),
    ]);
    await uploadBytes(
      ref(context.storage(), 'images/products/product-1/public.png'),
      onePixelPng,
      { contentType: 'image/png' }
    );
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Storage rules', () => {
  test('preserves public image reads', async () => {
    const publicStorage = testEnv.unauthenticatedContext().storage();

    await assertSucceeds(getBytes(ref(publicStorage, 'images/products/product-1/public.png')));
  });

  test('allows an active strict admin to upload images', async () => {
    const adminStorage = testEnv.authenticatedContext('admin-1', { admin: true }).storage();
    const roleTokenStorage = testEnv
      .authenticatedContext('admin-role-token', { role: 'admin' })
      .storage();

    await assertSucceeds(uploadBytes(
      ref(adminStorage, 'images/products/product-1/admin.png'),
      onePixelPng,
      { contentType: 'image/png' }
    ));
    await assertSucceeds(uploadBytes(
      ref(roleTokenStorage, 'categories/admin-role-token.webp'),
      onePixelPng,
      { contentType: 'image/webp' }
    ));
  });

  test('allows an active strict admin to delete an existing image', async () => {
    const adminStorage = testEnv.authenticatedContext('admin-1', { admin: true }).storage();

    await assertSucceeds(deleteObject(
      ref(adminStorage, 'images/products/product-1/public.png')
    ));
  });

  test('denies image deletion by an active non-admin', async () => {
    const userStorage = testEnv.authenticatedContext('user-1').storage();

    await assertFails(deleteObject(
      ref(userStorage, 'images/products/product-1/public.png')
    ));
  });

  test('supports strict-admin upload and public read for nested editorial event images', async () => {
    const adminStorage = testEnv.authenticatedContext('admin-1', { admin: true }).storage();
    const publicStorage = testEnv.unauthenticatedContext().storage();
    const editorialPath = 'events/editorial/benefit/editorial.png';

    await assertSucceeds(uploadBytes(
      ref(adminStorage, editorialPath),
      onePixelPng,
      { contentType: 'image/png' }
    ));
    await assertSucceeds(getBytes(ref(publicStorage, editorialPath)));
  });

  test.each([
    ['active non-admin', 'user-1', {}],
    ['claim-only', 'claim-only', { admin: true }],
    ['role-only', 'role-only', {}],
    ['inactive admin', 'inactive-admin', { admin: true }],
    ['missing admin document', 'missing-admin', { admin: true }],
  ])('denies uploads from %s', async (_caseName, userId, claims) => {
    const storage = testEnv.authenticatedContext(userId, claims).storage();

    await assertFails(uploadBytes(
      ref(storage, `events/banners/${userId}.png`),
      onePixelPng,
      { contentType: 'image/png' }
    ));
  });

  test('denies invalid MIME and files at or above the 5 MiB limit', async () => {
    const adminStorage = testEnv.authenticatedContext('admin-1', { admin: true }).storage();

    await assertFails(uploadBytes(
      ref(adminStorage, 'images/products/product-1/not-image.txt'),
      onePixelPng,
      { contentType: 'text/plain' }
    ));
    await assertFails(uploadBytes(
      ref(adminStorage, 'images/products/product-1/too-large.png'),
      new Uint8Array(5 * 1024 * 1024),
      { contentType: 'image/png' }
    ));
  }, 30_000);
});
