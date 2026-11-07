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
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
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

describe('profiles', () => {
  it('allows a user to create and read their own private profile', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    const profile = doc(db, 'profiles/alice');
    await assertSucceeds(setDoc(profile, {
      nickname: 'Alice',
      avatarId: 'avatar-01',
      visibility: 'private',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    await assertSucceeds(getDoc(profile));
  });

  it('allows another signed-in user to read an explicitly public profile', async () => {
    await seed('profiles/alice', {
      nickname: 'Alice',
      avatarId: 'avatar-01',
      visibility: 'public',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const db = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(db, 'profiles/alice')));
  });

  it('denies another user from reading a private profile or changing any profile', async () => {
    await seed('profiles/alice', {
      nickname: 'Alice',
      avatarId: 'avatar-01',
      visibility: 'private',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const db = testEnv.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(db, 'profiles/alice')));
    await assertFails(setDoc(doc(db, 'profiles/alice'), {
      nickname: 'Imposter',
      avatarId: 'avatar-02',
      visibility: 'public',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });

  it('rejects UID spoofing and sensitive or unapproved profile fields', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'profiles/bob'), {
      nickname: 'Alice',
      avatarId: 'avatar-01',
      visibility: 'public',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(db, 'profiles/alice'), {
      nickname: 'Alice',
      avatarId: 'avatar-01',
      visibility: 'public',
      email: 'private@example.invalid',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  });
});

describe('posts', () => {
  it('allows the author to create a public post and another user to read it', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'posts/post-public'), {
      authorUid: 'alice',
      text: 'Hello family',
      visibility: 'public',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(bob, 'posts/post-public')));
  });

  it('keeps private posts readable only by their author', async () => {
    await seed('posts/post-private', {
      authorUid: 'alice',
      text: 'Private note',
      visibility: 'private',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const bob = testEnv.authenticatedContext('bob').firestore();
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(bob, 'posts/post-private')));
    await assertSucceeds(getDoc(doc(alice, 'posts/post-private')));
  });

  it('rejects author spoofing, overlong text, and unapproved fields', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    const base = {
      text: 'A post',
      visibility: 'public',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await assertFails(setDoc(doc(db, 'posts/spoofed'), { ...base, authorUid: 'bob' }));
    await assertFails(setDoc(doc(db, 'posts/too-long'), {
      ...base, authorUid: 'alice', text: 'x'.repeat(501)
    }));
    await assertFails(setDoc(doc(db, 'posts/extra-field'), {
      ...base, authorUid: 'alice', email: 'private@example.invalid'
    }));
  });

  it('hides deleted posts from other users', async () => {
    await seed('posts/post-deleted', {
      authorUid: 'alice',
      text: 'Removed',
      visibility: 'public',
      status: 'deleted',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'posts/post-deleted')));
  });

  it('allows only the author to soft-delete their post', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    const postRef = doc(alice, 'posts/post-soft-delete');
    await assertSucceeds(setDoc(postRef, {
      authorUid: 'alice',
      text: 'A post to remove',
      visibility: 'public',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(updateDoc(doc(bob, 'posts/post-soft-delete'), {
      status: 'deleted',
      updatedAt: serverTimestamp()
    }));

    await assertSucceeds(updateDoc(postRef, {
      status: 'deleted',
      updatedAt: serverTimestamp()
    }));
    await assertFails(getDoc(doc(bob, 'posts/post-soft-delete')));
    await assertSucceeds(getDoc(postRef));
  });

  it('allows only the author to edit post text', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    const postRef = doc(alice, 'posts/post-edit');
    await assertSucceeds(setDoc(postRef, {
      authorUid: 'alice',
      text: 'Original text',
      visibility: 'private',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(updateDoc(doc(bob, 'posts/post-edit'), {
      text: 'Changed by another user',
      updatedAt: serverTimestamp()
    }));

    await assertSucceeds(updateDoc(postRef, {
      text: 'Edited by author',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(postRef, {
      authorUid: 'bob',
      updatedAt: serverTimestamp()
    }));
    const saved = await getDoc(postRef);
    assert.equal(saved.data().text, 'Edited by author');
  });

  it('allows an author-scoped query and denies a global public timeline query for now', async () => {
    await seed('posts/post-for-feed', {
      authorUid: 'alice',
      text: 'Feed post',
      visibility: 'public',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const alice = testEnv.authenticatedContext('alice').firestore();
    const ownPosts = query(collection(alice, 'posts'), where('authorUid', '==', 'alice'));
    await assertSucceeds(getDocs(ownPosts));

    const bob = testEnv.authenticatedContext('bob').firestore();
    const globalFeed = query(
      collection(bob, 'posts'),
      where('visibility', '==', 'public'),
      where('status', '==', 'active')
    );
    await assertFails(getDocs(globalFeed));
  });

  it('denies public post reads when either user has blocked the other', async () => {
    await seed('posts/post-blocked', {
      authorUid: 'alice',
      text: 'Blocked',
      visibility: 'public',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await seed('users/bob/blocks/alice', { createdAt: new Date() });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'posts/post-blocked')));
  });

  it('denies unauthenticated post reads', async () => {
    await seed('posts/post-public-unauth', {
      authorUid: 'alice',
      text: 'Public but signed-in only',
      visibility: 'public',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guest, 'posts/post-public-unauth')));
  });
});

describe('blocks', () => {
  it('allows a user to block another user and read their own block list', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/alice/blocks/bob'), {
      createdAt: serverTimestamp()
    }));
    await assertSucceeds(getDoc(doc(db, 'users/alice/blocks/bob')));
    await assertSucceeds(getDocs(collection(db, 'users/alice/blocks')));
  });

  it('denies self-blocking, spoofed block records, and access to another user block list', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'users/alice/blocks/alice'), {
      createdAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(alice, 'users/bob/blocks/charlie'), {
      createdAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(alice, 'users/alice/blocks/bob'), {
      createdAt: serverTimestamp(),
      note: 'extra data'
    }));
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'users/alice/blocks/bob')));
    await assertFails(getDocs(collection(bob, 'users/alice/blocks')));
  });

  it('allows the owner to unblock and prevents others from removing a block', async () => {
    await seed('users/alice/blocks/bob', { createdAt: new Date() });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(updateDoc(doc(bob, 'users/alice/blocks/bob'), {
      createdAt: serverTimestamp()
    }));
    await assertFails((async () => {
      const { deleteDoc } = await import('firebase/firestore');
      return deleteDoc(doc(bob, 'users/alice/blocks/bob'));
    })());
    const alice = testEnv.authenticatedContext('alice').firestore();
    const { deleteDoc } = await import('firebase/firestore');
    await assertSucceeds(deleteDoc(doc(alice, 'users/alice/blocks/bob')));
  });
});

describe('SNS features not yet implemented remain denied', () => {
  const deniedPaths = [
    'posts/post-1/comments/comment-1',
    'posts/post-1/likes/alice',
    'users/alice/following/bob',
    'friendRequests/request-1',
    'reports/report-1',
    'users/alice/reportUsage/2026-11-07'
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
