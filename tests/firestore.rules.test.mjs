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
    for (const avatarId of ['avatar-01', 'avatar-02', 'avatar-03', 'avatar-04', 'avatar-05']) {
      await assertSucceeds(updateDoc(profile, {
        avatarId,
        updatedAt: serverTimestamp()
      }));
    }
    await assertSucceeds(getDoc(profile));
  });

  it('denies unauthenticated access and physical deletion of profiles', async () => {
    await seed('profiles/locked-profile', {
      nickname: 'Locked', avatarId: 'avatar-01', visibility: 'public',
      createdAt: new Date(), updatedAt: new Date()
    });
    const guest = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(guest, 'profiles/locked-profile')));
    await assertFails(setDoc(doc(guest, 'profiles/guest-profile'), {
      nickname: 'Guest', avatarId: 'avatar-01', visibility: 'public',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));

    const owner = testEnv.authenticatedContext('locked-profile').firestore();
    await assertFails(deleteDoc(doc(owner, 'profiles/locked-profile')));
    const saved = await getDoc(doc(owner, 'profiles/locked-profile'));
    assert.equal(saved.data().nickname, 'Locked');
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

  it('denies public profile reads in both directions when either user has blocked the other', async () => {
    await seed('profiles/profile-owner', {
      nickname: 'Owner', avatarId: 'avatar-01', visibility: 'public',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('profiles/profile-viewer', {
      nickname: 'Viewer', avatarId: 'avatar-02', visibility: 'public',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('users/profile-owner/blocks/profile-viewer', { createdAt: new Date() });
    const owner = testEnv.authenticatedContext('profile-owner').firestore();
    const viewer = testEnv.authenticatedContext('profile-viewer').firestore();
    await assertFails(getDoc(doc(owner, 'profiles/profile-viewer')));
    await assertFails(getDoc(doc(viewer, 'profiles/profile-owner')));
    await assertSucceeds(getDoc(doc(owner, 'profiles/profile-owner')));
    await assertSucceeds(getDoc(doc(viewer, 'profiles/profile-viewer')));
  });

  it('denies public profile reads when only the viewer has blocked the profile owner', async () => {
    await seed('profiles/owner-blocked-by-viewer', {
      nickname: 'Owner', avatarId: 'avatar-01', visibility: 'public',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('profiles/viewer-who-blocked', {
      nickname: 'Viewer', avatarId: 'avatar-02', visibility: 'public',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('users/viewer-who-blocked/blocks/owner-blocked-by-viewer', {
      createdAt: new Date()
    });
    const viewer = testEnv.authenticatedContext('viewer-who-blocked').firestore();
    const owner = testEnv.authenticatedContext('owner-blocked-by-viewer').firestore();
    await assertFails(getDoc(doc(viewer, 'profiles/owner-blocked-by-viewer')));
    await assertFails(getDoc(doc(owner, 'profiles/viewer-who-blocked')));
    await assertSucceeds(getDoc(doc(viewer, 'profiles/viewer-who-blocked')));
    await assertSucceeds(getDoc(doc(owner, 'profiles/owner-blocked-by-viewer')));
  });

  it('rejects invalid profile lengths, avatar values, and changes to creation time', async () => {
    const db = testEnv.authenticatedContext('profile-validation-owner').firestore();
    const profile = doc(db, 'profiles/profile-validation-owner');
    await assertSucceeds(setDoc(profile, {
      nickname: 'Valid name',
      avatarId: 'avatar-01',
      visibility: 'private',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    await assertFails(updateDoc(profile, {
      nickname: '',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(profile, {
      nickname: '   ',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(profile, {
      nickname: 'x'.repeat(25),
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(profile, {
      avatarId: 'x'.repeat(33),
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(profile, {
      avatarId: 'avatar-99',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(profile, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(profile, {
      email: 'private@example.invalid',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(profile, {
      visibility: 'everyone',
      updatedAt: serverTimestamp()
    }));
    const saved = await getDoc(profile);
    assert.equal(saved.data().nickname, 'Valid name');
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

  it('rejects empty posts and invalid visibility, status, or timestamps at creation', async () => {
    const db = testEnv.authenticatedContext('post-create-validation').firestore();
    const base = {
      authorUid: 'post-create-validation',
      text: 'A valid post',
      visibility: 'private',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await assertFails(setDoc(doc(db, 'posts/empty-content'), { ...base, text: '' }));
    await assertFails(setDoc(doc(db, 'posts/whitespace-content'), { ...base, text: '   ' }));
    await assertFails(setDoc(doc(db, 'posts/invalid-visibility'), { ...base, visibility: 'everyone' }));
    await assertFails(setDoc(doc(db, 'posts/invalid-status'), { ...base, status: 'published' }));
    await assertFails(setDoc(doc(db, 'posts/forged-created-at'), {
      ...base,
      createdAt: new Date('2020-01-01T00:00:00.000Z')
    }));
    await assertSucceeds(setDoc(doc(db, 'posts/valid-create'), base));
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

  it('prevents editing or restoring a deleted post', async () => {
    await seed('posts/post-already-deleted', {
      authorUid: 'deleted-author',
      text: 'Previously removed',
      visibility: 'public',
      status: 'deleted',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const author = testEnv.authenticatedContext('deleted-author').firestore();
    const postRef = doc(author, 'posts/post-already-deleted');
    await assertFails(updateDoc(postRef, {
      text: 'Edited after deletion',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(postRef, {
      status: 'active',
      updatedAt: serverTimestamp()
    }));
    await assertFails(deleteDoc(postRef));
    const saved = await getDoc(postRef);
    assert.equal(saved.data().status, 'deleted');
    assert.equal(saved.data().text, 'Previously removed');
  });

  it('rejects invalid post edits and preserves the original post', async () => {
    const db = testEnv.authenticatedContext('post-validation-owner').firestore();
    const postRef = doc(db, 'posts/post-validation');
    await assertSucceeds(setDoc(postRef, {
      authorUid: 'post-validation-owner',
      text: 'Original safe text',
      visibility: 'private',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    await assertFails(updateDoc(postRef, {
      text: '',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(postRef, {
      text: 'x'.repeat(501),
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(postRef, {
      status: 'published',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(postRef, {
      visibility: 'everyone',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(postRef, {
      email: 'private@example.invalid',
      updatedAt: serverTimestamp()
    }));
    const saved = await getDoc(postRef);
    assert.equal(saved.data().text, 'Original safe text');
    assert.equal(saved.data().status, 'active');
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
    await assertFails(updateDoc(postRef, {
      visibility: 'public',
      updatedAt: serverTimestamp()
    }));
    await assertFails(updateDoc(postRef, {
      createdAt: serverTimestamp(),
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

  it('denies public post reads in both directions when either user has blocked the other', async () => {
    await seed('posts/post-owner-public', {
      authorUid: 'post-owner', text: 'Owner post', visibility: 'public',
      status: 'active', createdAt: new Date(), updatedAt: new Date()
    });
    await seed('posts/post-viewer-public', {
      authorUid: 'post-viewer', text: 'Viewer post', visibility: 'public',
      status: 'active', createdAt: new Date(), updatedAt: new Date()
    });
    await seed('users/post-owner/blocks/post-viewer', { createdAt: new Date() });
    const owner = testEnv.authenticatedContext('post-owner').firestore();
    const viewer = testEnv.authenticatedContext('post-viewer').firestore();
    await assertFails(getDoc(doc(owner, 'posts/post-viewer-public')));
    await assertFails(getDoc(doc(viewer, 'posts/post-owner-public')));
    await assertSucceeds(getDoc(doc(owner, 'posts/post-owner-public')));
    await assertSucceeds(getDoc(doc(viewer, 'posts/post-viewer-public')));
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
  it('denies public post reads when either the author or viewer has blocked the other', async () => {
    await seed('posts/post-blocked-by-author', {
      authorUid: 'post-author', text: 'Hidden after block', visibility: 'public',
      status: 'active', createdAt: new Date(), updatedAt: new Date()
    });
    await seed('users/post-author/blocks/post-viewer', { createdAt: new Date() });
    const author = testEnv.authenticatedContext('post-author').firestore();
    const viewer = testEnv.authenticatedContext('post-viewer').firestore();
    await assertSucceeds(getDoc(doc(author, 'posts/post-blocked-by-author')));
    await assertFails(getDoc(doc(viewer, 'posts/post-blocked-by-author')));

    await seed('posts/post-blocked-by-viewer', {
      authorUid: 'another-post-author', text: 'Hidden by viewer block', visibility: 'public',
      status: 'active', createdAt: new Date(), updatedAt: new Date()
    });
    await seed('users/post-viewer-2/blocks/another-post-author', { createdAt: new Date() });
    const viewerWhoBlocked = testEnv.authenticatedContext('post-viewer-2').firestore();
    await assertFails(getDoc(doc(viewerWhoBlocked, 'posts/post-blocked-by-viewer')));
  });

});

describe('blocks', () => {
  it('allows a user to block another user and read their own block list', async () => {
    const db = testEnv.authenticatedContext('block-owner').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/block-owner/blocks/block-target'), {
      createdAt: serverTimestamp()
    }));
    const blockOwnerDb = testEnv.authenticatedContext('block-owner').firestore();
    await assertSucceeds(getDoc(doc(blockOwnerDb, 'users/block-owner/blocks/block-target')));
    await assertSucceeds(getDocs(collection(blockOwnerDb, 'users/block-owner/blocks')));
  });

  it('requires a server timestamp when creating a block record', async () => {
    const db = testEnv.authenticatedContext('timestamp-block-owner').firestore();
    await assertFails(setDoc(doc(db, 'users/timestamp-block-owner/blocks/target'), {
      createdAt: new Date('2020-01-01T00:00:00.000Z')
    }));
    await assertSucceeds(setDoc(doc(db, 'users/timestamp-block-owner/blocks/target'), {
      createdAt: serverTimestamp()
    }));
  });

  it('denies self-blocking, spoofed block records, and access to another user block list', async () => {
    const alice = testEnv.authenticatedContext('block-owner-2').firestore();
    await assertFails(setDoc(doc(alice, 'users/block-owner-2/blocks/block-owner-2'), {
      createdAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(alice, 'users/other-owner/blocks/stranger'), {
      createdAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(alice, 'users/block-owner-2/blocks/block-target-2'), {
      createdAt: serverTimestamp(),
      note: 'extra data'
    }));
    const bob = testEnv.authenticatedContext('block-target-2').firestore();
    await assertFails(getDoc(doc(bob, 'users/block-owner-2/blocks/block-target-2')));
    await assertFails(getDocs(collection(bob, 'users/block-owner-2/blocks')));
  });

  it('allows the owner to unblock and prevents others from removing a block', async () => {
    await seed('users/unblock-owner/blocks/unblock-target', { createdAt: new Date() });
    const bob = testEnv.authenticatedContext('unblock-target').firestore();
    await assertFails(updateDoc(doc(bob, 'users/unblock-owner/blocks/unblock-target'), {
      createdAt: serverTimestamp()
    }));
    await assertFails((async () => {
      const { deleteDoc } = await import('firebase/firestore');
      return deleteDoc(doc(bob, 'users/unblock-owner/blocks/unblock-target'));
    })());
    const alice = testEnv.authenticatedContext('unblock-owner').firestore();
    const { deleteDoc } = await import('firebase/firestore');
    await assertSucceeds(deleteDoc(doc(alice, 'users/unblock-owner/blocks/unblock-target')));
  });
  it('applies a newly created block immediately and restores public access after unblocking', async () => {
    await seed('profiles/block-target-profile', {
      nickname: 'Target', avatarId: 'avatar-01', visibility: 'public',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('posts/block-target-post', {
      authorUid: 'block-target-profile', text: 'Public post', visibility: 'public',
      status: 'active', createdAt: new Date(), updatedAt: new Date()
    });

    const viewer = testEnv.authenticatedContext('block-viewer').firestore();
    const targetProfile = doc(viewer, 'profiles/block-target-profile');
    const targetPost = doc(viewer, 'posts/block-target-post');
    const blockRecord = doc(viewer, 'users/block-viewer/blocks/block-target-profile');

    await assertSucceeds(getDoc(targetProfile));
    await assertSucceeds(getDoc(targetPost));
    await assertSucceeds(setDoc(blockRecord, { createdAt: serverTimestamp() }));
    await assertFails(getDoc(targetProfile));
    await assertFails(getDoc(targetPost));
    await assertSucceeds(deleteDoc(blockRecord));
    await assertSucceeds(getDoc(targetProfile));
    await assertSucceeds(getDoc(targetPost));
  });

});

describe('comments and likes', () => {
  before(async () => {
    await seed('profiles/interaction-author', {
      nickname: 'Author', avatarId: 'avatar-01', visibility: 'public',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('posts/interaction-post', {
      authorUid: 'interaction-author', text: 'Public post', visibility: 'public',
      status: 'active', createdAt: new Date(), updatedAt: new Date()
    });
  });

  it('allows a signed-in user to like and unlike a public post only once under their UID', async () => {
    const db = testEnv.authenticatedContext('interaction-viewer').firestore();
    const like = doc(db, 'posts/interaction-post/likes/interaction-viewer');
    await assertSucceeds(setDoc(like, { createdAt: serverTimestamp() }));
    await assertSucceeds(getDoc(like));
    await assertSucceeds(deleteDoc(like));
    await assertFails(setDoc(doc(db, 'posts/interaction-post/likes/someone-else'), {
      createdAt: serverTimestamp()
    }));
    await assertFails(setDoc(like, { createdAt: serverTimestamp(), note: 'extra' }));
  });

  it('allows valid comments and lets only the commenter or post author delete them', async () => {
    const alice = testEnv.authenticatedContext('commenter').firestore();
    const comment = doc(alice, 'posts/interaction-post/comments/comment-1');
    await assertSucceeds(setDoc(comment, {
      authorUid: 'commenter', text: 'すてきですね', status: 'active',
      createdAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(alice, 'posts/interaction-post/comments/comment-spoof'), {
      authorUid: 'other-user', text: 'なりすまし', status: 'active',
      createdAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(alice, 'posts/interaction-post/comments/comment-long'), {
      authorUid: 'commenter', text: 'x'.repeat(301), status: 'active',
      createdAt: serverTimestamp()
    }));
    const other = testEnv.authenticatedContext('comment-reader').firestore();
    await assertFails(deleteDoc(doc(other, 'posts/interaction-post/comments/comment-1')));
    await assertSucceeds(deleteDoc(comment));
    await assertSucceeds(setDoc(doc(alice, 'posts/interaction-post/comments/comment-by-other'), {
      authorUid: 'commenter', text: '残す', status: 'active', createdAt: serverTimestamp()
    }));
    const postAuthor = testEnv.authenticatedContext('interaction-author').firestore();
    await assertSucceeds(deleteDoc(doc(postAuthor, 'posts/interaction-post/comments/comment-by-other')));
  });

  it('denies comments and likes for private, deleted, hidden-profile, or blocked posts', async () => {
    await seed('posts/interaction-private', {
      authorUid: 'interaction-author', text: 'Private', visibility: 'private',
      status: 'active', createdAt: new Date(), updatedAt: new Date()
    });
    await seed('posts/interaction-deleted', {
      authorUid: 'interaction-author', text: 'Deleted', visibility: 'public',
      status: 'deleted', createdAt: new Date(), updatedAt: new Date()
    });
    await seed('profiles/interaction-private-author', {
      nickname: 'Private', avatarId: 'avatar-01', visibility: 'private',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('posts/interaction-hidden-profile', {
      authorUid: 'interaction-private-author', text: 'Hidden', visibility: 'public',
      status: 'active', createdAt: new Date(), updatedAt: new Date()
    });
    await seed('users/interaction-author/blocks/interaction-viewer-2', { createdAt: new Date() });
    const db = testEnv.authenticatedContext('interaction-viewer-2').firestore();
    for (const postId of ['interaction-private', 'interaction-deleted', 'interaction-hidden-profile', 'interaction-post']) {
      if (postId === 'interaction-post') continue;
      await assertFails(setDoc(doc(db, 'posts', postId, 'likes', 'interaction-viewer-2'), {
        createdAt: serverTimestamp()
      }));
      await assertFails(setDoc(doc(db, 'posts', postId, 'comments', 'comment'), {
        authorUid: 'interaction-viewer-2', text: 'comment', status: 'active',
        createdAt: serverTimestamp()
      }));
    }
    await assertFails(setDoc(doc(db, 'posts/interaction-post/likes/interaction-viewer-2'), {
      createdAt: serverTimestamp()
    }));
  });
});

describe('friend requests', () => {
  before(async () => {
    await seed('profiles/friend-target', {
      nickname: 'Target', avatarId: 'avatar-01', visibility: 'public',
      createdAt: new Date(), updatedAt: new Date()
    });
    await seed('profiles/friend-private-target', {
      nickname: 'Private', avatarId: 'avatar-01', visibility: 'private',
      createdAt: new Date(), updatedAt: new Date()
    });
  });

  it('allows checking a missing request document and only the recipient can accept an existing request', async () => {
    const alice = testEnv.authenticatedContext('friend-sender').firestore();
    await assertSucceeds(getDoc(doc(alice, 'friendRequests/friend-sender_friend-target')));
    const requestRef = doc(alice, 'friendRequests/friend-sender_friend-target');
    await assertSucceeds(setDoc(requestRef, {
      fromUid: 'friend-sender', toUid: 'friend-target', status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await assertSucceeds(getDocs(query(collection(alice, 'friendRequests'), where('fromUid', '==', 'friend-sender'))));
    const recipient = testEnv.authenticatedContext('friend-target').firestore();
    await assertSucceeds(getDoc(doc(recipient, 'friendRequests/friend-sender_friend-target')));
    await assertFails(updateDoc(doc(alice, 'friendRequests/friend-sender_friend-target'), {
      status: 'accepted', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(updateDoc(doc(recipient, 'friendRequests/friend-sender_friend-target'), {
      status: 'accepted', updatedAt: serverTimestamp()
    }));
    await assertSucceeds(getDocs(query(collection(recipient, 'friendRequests'), where('toUid', '==', 'friend-target'))));
    await assertFails(updateDoc(doc(recipient, 'friendRequests/friend-sender_friend-target'), {
      status: 'pending', updatedAt: serverTimestamp()
    }));
  });

  it('rejects requests to private profiles, self, spoofed senders, and duplicate reverse requests', async () => {
    const alice = testEnv.authenticatedContext('friend-sender-2').firestore();
    await assertFails(setDoc(doc(alice, 'friendRequests/friend-sender-2_friend-private-target'), {
      fromUid: 'friend-sender-2', toUid: 'friend-private-target', status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(alice, 'friendRequests/friend-sender-2_friend-sender-2'), {
      fromUid: 'friend-sender-2', toUid: 'friend-sender-2', status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await assertFails(setDoc(doc(alice, 'friendRequests/friend-sender_friend-target'), {
      fromUid: 'someone-else', toUid: 'friend-target', status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
    await seed('friendRequests/friend-target_friend-sender-2', {
      fromUid: 'friend-target', toUid: 'friend-sender-2', status: 'pending',
      createdAt: new Date(), updatedAt: new Date()
    });
    await assertFails(setDoc(doc(alice, 'friendRequests/friend-sender-2_friend-target'), {
      fromUid: 'friend-sender-2', toUid: 'friend-target', status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });

  it('prevents outsiders from reading or deciding requests and lets the sender cancel pending requests', async () => {
    await seed('friendRequests/friend-owner_friend-recipient', {
      fromUid: 'friend-owner', toUid: 'friend-recipient', status: 'pending',
      createdAt: new Date(), updatedAt: new Date()
    });
    const outsider = testEnv.authenticatedContext('friend-outsider').firestore();
    await assertFails(getDoc(doc(outsider, 'friendRequests/friend-owner_friend-recipient')));
    await assertFails(updateDoc(doc(outsider, 'friendRequests/friend-owner_friend-recipient'), {
      status: 'accepted', updatedAt: serverTimestamp()
    }));
    const sender = testEnv.authenticatedContext('friend-owner').firestore();
    await assertSucceeds(deleteDoc(doc(sender, 'friendRequests/friend-owner_friend-recipient')));
  });

  it('blocks requests in either direction and denies requests after a block', async () => {
    await seed('users/friend-blocker/blocks/friend-blocked', { createdAt: new Date() });
    const sender = testEnv.authenticatedContext('friend-blocked').firestore();
    await assertFails(setDoc(doc(sender, 'friendRequests/friend-blocked_friend-blocker'), {
      fromUid: 'friend-blocked', toUid: 'friend-blocker', status: 'pending',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }));
  });
});

describe('SNS features not yet implemented remain denied', () => {
  const deniedPaths = [
    'users/alice/following/bob',
    'reports/report-1',
    'users/alice/reportUsage/2026-11-07',
    'users/alice/aiUsage/2026-11-07'
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
