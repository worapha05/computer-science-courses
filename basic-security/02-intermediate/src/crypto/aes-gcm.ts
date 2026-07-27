import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

export interface AesPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function generateAesKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

export function encryptAesGcm(plaintext: string, key: Buffer): AesPayload {
  if (key.length !== KEY_LENGTH) {
    throw new Error('AES-256 ต้องการ key 32 bytes');
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptAesGcm(payload: AesPayload, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function demoAesGcm(): void {
  console.log('\n=== AES-256-GCM Demo ===\n');

  const key = generateAesKey();
  const secret = 'เลขบัตรประชาชน: 1-2345-67890-12-3';
  const payload = encryptAesGcm(secret, key);
  console.log('ciphertext:', payload.ciphertext.slice(0, 32) + '...');
  console.log('iv:', payload.iv);
  console.log('tag:', payload.tag);

  const plain = decryptAesGcm(payload, key);
  console.log('decrypt OK:', plain);

  const raw = Buffer.from(payload.ciphertext, 'base64');
  raw[0] = raw[0]! ^ 0xff;
  const tampered: AesPayload = {
    ...payload,
    ciphertext: raw.toString('base64'),
  };
  try {
    decryptAesGcm(tampered, key);
    console.log('ERROR: ควรจะล้มเหลวเมื่อถูกแก้');
  } catch {
    console.log('integrity ทำงาน: ปฏิเสธ ciphertext ที่ถูก Alteration');
  }
}
