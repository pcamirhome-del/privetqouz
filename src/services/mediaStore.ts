import CryptoJS from 'crypto-js';
import {decryptPayload, encryptPayload} from './crypto';
import type {SharedPhotoItem} from '../types/app';

const DB_NAME = 'nabd_alquloob_encrypted_db';
const STORE_NAME = 'encrypted_blobs';
const DB_VERSION = 1;

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveEncryptedLocalMedia(
  key: string,
  dataUrl: string,
  roomId: string,
  pin: string
): Promise<void> {
  const db = await openMediaDb();
  const cipher = encryptPayload({dataUrl}, roomId, pin);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(cipher, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadEncryptedLocalMedia(
  key: string,
  roomId: string,
  pin: string
): Promise<string | null> {
  try {
    const db = await openMediaDb();
    const cipher = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!cipher) return null;
    const decoded = decryptPayload<{dataUrl: string}>(cipher, roomId, pin);
    return decoded?.dataUrl ?? null;
  } catch {
    return null;
  }
}

export async function deleteEncryptedLocalMedia(key: string): Promise<void> {
  try {
    const db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore cleanup error
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function compressImageFile(
  file: File,
  maxDim = 900,
  maxDataUrlBytes = 350 * 1024,
  initialQuality = 0.75
): Promise<string> {
  if (file.type === 'image/gif') {
    return fileToDataUrl(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
      el.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fileToDataUrl(file);
    ctx.drawImage(img, 0, 0, width, height);

    // Prefer image/webp if browser encoder supports it, otherwise fall back to image/jpeg
    const webpProbe = canvas.toDataURL('image/webp', initialQuality);
    const mimeType = webpProbe.startsWith('data:image/webp')
      ? 'image/webp'
      : 'image/jpeg';

    let quality = initialQuality;
    let result = mimeType === 'image/webp' ? webpProbe : canvas.toDataURL('image/jpeg', quality);
    while (result.length > maxDataUrlBytes && quality > 0.32) {
      quality = Number((quality - 0.12).toFixed(2));
      result = canvas.toDataURL(mimeType, quality);
    }

    // If still slightly above target on very detailed images, scale down dimensions slightly
    if (result.length > maxDataUrlBytes) {
      const scaleRatio = Math.sqrt(maxDataUrlBytes / result.length) * 0.92;
      canvas.width = Math.max(320, Math.round(width * scaleRatio));
      canvas.height = Math.max(320, Math.round(height * scaleRatio));
      const resizedCtx = canvas.getContext('2d');
      if (resizedCtx) {
        resizedCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL(mimeType, 0.72);
      }
    }

    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function compressImageToBlob(
  file: File,
  maxDim = 1440,
  quality = 0.84
): Promise<Blob> {
  if (file.type === 'image/gif' || file.type.startsWith('video/')) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
      el.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > maxDim || height > maxDim) {
      if (width >= height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    return blob || file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function computeImageFingerprint(dataUrl: string): Promise<{
  contentHash: string;
  perceptualHash: string;
}> {
  const contentHash = CryptoJS.SHA256(dataUrl).toString(CryptoJS.enc.Hex);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image_load_failed'));
      el.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (!ctx) return {contentHash, perceptualHash: ''};
    ctx.drawImage(img, 0, 0, 9, 8);
    const {data} = ctx.getImageData(0, 0, 9, 8);

    // 64-bit difference hash (dHash) across 8x8 horizontal luminance gradients
    let bits = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const leftIdx = (y * 9 + x) * 4;
        const rightIdx = (y * 9 + x + 1) * 4;
        const lumLeft =
          0.299 * data[leftIdx] +
          0.587 * data[leftIdx + 1] +
          0.114 * data[leftIdx + 2];
        const lumRight =
          0.299 * data[rightIdx] +
          0.587 * data[rightIdx + 1] +
          0.114 * data[rightIdx + 2];
        bits += lumLeft > lumRight ? '1' : '0';
      }
    }

    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return {contentHash, perceptualHash: hex};
  } catch {
    return {contentHash, perceptualHash: ''};
  }
}

function hammingDistanceHex64(a: string, b: string): number {
  if (!a || !b || a.length !== 16 || b.length !== 16) return 999;
  let dist = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x > 0) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

export async function isDuplicatePhoto(
  candidateDataUrl: string,
  candidateHashes: {contentHash: string; perceptualHash: string},
  existingPhotos: SharedPhotoItem[]
): Promise<boolean> {
  for (const existing of existingPhotos) {
    if (existing.dataUrl === candidateDataUrl) return true;
    if (
      existing.contentHash &&
      existing.contentHash === candidateHashes.contentHash
    ) {
      return true;
    }
    let existingPhash = existing.perceptualHash || '';
    if (!existingPhash && existing.dataUrl) {
      const computed = await computeImageFingerprint(existing.dataUrl);
      if (computed.contentHash === candidateHashes.contentHash) return true;
      existingPhash = computed.perceptualHash;
    }
    if (
      candidateHashes.perceptualHash &&
      existingPhash &&
      hammingDistanceHex64(candidateHashes.perceptualHash, existingPhash) <= 3
    ) {
      return true;
    }
  }
  return false;
}

