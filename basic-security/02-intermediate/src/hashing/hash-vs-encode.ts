import { createHash, createHmac, randomBytes } from 'node:crypto';
import { encryptAesGcm, generateAesKey } from '../crypto/aes-gcm.js';

export function encodeBase64(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64');
}

export function decodeBase64(input: string): string {
  return Buffer.from(input, 'base64').toString('utf8');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hmacSha256(input: string, key: Buffer): string {
  return createHmac('sha256', key).update(input, 'utf8').digest('hex');
}

export function demoHashVsEncode(): void {
  console.log('\n=== Hashing vs Encoding vs Encryption ===\n');

  const sample = 'hello-security';

  const encoded = encodeBase64(sample);
  console.log('Encoding (Base64):', encoded, '→ decode:', decodeBase64(encoded));
  console.log('  ไม่ใช่ความลับ — ใครก็ decode ได้\n');

  const digest = sha256(sample);
  console.log('Hashing (SHA-256):', digest);
  console.log('  ใช้ตรวจ integrity / fingerprint — ถอดกลับไม่ได้\n');

  const macKey = randomBytes(32);
  const mac = hmacSha256(sample, macKey);
  console.log('HMAC-SHA256:', mac);
  console.log('  ใช้ยืนยันว่าข้อความมาจากผู้ที่มีคีย์ร่วม\n');

  const aesKey = generateAesKey();
  const enc = encryptAesGcm(sample, aesKey);
  console.log('Encryption (AES-GCM):', enc.ciphertext.slice(0, 40) + '...');
  console.log('  ถอดกลับได้เมื่อมีคีย์ — ใช้เก็บความลับ\n');

  console.log('Password tip: อย่าใช้ SHA-256 เปล่าเก็บรหัสผ่าน — ใช้ Argon2id/bcrypt');
}
