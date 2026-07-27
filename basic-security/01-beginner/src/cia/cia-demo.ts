export type CiaPillar = 'confidentiality' | 'integrity' | 'availability';

export interface SecretRecord {
  id: string;
  ownerId: string;
  plaintext: string;
  checksum: string;
}

export interface AccessAttempt {
  actorId: string;
  recordId: string;
  action: 'read' | 'update' | 'delete';
}

function simpleChecksum(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const store = new Map<string, SecretRecord>();

export function createRecord(ownerId: string, plaintext: string): SecretRecord {
  const id = `rec_${store.size + 1}`;
  const record: SecretRecord = {
    id,
    ownerId,
    plaintext,
    checksum: simpleChecksum(plaintext),
  };
  store.set(id, record);
  return { ...record };
}

export function readConfidential(
  attempt: AccessAttempt,
): { ok: true; data: string } | { ok: false; violated: CiaPillar; reason: string } {
  const record = store.get(attempt.recordId);
  if (!record) {
    return { ok: false, violated: 'availability', reason: 'ไม่พบข้อมูล' };
  }
  if (attempt.actorId !== record.ownerId) {
    return {
      ok: false,
      violated: 'confidentiality',
      reason: 'ผู้เรียกไม่ใช่เจ้าของ — Disclosure ถูกกันไว้',
    };
  }
  return { ok: true, data: record.plaintext };
}

export function verifyIntegrity(
  recordId: string,
): { ok: true } | { ok: false; violated: CiaPillar; reason: string } {
  const record = store.get(recordId);
  if (!record) {
    return { ok: false, violated: 'availability', reason: 'ไม่พบข้อมูล' };
  }
  if (simpleChecksum(record.plaintext) !== record.checksum) {
    return {
      ok: false,
      violated: 'integrity',
      reason: 'checksum ไม่ตรง — สงสัยว่าถูก Alteration จากภายนอก',
    };
  }
  return { ok: true };
}

export function updateWithIntegrityCheck(
  attempt: AccessAttempt,
  newValue: string,
): { ok: true } | { ok: false; violated: CiaPillar; reason: string } {
  const record = store.get(attempt.recordId);
  if (!record) {
    return { ok: false, violated: 'availability', reason: 'ไม่พบข้อมูล' };
  }
  if (attempt.actorId !== record.ownerId) {
    return { ok: false, violated: 'confidentiality', reason: 'ไม่มีสิทธิ์แก้ไข' };
  }
  const integrity = verifyIntegrity(attempt.recordId);
  if (!integrity.ok) return integrity;

  record.plaintext = newValue;
  record.checksum = simpleChecksum(newValue);
  return { ok: true };
}

export function destroyRecord(
  attempt: AccessAttempt,
  allowDestroy: boolean,
): { ok: true } | { ok: false; violated: CiaPillar; reason: string } {
  if (!allowDestroy) {
    return {
      ok: false,
      violated: 'availability',
      reason: 'Destruction ถูกกันด้วย soft-delete policy / backup retention',
    };
  }
  store.delete(attempt.recordId);
  return { ok: true };
}

export function demoCiaScenarios(): void {
  console.log('\n=== CIA Triad Demo ===\n');

  const alice = createRecord('alice', 'เงินเดือน: 85,000');
  console.log('สร้าง record ของ alice:', alice.id, 'checksum=', alice.checksum);

  const leak = readConfidential({
    actorId: 'eve',
    recordId: alice.id,
    action: 'read',
  });
  console.log('Eve พยายามอ่าน →', leak);

  const ok = readConfidential({
    actorId: 'alice',
    recordId: alice.id,
    action: 'read',
  });
  console.log('Alice อ่านของตัวเอง →', ok);

  const record = store.get(alice.id);
  if (record) {
    record.plaintext = 'เงินเดือน: 1';
  }
  console.log('ตรวจ integrity หลังถูก tamper →', verifyIntegrity(alice.id));

  const update = updateWithIntegrityCheck(
    { actorId: 'alice', recordId: alice.id, action: 'update' },
    'เงินเดือน: 90,000',
  );
  console.log('update หลังถูก tamper →', update);

  const destroy = destroyRecord(
    { actorId: 'attacker', recordId: alice.id, action: 'delete' },
    false,
  );
  console.log('Attacker พยายามทำลาย →', destroy);
}
