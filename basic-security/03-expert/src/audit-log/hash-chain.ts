import { createHash, randomUUID } from 'node:crypto';

export interface AuditEventInput {
  actorId: string;
  action: string;
  resource: string;
  outcome: 'success' | 'denied' | 'error';
  ip?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface AuditRecord extends AuditEventInput {
  id: string;
  timestamp: string;
  prevHash: string;
  hash: string;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function computeHash(prevHash: string, body: Omit<AuditRecord, 'hash'>): string {
  const material = `${prevHash}|${body.id}|${body.timestamp}|${body.actorId}|${body.action}|${body.resource}|${body.outcome}|${stableStringify(body.metadata ?? {})}`;
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

export class HashChainAuditLog {
  private readonly records: AuditRecord[] = [];
  private tipHash = 'GENESIS';

  public append(input: AuditEventInput): AuditRecord {
    if (/(password|token|secret|cvv)/i.test(JSON.stringify(input))) {
      throw new Error('ปฏิเสธการเขียน audit ที่มี field อ่อนไหว');
    }

    const base: Omit<AuditRecord, 'hash'> = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      prevHash: this.tipHash,
      ...input,
    };
    const hash = computeHash(this.tipHash, base);
    const record: AuditRecord = { ...base, hash };
    this.records.push(record);
    this.tipHash = hash;
    return record;
  }

  public verify(): { ok: true } | { ok: false; atIndex: number; reason: string } {
    let prev = 'GENESIS';
    for (let i = 0; i < this.records.length; i++) {
      const rec = this.records[i]!;
      if (rec.prevHash !== prev) {
        return { ok: false, atIndex: i, reason: 'prevHash ไม่ต่อเนื่อง' };
      }
      const { hash: _ignored, ...body } = rec;
      const expected = computeHash(prev, body);
      if (expected !== rec.hash) {
        return { ok: false, atIndex: i, reason: 'hash ไม่ตรงกับเนื้อหา' };
      }
      prev = rec.hash;
    }
    return { ok: true };
  }

  public tamperForDemo(index: number, newAction: string): void {
    const rec = this.records[index];
    if (!rec) {
      throw new Error(`ไม่พบ record ที่ index ${index}`);
    }
    rec.action = newAction;
  }

  public list(): readonly AuditRecord[] {
    return this.records;
  }
}

export function demoAuditLog(): void {
  console.log('\n=== Tamper-evident Audit Log Demo ===\n');

  const log = new HashChainAuditLog();
  log.append({
    actorId: 'user_42',
    action: 'transfer.create',
    resource: 'transfer:1001',
    outcome: 'success',
    ip: '198.51.100.20',
  });
  log.append({
    actorId: 'user_42',
    action: 'transfer.approve',
    resource: 'transfer:1001',
    outcome: 'success',
    ip: '198.51.100.20',
  });
  log.append({
    actorId: 'admin_1',
    action: 'user.role_change',
    resource: 'user:99',
    outcome: 'success',
    metadata: { from: 'user', to: 'admin' },
  });

  console.log('verify หลังเขียนปกติ:', log.verify());

  log.tamperForDemo(1, 'transfer.approve_FORGED');
  console.log('verify หลังถูกแก้กลางทาง:', log.verify());
  console.log('→ จับได้ว่ามี Alteration / ลดโอกาส Repudiation สำเร็จ');
}
