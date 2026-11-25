import CryptoJS from 'crypto-js';

const APP_PEPPER =
  import.meta.env.VITE_ENCRYPTION_PEPPER || 'NABD_ALQULOOB_E2EE_2026_SECRET';

function deriveAes256Key(roomId: string, secretPin: string): CryptoJS.lib.WordArray {
  const salt = CryptoJS.SHA256(`${APP_PEPPER}::${roomId}`);
  return CryptoJS.PBKDF2(`${roomId}:${secretPin}:${APP_PEPPER}`, salt, {
    keySize: 256 / 32,
    iterations: 1500,
    hasher: CryptoJS.algo.SHA256,
  });
}

export function computeJoinCodeHash(roomId: string, passcode: string): string {
  return CryptoJS.SHA256(`${roomId.trim()}::${passcode.trim()}::${APP_PEPPER}`).toString(
    CryptoJS.enc.Hex
  );
}

export function encryptPayload<T>(data: T, roomId: string, secretPin: string): string {
  const key = deriveAes256Key(roomId, secretPin);
  const iv = CryptoJS.lib.WordArray.random(16);
  const json = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(json, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const payload = {
    v: 1,
    iv: iv.toString(CryptoJS.enc.Hex),
    ct: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
  };
  return JSON.stringify(payload);
}

export function decryptPayload<T>(
  ciphertextWrapper: string,
  roomId: string,
  secretPin: string
): T | null {
  try {
    const parsed = JSON.parse(ciphertextWrapper) as {v?: number; iv: string; ct: string};
    if (!parsed?.iv || !parsed?.ct) return null;
    const key = deriveAes256Key(roomId, secretPin);
    const iv = CryptoJS.enc.Hex.parse(parsed.iv);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(parsed.ct),
    });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const utf8 = decrypted.toString(CryptoJS.enc.Utf8);
    if (!utf8) return null;
    return JSON.parse(utf8) as T;
  } catch {
    return null;
  }
}
