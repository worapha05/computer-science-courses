/**
 * ตรวจว่าไฟล์ IaC ตัวอย่างครบ และอธิบาย canary weights
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const required = ['serverless.yml', 'main.tf', 'gcp-function.tf.example', 'traffic-shift.json'];

for (const f of required) {
  const p = join(dir, f);
  console.log(existsSync(p) ? `✓ ${f}` : `✗ missing ${f}`, `(${readFileSync(p).length} bytes)`);
}

const shift = JSON.parse(readFileSync(join(dir, 'traffic-shift.json'), 'utf8'));
console.log('\nCanary plan:');
for (const step of shift.steps) {
  console.log(
    `  - ${step.name}: v2=${step.v2Percent}% wait=${step.waitMinutes}m rollbackOn=${step.rollbackOn}`,
  );
}

console.log(`
Blue/Green vs Canary:
  - Blue/Green: สลับ 0↔100 เร็ว ทดสอบทั้งก้อนบน env แยก
  - Canary: เปิด traffic ทีละน้อย วัด error/latency จริงจากผู้ใช้บางส่วน
`);
