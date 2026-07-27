import { ROLE_PERMISSIONS, type Permission } from './permissions.js';

export function expandRolesToPermissions(roles: string[]): Set<string> {
  const perms = new Set<string>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) perms.add(p);
  }
  return perms;
}

export function hasPermission(roles: string[], needed: Permission | string): boolean {
  const perms = expandRolesToPermissions(roles);
  if (perms.has(needed)) return true;
  if (perms.has('admin:*')) return true;

  // wildcard resource:action → resource:*
  const [resource] = needed.split(':');
  if (resource && perms.has(`${resource}:*`)) return true;
  return false;
}
