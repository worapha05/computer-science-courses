export type IrPhase =
  'preparation' | 'detection' | 'containment' | 'eradication' | 'recovery' | 'lessonsLearned';

export type Severity = 'SEV1' | 'SEV2' | 'SEV3';

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  phase: IrPhase;
  notes: string[];
}

const PHASE_ORDER: IrPhase[] = [
  'preparation',
  'detection',
  'containment',
  'eradication',
  'recovery',
  'lessonsLearned',
];

export const PLAYBOOK_ACTIONS: Record<IrPhase, string[]> = {
  preparation: [
    'ตรวจรายชื่อ on-call และช่องทางสำรอง',
    'ยืนยันสิทธิ์ break-glass ที่ audit ได้',
    'ตรวจว่า audit log / SIEM เข้าถึงได้',
  ],
  detection: [
    'บันทึกเวลาพบเหตุ (UTC) และผู้รายงาน',
    'เก็บ alert / request id ที่เกี่ยวข้อง',
    'จัด severity เบื้องต้น',
  ],
  containment: [
    'revoke session/token ที่สงสัย',
    'isolate host / disable API key ที่เกี่ยวข้อง',
    'เปิดโหมด read-only ถ้าจำเป็นสำหรับระบบเงิน',
  ],
  eradication: [
    'ระบุ root cause (ช่องโหว่ / credential / misconfig)',
    'ลบ backdoor / ปิด endpoint อันตราย',
    'หมุน secrets ที่อาจรั่ว',
  ],
  recovery: [
    'deploy version แก้แล้วจาก artifact ที่เซ็น',
    'เฝ้าระวัง metrics / error rate',
    'ค่อย ๆ เปิด traffic กลับ',
  ],
  lessonsLearned: [
    'เขียน blameless postmortem',
    'สร้าง ticket แก้ระยะยาว (control ใหม่ / test ใหม่)',
    'update threat model และ playbook',
  ],
};

export function createIncident(title: string, severity: Severity): Incident {
  return {
    id: `inc_${Date.now()}`,
    title,
    severity,
    phase: 'detection',
    notes: [],
  };
}

export function advancePhase(incident: Incident): Incident {
  const idx = PHASE_ORDER.indexOf(incident.phase);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return incident;
  const next = PHASE_ORDER[idx + 1]!;
  return {
    ...incident,
    phase: next,
    notes: [...incident.notes, `ย้ายจาก ${incident.phase} → ${next}`],
  };
}

export function checklistFor(incident: Incident): string[] {
  return PLAYBOOK_ACTIONS[incident.phase];
}

export function demoIncidentResponse(): void {
  console.log('\n=== Incident Response Playbook Demo ===\n');

  let inc = createIncident('สงสัยว่ามีผู้ใช้ดู transfer ของคนอื่นผ่าน IDOR', 'SEV2');
  console.log(`Incident ${inc.id}: ${inc.title} [${inc.severity}]`);

  for (let step = 0; step < 5; step++) {
    console.log(`\nPhase = ${inc.phase}`);
    for (const item of checklistFor(inc)) {
      console.log(` - [ ] ${item}`);
    }
    inc = advancePhase(inc);
  }

  console.log('\nบันทึกการเปลี่ยน phase:', inc.notes);
}
