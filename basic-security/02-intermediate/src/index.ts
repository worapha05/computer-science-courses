import { demoAesGcm } from './crypto/aes-gcm.js';
import { demoRsaHybrid } from './crypto/rsa-hybrid.js';
import { demoHashVsEncode } from './hashing/hash-vs-encode.js';
import { demoSanitization } from './sanitization/sanitize.js';
import { demoInjection } from './injection/sql-safe.js';

console.log('Basic Security Concepts — Intermediate demos');
console.log('============================================');

demoAesGcm();
demoRsaHybrid();
demoHashVsEncode();
demoSanitization();
demoInjection();

console.log('\nเสร็จแล้ว — ไปทำ LAB.md ด้วยตัวเองก่อนเปิดเฉลย\n');
