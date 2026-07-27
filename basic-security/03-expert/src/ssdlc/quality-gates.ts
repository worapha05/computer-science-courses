export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  source: 'sast' | 'dast' | 'sca' | 'secret-scan';
  rule: string;
  severity: Severity;
  fileOrEndpoint: string;
  acceptedRisk?: boolean;
}

export interface GatePolicy {
  maxCritical: number;
  maxHigh: number;
  blockSecrets: boolean;
  requireDastForProd: boolean;
}

export interface GateResult {
  passed: boolean;
  blockers: string[];
  warnings: string[];
}

const SEV_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function evaluateQualityGate(
  findings: Finding[],
  policy: GatePolicy,
  targetEnv: 'staging' | 'production',
): GateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const actionable = findings.filter((f) => !f.acceptedRisk);

  const criticals = actionable.filter((f) => f.severity === 'critical');
  const highs = actionable.filter((f) => f.severity === 'high');
  const secrets = actionable.filter((f) => f.source === 'secret-scan');
  const dastFindings = findings.filter((f) => f.source === 'dast');

  if (criticals.length > policy.maxCritical) {
    blockers.push(`SAST/Scan critical=${criticals.length} เกินเพดาน ${policy.maxCritical}`);
  }
  if (highs.length > policy.maxHigh) {
    blockers.push(`High findings=${highs.length} เกินเพดาน ${policy.maxHigh}`);
  }
  if (policy.blockSecrets && secrets.length > 0) {
    blockers.push(`พบ secret ในโค้ด/artifact จำนวน ${secrets.length}`);
  }
  if (policy.requireDastForProd && targetEnv === 'production' && dastFindings.length === 0) {
    blockers.push('production ต้องการหลักฐานว่ามี DAST รันแล้วใน pipeline');
  }

  for (const f of findings.filter((x) => x.acceptedRisk)) {
    warnings.push(`accepted risk: [${f.severity}] ${f.rule} @ ${f.fileOrEndpoint}`);
  }

  actionable
    .filter((f) => SEV_RANK[f.severity] >= SEV_RANK.medium)
    .forEach((f) => {
      if (f.severity === 'medium') {
        warnings.push(`[medium] ${f.source}:${f.rule} @ ${f.fileOrEndpoint}`);
      }
    });

  return { passed: blockers.length === 0, blockers, warnings };
}

export const DEFAULT_PROD_POLICY: GatePolicy = {
  maxCritical: 0,
  maxHigh: 0,
  blockSecrets: true,
  requireDastForProd: true,
};

export function demoQualityGates(): void {
  console.log('\n=== SSDLC Quality Gates Demo ===\n');

  const dirty: Finding[] = [
    {
      source: 'sast',
      rule: 'sql-injection',
      severity: 'critical',
      fileOrEndpoint: 'src/users/search.ts',
    },
    {
      source: 'secret-scan',
      rule: 'aws-access-key',
      severity: 'critical',
      fileOrEndpoint: 'config/old.env',
    },
    {
      source: 'sca',
      rule: 'CVE-2024-XXXX lodash',
      severity: 'high',
      fileOrEndpoint: 'package-lock.json',
    },
  ];

  const dirtyResult = evaluateQualityGate(dirty, DEFAULT_PROD_POLICY, 'production');
  console.log('Pipeline ชุดแรก (ยังไม่แก้):', dirtyResult);

  const clean: Finding[] = [
    {
      source: 'dast',
      rule: 'info-headers',
      severity: 'low',
      fileOrEndpoint: 'https://staging.payleaf.example',
    },
    {
      source: 'sca',
      rule: 'CVE-old-transitive',
      severity: 'medium',
      fileOrEndpoint: 'package-lock.json',
      acceptedRisk: true,
    },
  ];

  const cleanResult = evaluateQualityGate(clean, DEFAULT_PROD_POLICY, 'production');
  console.log('Pipeline หลัง triage + แก้ critical:', cleanResult);
}
