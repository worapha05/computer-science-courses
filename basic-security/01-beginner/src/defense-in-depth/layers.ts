export interface RequestContext {
  ip: string;
  path: string;
  authenticated: boolean;
  role: 'anonymous' | 'user' | 'admin';
  payload: string;
  wantsAdminData: boolean;
}

export type LayerName = 'network' | 'host' | 'application' | 'data';

export interface LayerResult {
  layer: LayerName;
  passed: boolean;
  detail: string;
}

const BLOCKED_IPS = new Set(['203.0.113.66']);
const BLOCKED_PATHS = new Set(['/debug', '/.env', '/admin/raw-sql']);

function networkLayer(ctx: RequestContext): LayerResult {
  if (BLOCKED_IPS.has(ctx.ip)) {
    return { layer: 'network', passed: false, detail: 'IP ถูก deny ที่ firewall' };
  }
  if (BLOCKED_PATHS.has(ctx.path)) {
    return { layer: 'network', passed: false, detail: 'path อันตรายถูกบล็อกโดย WAF rule' };
  }
  return { layer: 'network', passed: true, detail: 'ผ่าน network controls' };
}

function hostLayer(ctx: RequestContext): LayerResult {
  if (ctx.payload.includes('../') || ctx.payload.includes('%00')) {
    return {
      layer: 'host',
      passed: false,
      detail: 'ตรวจพบ path traversal / null byte — host IDS ตัดการเชื่อมต่อ',
    };
  }
  return { layer: 'host', passed: true, detail: 'host hardening ผ่าน' };
}

function applicationLayer(ctx: RequestContext): LayerResult {
  if (!ctx.authenticated) {
    return { layer: 'application', passed: false, detail: 'ยังไม่ได้ยืนยันตัวตน' };
  }
  if (ctx.wantsAdminData && ctx.role !== 'admin') {
    return {
      layer: 'application',
      passed: false,
      detail: 'มี auth แต่ไม่มีสิทธิ์ admin (PoLP ที่ชั้นแอป)',
    };
  }
  return { layer: 'application', passed: true, detail: 'AuthN + AuthZ ผ่าน' };
}

function dataLayer(ctx: RequestContext): LayerResult {
  if (ctx.wantsAdminData && ctx.role === 'admin') {
    return {
      layer: 'data',
      passed: true,
      detail: 'ถอดรหัส field ระดับ Restricted ให้ admin เท่านั้น',
    };
  }
  return {
    layer: 'data',
    passed: true,
    detail: 'คืนข้อมูลแบบ mask (เช่น บัตร ****-1234)',
  };
}

const LAYERS = [networkLayer, hostLayer, applicationLayer, dataLayer] as const;

export function defend(ctx: RequestContext): {
  allowed: boolean;
  results: LayerResult[];
} {
  const results: LayerResult[] = [];
  for (const layer of LAYERS) {
    const result = layer(ctx);
    results.push(result);
    if (!result.passed) {
      return { allowed: false, results };
    }
  }
  return { allowed: true, results };
}

export function demoDefenseInDepth(): void {
  console.log('\n=== Defense in Depth Demo ===\n');

  const attacks: RequestContext[] = [
    {
      ip: '203.0.113.66',
      path: '/api/profile',
      authenticated: true,
      role: 'user',
      payload: '',
      wantsAdminData: false,
    },
    {
      ip: '198.51.100.10',
      path: '/api/files',
      authenticated: true,
      role: 'user',
      payload: '../../etc/passwd',
      wantsAdminData: false,
    },
    {
      ip: '198.51.100.10',
      path: '/api/admin/secrets',
      authenticated: true,
      role: 'user',
      payload: '',
      wantsAdminData: true,
    },
    {
      ip: '198.51.100.10',
      path: '/api/admin/secrets',
      authenticated: true,
      role: 'admin',
      payload: '',
      wantsAdminData: true,
    },
  ];

  for (const [i, ctx] of attacks.entries()) {
    const outcome = defend(ctx);
    console.log(`Scenario #${i + 1}: allowed=${outcome.allowed}`);
    for (const r of outcome.results) {
      console.log(` [${r.layer}] ${r.passed ? 'PASS' : 'BLOCK'} — ${r.detail}`);
    }
  }
}
