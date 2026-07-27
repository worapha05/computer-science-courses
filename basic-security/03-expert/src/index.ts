import { demoStride } from './stride/threat-model.js';
import { demoQualityGates } from './ssdlc/quality-gates.js';
import { demoAuditLog } from './audit-log/hash-chain.js';
import { demoIncidentResponse } from './incident/playbook.js';

console.log('Basic Security Concepts — Expert demos');
console.log('======================================');

demoStride();
demoQualityGates();
demoAuditLog();
demoIncidentResponse();

console.log('\nเสร็จแล้ว — ไปทำ LAB.md ด้วยตัวเองก่อนเปิดเฉลย\n');
