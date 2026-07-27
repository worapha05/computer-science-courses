import { generateKeyPairSync, publicEncrypt, privateDecrypt, constants } from 'node:crypto';
import { encryptAesGcm, decryptAesGcm, generateAesKey, type AesPayload } from './aes-gcm.js';

export interface HybridPackage {
  encryptedKey: string;
  data: AesPayload;
}

export function generateRsaKeyPair(): {
  publicKeyPem: string;
  privateKeyPem: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

export function hybridEncrypt(plaintext: string, recipientPublicKeyPem: string): HybridPackage {
  const aesKey = generateAesKey();
  const data = encryptAesGcm(plaintext, aesKey);
  const encryptedKey = publicEncrypt(
    {
      key: recipientPublicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey,
  );
  return {
    encryptedKey: encryptedKey.toString('base64'),
    data,
  };
}

export function hybridDecrypt(pkg: HybridPackage, recipientPrivateKeyPem: string): string {
  const aesKey = privateDecrypt(
    {
      key: recipientPrivateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(pkg.encryptedKey, 'base64'),
  );
  return decryptAesGcm(pkg.data, aesKey);
}

export function demoRsaHybrid(): void {
  console.log('\n=== RSA + AES Hybrid Encryption Demo ===\n');

  const { publicKeyPem, privateKeyPem } = generateRsaKeyPair();
  const message = 'รายงานทางการเงิน Q2 — ลับมาก';
  const pkg = hybridEncrypt(message, publicKeyPem);

  console.log(
    'RSA-wrapped AES key length (bytes):',
    Buffer.from(pkg.encryptedKey, 'base64').length,
  );
  console.log('AES ciphertext preview:', pkg.data.ciphertext.slice(0, 24) + '...');

  const recovered = hybridDecrypt(pkg, privateKeyPem);
  console.log('decrypt OK:', recovered);
  console.log('แนวคิด: RSA ใช้แลกคีย์, AES ใช้เข้ารหัสข้อมูล (Data at Rest / ไฟล์ใหญ่)');
}
