export type Role = 'viewer' | 'editor' | 'admin';

export type Permission =
  'docs:read' | 'docs:write' | 'docs:delete' | 'billing:read' | 'users:manage';

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  viewer: new Set(['docs:read']),
  editor: new Set(['docs:read', 'docs:write']),
  admin: new Set(['docs:read', 'docs:write', 'docs:delete', 'billing:read', 'users:manage']),
};

export interface Principal {
  id: string;
  roles: Role[];
}

export function effectivePermissions(principal: Principal): Set<Permission> {
  const perms = new Set<Permission>();
  for (const role of principal.roles) {
    for (const p of ROLE_PERMISSIONS[role]) perms.add(p);
  }
  return perms;
}

export function authorize(
  principal: Principal,
  required: Permission,
): { allowed: true } | { allowed: false; reason: string } {
  const perms = effectivePermissions(principal);
  if (!perms.has(required)) {
    return {
      allowed: false,
      reason: `PoLP: ${principal.id} ไม่มีสิทธิ์ ${required} (deny-by-default)`,
    };
  }
  return { allowed: true };
}

export function stripElevatedForEnvironment(
  principal: Principal,
  env: 'development' | 'staging' | 'production',
): Principal {
  if (env === 'production' && principal.roles.includes('admin')) {
    return {
      id: principal.id,
      roles: principal.roles.filter((r) => r !== 'admin').concat('editor'),
    };
  }
  return principal;
}

export function demoLeastPrivilege(): void {
  console.log('\n=== Least Privilege (PoLP) Demo ===\n');

  const viewer: Principal = { id: 'support-01', roles: ['viewer'] };
  const editor: Principal = { id: 'dev-02', roles: ['editor'] };

  console.log('viewer → docs:read', authorize(viewer, 'docs:read'));
  console.log('viewer → docs:delete', authorize(viewer, 'docs:delete'));
  console.log('editor → docs:write', authorize(editor, 'docs:write'));
  console.log('editor → users:manage', authorize(editor, 'users:manage'));

  const breakGlass: Principal = { id: 'ops-99', roles: ['admin'] };
  const inProd = stripElevatedForEnvironment(breakGlass, 'production');
  console.log('admin ใน production ถูกจำกัดชั่วคราว → roles=', inProd.roles);
  console.log('admin(prod) → users:manage', authorize(inProd, 'users:manage'));
}
