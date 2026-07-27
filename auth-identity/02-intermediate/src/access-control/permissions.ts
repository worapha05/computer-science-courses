/** Canonical permission strings used by the demo API. */
export const PERMISSIONS = {
  INVOICES_READ: 'invoices:read',
  INVOICES_WRITE: 'invoices:write',
  INVOICES_DELETE: 'invoices:delete',
  INVOICES_REFUND: 'invoices:refund',
  USERS_READ: 'users:read',
  ADMIN_ALL: 'admin:*',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Role → permissions map (hierarchical via expansion). */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  viewer: [PERMISSIONS.INVOICES_READ],
  accountant: [PERMISSIONS.INVOICES_READ, PERMISSIONS.INVOICES_WRITE],
  finance_manager: [
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_WRITE,
    PERMISSIONS.INVOICES_REFUND,
  ],
  admin: [
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_WRITE,
    PERMISSIONS.INVOICES_DELETE,
    PERMISSIONS.INVOICES_REFUND,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.ADMIN_ALL,
  ],
};
