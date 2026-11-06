import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';

const projectId = 'demo-kokoro-family-rules';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8')
    }
  });
});

after(async () => {
  await testEnv?.cleanup();
});

describe('existing private room data', () => {
  it('denies unauthenticated reads and writes', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const roomData = doc(db, 'users/alice/kokoro/data');

    await assertFails(getDoc(roomData));
    await assertFails(setDoc(roomData, { value: 'unauthenticated' }));
  });

  it('allows the signed-in owner to read and write their own data', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    const roomData = doc(db, 'users/alice/kokoro/data');

    await assertSucceeds(setDoc(roomData, { value: 'owner-data' }));
    const snapshot = await assertSucceeds(getDoc(roomData));
    assert.equal(snapshot.data().value, 'owner-data');
  });

  it('denies another signed-in user from reading or writing the owner data', async () => {
    const db = testEnv.authenticatedContext('bob').firestore();
    const roomData = doc(db, 'users/alice/kokoro/data');

    await assertFails(getDoc(roomData));
    await assertFails(setDoc(roomData, { value: 'spoofed-write' }));
  });
});

describe('SNS collections remain denied until their rules are reviewed', () => {
  const deniedPaths = [
    'profiles/alice',
    'posts/post-1',
    'posts/post-1/comments/comment-1',
    'posts/post-1/likes/alice',
    'users/alice/following/bob',
    'users/alice/blocks/bob',
    'friendRequests/request-1',
    'reports/report-1'
  ];

  for (const path of deniedPaths) {
    it(`denies unauthenticated access to ${path}`, async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const target = doc(db, path);

      await assertFails(getDoc(target));
      await assertFails(setDoc(target, { probe: true }));
    });

    it(`denies authenticated access to ${path}`, async () => {
      const db = testEnv.authenticatedContext('alice').firestore();
      const target = doc(db, path);

      await assertFails(getDoc(target));
      await assertFails(setDoc(target, { probe: true }));
    });
  }
});
