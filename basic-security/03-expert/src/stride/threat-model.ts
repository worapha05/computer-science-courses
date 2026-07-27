export type StrideCategory =
  | 'spoofing'
  | 'tampering'
  | 'repudiation'
  | 'informationDisclosure'
  | 'denialOfService'
  | 'elevationOfPrivilege';

export interface SystemComponent {
  id: string;
  name: string;
  type: 'externalEntity' | 'process' | 'dataStore' | 'dataFlow';
  trustZone: string;
  handlesPii?: boolean;
}

export interface Threat {
  id: string;
  componentId: string;
  category: StrideCategory;
  description: string;
  likelihood: 1 | 2 | 3;
  impact: 1 | 2 | 3;
  mitigation: string;
}

export function riskScore(t: Pick<Threat, 'likelihood' | 'impact'>): number {
  return t.likelihood * t.impact;
}

export function prioritize(threats: Threat[]): Threat[] {
  return [...threats].sort((a, b) => riskScore(b) - riskScore(a));
}

export function stridePrompts(component: SystemComponent): Record<StrideCategory, string> {
  const label = component.name;
  return {
    spoofing: `ใครสามารถปลอมตัวเป็น ${label} หรือเรียกเข้า ${label} โดยไม่พิสูจน์ตัวตนที่แข็งแรง?`,
    tampering: `ข้อมูลที่ ${label} จัดการ ถูกแก้ระหว่างทางหรือที่พักได้อย่างไร?`,
    repudiation: `ผู้ใช้/บริการปฏิเสธการกระทำผ่าน ${label} ได้หรือไม่ เพราะ log ไม่พอ?`,
    informationDisclosure: `${label} เปิดเผยข้อมูล${component.handlesPii ? ' PII' : ''} ต่อผู้ไม่มีสิทธิ์ได้อย่างไร?`,
    denialOfService: `ทำให้ ${label} ช้า/ล่มจนธุรกิจสะดุดได้อย่างไร?`,
    elevationOfPrivilege: `จากสิทธิ์ต่ำในโซน ${component.trustZone} ยกระดับผ่าน ${label} ได้อย่างไร?`,
  };
}

export function buildSampleThreatModel(): {
  components: SystemComponent[];
  threats: Threat[];
} {
  const components: SystemComponent[] = [
    {
      id: 'user',
      name: 'Mobile/Web User',
      type: 'externalEntity',
      trustZone: 'internet',
    },
    {
      id: 'api',
      name: 'Payment API',
      type: 'process',
      trustZone: 'app',
      handlesPii: true,
    },
    {
      id: 'db',
      name: 'Postgres',
      type: 'dataStore',
      trustZone: 'data',
      handlesPii: true,
    },
    {
      id: 'logs',
      name: 'Audit Log Store',
      type: 'dataStore',
      trustZone: 'ops',
    },
  ];

  const threats: Threat[] = [
    {
      id: 'T1',
      componentId: 'api',
      category: 'spoofing',
      description: 'ขโมย JWT แล้วเรียก API แทนผู้ใช้',
      likelihood: 2,
      impact: 3,
      mitigation: 'สั้นอายุ access token + refresh rotation + bind device/IP ตามความเสี่ยง',
    },
    {
      id: 'T2',
      componentId: 'db',
      category: 'tampering',
      description: 'SQL injection แก้ยอดเงินในตาราง transfers',
      likelihood: 2,
      impact: 3,
      mitigation: 'parameterized queries + DB user PoLP + WAF เป็นชั้นเสริม',
    },
    {
      id: 'T3',
      componentId: 'logs',
      category: 'repudiation',
      description: 'admin ที่ถูก compromise ลบ log การโอนเงิน',
      likelihood: 1,
      impact: 3,
      mitigation: 'append-only log + hash chain + ส่งไป SIEM แยกสิทธิ์',
    },
    {
      id: 'T4',
      componentId: 'db',
      category: 'informationDisclosure',
      description: 'backup DB ถูก download จาก bucket สาธารณะ',
      likelihood: 2,
      impact: 3,
      mitigation: 'private bucket + SSE-KMS + และห้าม ACL public',
    },
    {
      id: 'T5',
      componentId: 'api',
      category: 'denialOfService',
      description: 'flood /transfer จนคิวเต็ม',
      likelihood: 3,
      impact: 2,
      mitigation: 'rate limit ต่อ user/IP + autoscaling + circuit breaker',
    },
    {
      id: 'T6',
      componentId: 'api',
      category: 'elevationOfPrivilege',
      description: 'IDOR เปลี่ยน userId ใน path เป็นของคนอื่นแล้ว approve การโอน',
      likelihood: 2,
      impact: 3,
      mitigation: 'object-level AuthZ ตรวจ ownership ทุก request',
    },
  ];

  return { components, threats };
}

export function demoStride(): void {
  console.log('\n=== STRIDE Threat Modeling Demo ===\n');

  const { components, threats } = buildSampleThreatModel();
  const api = components.find((c) => c.id === 'api');
  if (!api) {
    console.log('ERROR: ไม่พบ component api ใน threat model');
    return;
  }

  console.log('ตัวอย่างคำถาม STRIDE สำหรับ', api.name);
  const prompts = stridePrompts(api);
  for (const [k, v] of Object.entries(prompts)) {
    console.log(` [${k}] ${v}`);
  }

  console.log('\nจัดลำดับความเสี่ยง (สูง → ต่ำ):');
  for (const t of prioritize(threats)) {
    console.log(` ${t.id} score=${riskScore(t)} [${t.category}] ${t.description}`);
    console.log(`  mitigation: ${t.mitigation}`);
  }
}
