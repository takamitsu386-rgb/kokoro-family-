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



describe('comments', () => {
  async function seedPublicPost(postId = 'comment-parent') {
    await seed(`posts/${postId}`, {
      authorUid: 'alice',
      text: 'Parent post',
      visibility: 'public',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  it('allows a signed-in viewer to comment on a readable active public post', async () => {
    await seedPublicPost();
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(setDoc(doc(bob, 'posts/comment-parent/comments/bob-comment'), {
      authorUid: 'bob',
      text: 'Nice post',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    await assertSucceeds(getDoc(doc(bob, 'posts/comment-parent/comments/bob-comment')));
  });

  it('rejects unauthenticated comments, UID spoofing, extra fields, and text over 300 chars', async () => {
    await seedPublicPost('comment-validation');
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(guest, 'posts/comment-validation/comments/guest'), {
      authorUid: 'guest', text: 'Hi', status: 'active',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    const bob = testEnv.authenticatedContext('bob').firestore();
    const base = { text: 'Hi', status: 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertFails(setDoc(doc(bob, 'posts/comment-validation/comments/spoof'), { ...base, authorUid: 'alice' }));
    await assertFails(setDoc(doc(bob, 'posts/comment-validation/comments/long'), {
      ...base, authorUid: 'bob', text: 'x'.repeat(301)
    }));
    await assertFails(setDoc(doc(bob, 'posts/comment-validation/comments/extra'), {
      ...base, authorUid: 'bob', email: 'private@example.invalid'
    }));
  });

  it('denies comments on private, deleted, or blocked posts', async () => {
    await seed('posts/private-comment-parent', {
      authorUid: 'alice', text: 'Private', visibility: 'private', status: 'active',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('posts/deleted-comment-parent', {
      authorUid: 'alice', text: 'Deleted', visibility: 'public', status: 'deleted',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seedPublicPost('blocked-comment-parent');
    await seed('users/bob/blocks/alice', { createdAt: new Date() });
    const bob = testEnv.authenticatedContext('bob').firestore();
    for (const postId of ['private-comment-parent', 'deleted-comment-parent', 'blocked-comment-parent']) {
      await assertFails(setDoc(doc(bob, `posts/${postId}/comments/bob-comment`), {
        authorUid: 'bob', text: 'Hi', status: 'active',
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      }));
    }
  });

  it('allows the comment author or post author to soft-delete, but not another user', async () => {
    await seedPublicPost('comment-delete-parent');
    await seed('posts/comment-delete-parent/comments/bob-comment', {
      authorUid: 'bob', text: 'Remove me', status: 'active',
      createdAt: new Date(), updatedAt: new Date()
    });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(updateDoc(doc(carol, 'posts/comment-delete-parent/comments/bob-comment'), {
      authorUid: 'bob', text: 'Remove me', status: 'deleted', updatedAt: serverTimestamp()
    }));
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(updateDoc(doc(bob, 'posts/comment-delete-parent/comments/bob-comment'), {
      authorUid: 'bob', text: 'Remove me', status: 'deleted', updatedAt: serverTimestamp()
    }));
  });
});

describe('likes', () => {
  it('allows one UID-keyed like on a readable active public post', async () => {
    await seed('posts/like-parent', {
      authorUid: 'alice', text: 'Likeable', visibility: 'public', status: 'active',
      createdAt: new Date(), updatedAt: new Date()
    });
    const bob = testEnv.authenticatedContext('bob').firestore();
    const like = doc(bob, 'posts/like-parent/likes/bob');
    await assertSucceeds(setDoc(like, { createdAt: serverTimestamp() }));
    await assertSucceeds(getDoc(like));
    await assertFails(setDoc(doc(bob, 'posts/like-parent/likes/bob'), { createdAt: serverTimestamp(), extra: true }));
    await assertFails(setDoc(doc(bob, 'posts/like-parent/likes/alice'), { createdAt: serverTimestamp() }));
  });

  it('denies likes on private, deleted, or blocked posts and unauthenticated likes', async () => {
    await seed('posts/private-like-parent', {
      authorUid: 'alice', text: 'Private', visibility: 'private', status: 'active',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('posts/deleted-like-parent', {
      authorUid: 'alice', text: 'Deleted', visibility: 'public', status: 'deleted',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('posts/blocked-like-parent', {
      authorUid: 'alice', text: 'Blocked', visibility: 'public', status: 'active',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('users/bob/blocks/alice', { createdAt: new Date() });
    const bob = testEnv.authenticatedContext('bob').firestore();
    const guest = testEnv.unauthenticatedContext().firestore();
    for (const postId of ['private-like-parent', 'deleted-like-parent', 'blocked-like-parent']) {
      await assertFails(setDoc(doc(bob, `posts/${postId}/likes/bob`), { createdAt: serverTimestamp() }));
    }
    await assertFails(setDoc(doc(guest, 'posts/blocked-like-parent/likes/guest'), { createdAt: serverTimestamp() }));
  });

  it('allows a user to remove their own like but not another user\'s like', async () => {
    await seed('posts/like-delete-parent', {
      authorUid: 'alice', text: 'Likeable', visibility: 'public', status: 'active',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('posts/like-delete-parent/likes/bob', { createdAt: new Date() });
    const carol = testEnv.authenticatedContext('carol').firestore();
    await assertFails(deleteDoc(doc(carol, 'posts/like-delete-parent/likes/bob')));
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(deleteDoc(doc(bob, 'posts/like-delete-parent/likes/bob')));
  });
});

describe('SNS features not yet implemented remain denied', () => {
  const deniedPaths = [
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
