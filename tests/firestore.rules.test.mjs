import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
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

async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

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

describe('SNS and friend-sharing data are disabled for the MVP', () => {
  const deniedPaths = [
    'profiles/alice', 'posts/post-1', 'posts/post-1/comments/comment-1',
    'posts/post-1/likes/alice', 'friendRequests/alice_bob',
    'users/alice/blocks/bob', 'sharedRooms/share-1',
    'users/alice/sharedRooms/share-1', 'users/alice/hiddenSharedRooms/share-1',
    'users/alice/receivedSharedRooms/share-1', 'sharedShopping/alice_bob'
  ];

  for (const path of deniedPaths) {
    it(`denies unauthenticated reads and writes to ${path}`, async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      const target = doc(db, path);
      await assertFails(getDoc(target));
      await assertFails(setDoc(target, { disabledMvpProbe: true }));
    });
    it(`denies authenticated reads and writes to ${path}`, async () => {
      const db = testEnv.authenticatedContext('alice').firestore();
      const target = doc(db, path);
      await assertFails(getDoc(target));
      await assertFails(setDoc(target, { disabledMvpProbe: true }));
    });
  }
});


describe('SNS features not yet implemented remain denied', () => {
  const deniedPaths = [
    'users/alice/following/bob',
    'reports/report-1',
    'users/alice/reportUsage/2026-11-07',
    'users/alice/aiUsage/2026-11-07',
    'users/alice/timelineUsage/2026-11-07'
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

describe('private shopping cloud sync path', () => {
  it('allows the signed-in owner to read and write their own shopping data', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    const shoppingData = doc(db, 'users/alice/kokoro/shopping');
    await assertSucceeds(setDoc(shoppingData, { items: ['milk'] }));
    const snapshot = await assertSucceeds(getDoc(shoppingData));
    assert.deepEqual(snapshot.data().items, ['milk']);
  });

  it('denies another signed-in user access to the owner shopping data', async () => {
    const db = testEnv.authenticatedContext('bob').firestore();
    const shoppingData = doc(db, 'users/alice/kokoro/shopping');
    await assertFails(getDoc(shoppingData));
    await assertFails(setDoc(shoppingData, { items: ['spoofed'] }));
  });

  it('denies unauthenticated access to shopping data', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const shoppingData = doc(db, 'users/alice/kokoro/shopping');
    await assertFails(getDoc(shoppingData));
    await assertFails(setDoc(shoppingData, { items: ['anonymous'] }));
  });

  it('denies the owner from creating unapproved private room documents', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    for (const documentId of ['privateNotes', 'admin', 'profile']) {
      const unexpected = doc(db, `users/alice/kokoro/${documentId}`);
      await assertFails(getDoc(unexpected));
      await assertFails(setDoc(unexpected, { shouldNotExist: true }));
    }
  });
});
