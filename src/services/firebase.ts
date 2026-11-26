import {initializeApp} from 'firebase/app';
import {
  type Database,
  getDatabase,
  onValue,
  ref as dbRef,
  set as dbSet,
} from 'firebase/database';
import {
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  DEFAULT_ROOM_SETTINGS,
  EncryptedRoomSettings,
  MediaBackgroundConfig,
  PartnerPresenceData,
  PartnerRole,
  PhotosLiveState,
  QuizRoundState,
  ReactionEvent,
  SharedPhotoItem,
  WheelLiveState,
} from '../types/app';
import {computeJoinCodeHash, decryptPayload, encryptPayload} from './crypto';
import {compressImageFile, fileToDataUrl} from './mediaStore';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

const rtdbUrl =
  (firebaseConfig as {databaseURL?: string}).databaseURL ||
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
  '';
export const rtdb: Database | null = rtdbUrl ? getDatabase(app, rtdbUrl) : null;

const DEVICE_UID_KEY = 'nabd_device_uid';

export function getDeviceUid(): string {
  let id = localStorage.getItem(DEVICE_UID_KEY);
  if (!id || !/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
    id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_UID_KEY, id);
  }
  return id;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: getDeviceUid(),
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (client is offline).');
      return false;
    }
    return true;
  }
}

export function sanitizeRoomId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  return cleaned.length >= 3 ? cleaned.slice(0, 64) : 'habibi-room';
}

export async function connectOrCreateRoom(
  rawRoomId: string,
  passcode: string
): Promise<{
  roomId: string;
  settings: EncryptedRoomSettings;
  isNewRoom: boolean;
}> {
  const deviceUid = getDeviceUid();
  const roomId = sanitizeRoomId(rawRoomId);
  const roomPath = `rooms/${roomId}`;
  const roomRef = doc(db, 'rooms', roomId);
  const joinCodeHash = computeJoinCodeHash(roomId, passcode);

  const existingSnap = await getDoc(roomRef).catch((err) => {
    handleFirestoreError(err, OperationType.GET, roomPath);
  });

  if (existingSnap && existingSnap.exists()) {
    const data = existingSnap.data() as {
      encryptedSettings: string;
      joinCodeHash: string;
      memberUids: string[];
    };
    const decrypted = decryptPayload<EncryptedRoomSettings>(
      data.encryptedSettings,
      roomId,
      passcode
    );
    if (!decrypted || data.joinCodeHash !== joinCodeHash) {
      throw new Error('الرمز السري غير صحيح لهذه الغرفة.');
    }

    if (!data.memberUids?.includes(deviceUid)) {
      try {
        await updateDoc(roomRef, {
          memberUids: arrayUnion(deviceUid),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        const code = (err as {code?: string})?.code || '';
        if (code === 'permission-denied') {
          throw new Error('الغرفة مكتملة بجهازين بالفعل.');
        }
        handleFirestoreError(err, OperationType.UPDATE, roomPath);
      }
    }

    return {
      roomId,
      settings: {...DEFAULT_ROOM_SETTINGS, ...decrypted},
      isNewRoom: false,
    };
  }

  // Room does not exist yet -> create it
  const initialSettings: EncryptedRoomSettings = {
    ...DEFAULT_ROOM_SETTINGS,
    passcode,
  };
  const encryptedSettings = encryptPayload(initialSettings, roomId, passcode);
  try {
    await setDoc(roomRef, {
      ownerUid: deviceUid,
      memberUids: [deviceUid],
      joinCodeHash,
      encryptedSettings,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {roomId, settings: initialSettings, isNewRoom: true};
  } catch (createErr) {
    handleFirestoreError(createErr, OperationType.CREATE, roomPath);
  }
}

export function subscribeRoomSettings(
  roomId: string,
  passcode: string,
  onData: (settings: EncryptedRoomSettings) => void,
  onError: (err: Error) => void
) {
  const path = `rooms/${roomId}`;
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as {encryptedSettings?: string};
      if (!data?.encryptedSettings) return;
      const decoded = decryptPayload<EncryptedRoomSettings>(
        data.encryptedSettings,
        roomId,
        passcode
      );
      if (decoded) {
        onData({...DEFAULT_ROOM_SETTINGS, ...decoded});
      }
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        onError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

export async function saveRoomSettings(
  roomId: string,
  activePasscode: string,
  nextSettings: EncryptedRoomSettings
): Promise<void> {
  const path = `rooms/${roomId}`;
  const targetPin = nextSettings.passcode || activePasscode;
  const encryptedSettings = encryptPayload(nextSettings, roomId, targetPin);
  const joinCodeHash = computeJoinCodeHash(roomId, targetPin);
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      encryptedSettings,
      joinCodeHash,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updatePartnerPresence(
  roomId: string,
  passcode: string,
  role: PartnerRole,
  presence: PartnerPresenceData
): Promise<void> {
  const deviceUid = getDeviceUid();
  const path = `rooms/${roomId}/presence/${role}`;
  const encryptedData = encryptPayload(presence, roomId, passcode);
  try {
    await setDoc(doc(db, 'rooms', roomId, 'presence', role), {
      uid: deviceUid,
      role,
      encryptedData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribePartnerPresence(
  roomId: string,
  passcode: string,
  role: PartnerRole,
  onData: (data: PartnerPresenceData | null) => void
) {
  const path = `rooms/${roomId}/presence/${role}`;
  return onSnapshot(
    doc(db, 'rooms', roomId, 'presence', role),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const raw = snap.data() as {encryptedData?: string};
      if (!raw?.encryptedData) {
        onData(null);
        return;
      }
      const decoded = decryptPayload<PartnerPresenceData>(
        raw.encryptedData,
        roomId,
        passcode
      );
      onData(decoded);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export type LiveStateKey = 'wheel' | 'quiz' | 'photos' | 'reaction' | 'background';

export async function writeLiveState<T>(
  roomId: string,
  passcode: string,
  stateId: LiveStateKey,
  payload: T
): Promise<void> {
  const deviceUid = getDeviceUid();
  const path = `rooms/${roomId}/liveState/${stateId}`;
  const encryptedData = encryptPayload(payload, roomId, passcode);
  try {
    await setDoc(doc(db, 'rooms', roomId, 'liveState', stateId), {
      updatedBy: deviceUid,
      encryptedData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeLiveState<T>(
  roomId: string,
  passcode: string,
  stateId: LiveStateKey,
  onData: (data: T | null) => void
) {
  const path = `rooms/${roomId}/liveState/${stateId}`;
  return onSnapshot(
    doc(db, 'rooms', roomId, 'liveState', stateId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const raw = snap.data() as {encryptedData?: string};
      if (!raw?.encryptedData) {
        onData(null);
        return;
      }
      const decoded = decryptPayload<T>(raw.encryptedData, roomId, passcode);
      onData(decoded);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export interface SyncedBackgroundPayload {
  type: MediaBackgroundConfig['type'];
  url: string;
  updatedAt: number;
}

export async function uploadSharedBackground(
  roomId: string,
  passcode: string,
  mediaType: MediaBackgroundConfig['type'],
  file?: File
): Promise<SyncedBackgroundPayload> {
  if (mediaType === 'default' || !file) {
    const resetPayload: SyncedBackgroundPayload = {
      type: 'default',
      url: '',
      updatedAt: Date.now(),
    };
    const encryptedData = encryptPayload(resetPayload, roomId, passcode);
    if (rtdb) {
      await dbSet(dbRef(rtdb, `shared/${roomId}/background`), {
        encryptedData,
        updatedAt: resetPayload.updatedAt,
      }).catch(() => {});
    }
    await writeLiveState(roomId, passcode, 'background', resetPayload);
    return resetPayload;
  }

  let finalUrl = '';
  try {
    const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || '';
    const storagePath = `shared/${roomId}/background${ext ? `.${ext}` : ''}`;
    const fileRef = storageRef(storage, storagePath);
    await uploadBytes(fileRef, file, {
      contentType: file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
      cacheControl: 'public, max-age=3600',
    });
    finalUrl = await getDownloadURL(fileRef);
  } catch (storageErr) {
    // Fallback to encrypted inline payload via Firestore when Firebase Storage rules/bucket block uploads
    if (mediaType === 'image') {
      finalUrl = await compressImageFile(file, 1280, 420000);
    } else if (file.size <= 500000) {
      finalUrl = await fileToDataUrl(file);
    } else {
      throw storageErr instanceof Error
        ? new Error(
            'تعذر رفع الملف الكبير إلى Firebase Storage. تأكد من تفعيل قواعد Firebase Storage أو اختر ملفاً أصغر من 500 كيلوبايت.'
          )
        : new Error('تعذر رفع ملف الخلفية إلى السحابة.');
    }
  }

  const payload: SyncedBackgroundPayload = {
    type: mediaType,
    url: finalUrl,
    updatedAt: Date.now(),
  };

  // Encrypt URL and mediaType with VITE_ENCRYPTION_PEPPER + room key before storing in RTDB & Firestore
  const encryptedData = encryptPayload(payload, roomId, passcode);
  if (rtdb) {
    await dbSet(dbRef(rtdb, `shared/${roomId}/background`), {
      encryptedData,
      updatedAt: payload.updatedAt,
    }).catch(() => {});
  }
  await writeLiveState(roomId, passcode, 'background', payload);
  return payload;
}

export function subscribeSharedBackground(
  roomId: string,
  passcode: string,
  onData: (data: SyncedBackgroundPayload | null) => void
) {
  let latestTimestamp = 0;

  const emitIfNewer = (decoded: SyncedBackgroundPayload | null) => {
    if (!decoded) return;
    const ts = decoded.updatedAt || 0;
    if (ts >= latestTimestamp) {
      latestTimestamp = ts;
      onData(decoded);
    }
  };

  const unsubFirestore = subscribeLiveState<SyncedBackgroundPayload>(
    roomId,
    passcode,
    'background',
    emitIfNewer
  );

  let unsubRtdb: (() => void) | null = null;
  if (rtdb) {
    const bgRef = dbRef(rtdb, `shared/${roomId}/background`);
    unsubRtdb = onValue(
      bgRef,
      (snapshot) => {
        const val = snapshot.val() as {encryptedData?: string} | null;
        if (!val?.encryptedData) return;
        const decoded = decryptPayload<SyncedBackgroundPayload>(
          val.encryptedData,
          roomId,
          passcode
        );
        emitIfNewer(decoded);
      },
      () => {
        // Firestore listener remains active as fallback
      }
    );
  }

  return () => {
    unsubFirestore();
    if (unsubRtdb) unsubRtdb();
  };
}

export async function uploadEncryptedPhoto(
  roomId: string,
  passcode: string,
  photo: SharedPhotoItem,
  currentPhotosState: PhotosLiveState | null
): Promise<void> {
  const deviceUid = getDeviceUid();
  const photoPath = `rooms/${roomId}/photos/${photo.id}`;
  const encryptedData = encryptPayload(photo, roomId, passcode);
  try {
    await setDoc(doc(db, 'rooms', roomId, 'photos', photo.id), {
      uploaderUid: deviceUid,
      encryptedData,
      createdAt: serverTimestamp(),
    });
    const nextIds = Array.from(
      new Set([...(currentPhotosState?.photoIds || []), photo.id])
    );
    await writeLiveState<PhotosLiveState>(roomId, passcode, 'photos', {
      photoIds: nextIds,
      activePhotoId: currentPhotosState?.activePhotoId || null,
      isShuffling: false,
      rerollRequest: currentPhotosState?.rerollRequest || null,
      updatedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, photoPath);
  }
}

export async function fetchEncryptedPhoto(
  roomId: string,
  passcode: string,
  photoId: string
): Promise<SharedPhotoItem | null> {
  const path = `rooms/${roomId}/photos/${photoId}`;
  try {
    const snap = await getDoc(doc(db, 'rooms', roomId, 'photos', photoId));
    if (!snap.exists()) return null;
    const raw = snap.data() as {encryptedData?: string};
    if (!raw?.encryptedData) return null;
    return decryptPayload<SharedPhotoItem>(raw.encryptedData, roomId, passcode);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function deleteEncryptedPhoto(
  roomId: string,
  passcode: string,
  photoId: string,
  currentPhotosState: PhotosLiveState | null
): Promise<void> {
  const path = `rooms/${roomId}/photos/${photoId}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId, 'photos', photoId));
    const nextIds = (currentPhotosState?.photoIds || []).filter((id) => id !== photoId);
    await writeLiveState<PhotosLiveState>(roomId, passcode, 'photos', {
      photoIds: nextIds,
      activePhotoId:
        currentPhotosState?.activePhotoId === photoId
          ? null
          : currentPhotosState?.activePhotoId || null,
      isShuffling: false,
      rerollRequest: null,
      updatedAt: Date.now(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function reEncryptRoomOnPinChange(
  roomId: string,
  oldPin: string,
  newPin: string,
  nextSettings: EncryptedRoomSettings,
  wheelState: WheelLiveState | null,
  quizState: QuizRoundState | null,
  photosState: PhotosLiveState | null,
  reactionState: ReactionEvent | null,
  photos: SharedPhotoItem[],
  presenceMale: PartnerPresenceData | null,
  presenceFemale: PartnerPresenceData | null
): Promise<void> {
  const deviceUid = getDeviceUid();
  await saveRoomSettings(roomId, oldPin, {...nextSettings, passcode: newPin});
  if (wheelState) await writeLiveState(roomId, newPin, 'wheel', wheelState);
  if (quizState) await writeLiveState(roomId, newPin, 'quiz', quizState);
  if (reactionState) await writeLiveState(roomId, newPin, 'reaction', reactionState);
  if (presenceMale) await updatePartnerPresence(roomId, newPin, 'male', presenceMale);
  if (presenceFemale)
    await updatePartnerPresence(roomId, newPin, 'female', presenceFemale);

  const newPhotoIds: string[] = [];
  let nextActiveId = photosState?.activePhotoId || null;
  for (const photo of photos) {
    const newPhotoId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const updatedItem: SharedPhotoItem = {...photo, id: newPhotoId};
    const encryptedData = encryptPayload(updatedItem, roomId, newPin);
    await setDoc(doc(db, 'rooms', roomId, 'photos', newPhotoId), {
      uploaderUid: deviceUid,
      encryptedData,
      createdAt: serverTimestamp(),
    });
    newPhotoIds.push(newPhotoId);
    if (nextActiveId === photo.id) {
      nextActiveId = newPhotoId;
    }
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'photos', photo.id));
    } catch {
      // ignore if already removed
    }
  }
  if (photosState || newPhotoIds.length > 0) {
    await writeLiveState<PhotosLiveState>(roomId, newPin, 'photos', {
      photoIds: newPhotoIds,
      activePhotoId: nextActiveId,
      isShuffling: false,
      rerollRequest: null,
      updatedAt: Date.now(),
    });
  }
}
