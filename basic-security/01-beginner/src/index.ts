import { demoCiaScenarios } from './cia/cia-demo.js';
import { demoLeastPrivilege } from './polp/least-privilege.js';
import { demoDefenseInDepth } from './defense-in-depth/layers.js';
import { demoRateLimiting } from './rate-limiting/token-bucket.js';

console.log('Basic Security Concepts — Beginner demos');
console.log('========================================');

demoCiaScenarios();
demoLeastPrivilege();
demoDefenseInDepth();
demoRateLimiting();

console.log('\nเสร็จแล้ว — ไปทำ LAB.md ด้วยตัวเองก่อนเปิดเฉลย\n');
