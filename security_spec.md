# Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. All Firestore reads and writes require verified Firebase Authentication (`request.auth != null && request.auth.token.email_verified == true`).
2. `rooms/{roomId}` enforces a strict maximum of 2 members (`memberUids.size() <= 2`). Only members in `memberUids` can read the room or any subcollection (`presence`, `liveState`, `photos`).
3. Joining an existing room requires providing the exact `joinCodeHash` (SHA-256 hex) and only allows adding `request.auth.uid` when `memberUids.size() < 2`.
4. All subcollections enforce the Master Gate (`isRoomMember(roomId)`) via `get()` on the parent room document.
5. `ownerUid` and `createdAt` on `rooms/{roomId}` are immutable after creation.
6. All `createdAt` and `updatedAt` timestamps must strictly equal `request.time`.
7. All document IDs (`roomId`, `roleId`, `stateId`, `photoId`) match strict length and regex allowlists (`^[a-zA-Z0-9_\\-]+$`).

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/rooms/habibi-room`.
2. Unverified email user creating `/rooms/habibi-room`.
3. Creating `/rooms/habibi-room` with `ownerUid` set to another user's UID.
4. Creating `/rooms/habibi-room` with `memberUids` containing 3 UIDs (`size > 2`).
5. Creating `/rooms/habibi-room` with a shadow field `isAdmin: true`.
6. Joining `/rooms/habibi-room` with an invalid `joinCodeHash`.
7. Joining `/rooms/habibi-room` when `memberUids` already has 2 members.
8. Non-member reading `/rooms/habibi-room/liveState/wheel`.
9. Updating `/rooms/habibi-room` to mutate `ownerUid` or `createdAt`.
10. Writing `/rooms/habibi-room/presence/admin` (invalid `roleId` outside `male`/`female`).
11. Writing `/rooms/habibi-room/liveState/wheel` with client-forged `updatedAt` != `request.time`.
12. Deleting `/rooms/habibi-room/photos/p1` by a user who is not a room member.
