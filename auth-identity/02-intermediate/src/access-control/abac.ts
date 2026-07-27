export interface AbacSubject {
  id: string;
  roles: string[];
  permissions: string[];
  department: string;
  refundLimit: number;
  mfa: boolean;
}

export interface AbacResource {
  type: 'invoice';
  id: string;
  ownerId: string;
  department: string;
  amount: number;
}

export interface AbacEnvironment {
  now: Date;
  ip?: string;
}

export type Decision = { allow: true } | { allow: false; reason: string };

function hourInBangkok(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

/** ABAC policy for invoice refunds (Lab 2.3). */
export function evaluateRefundPolicy(
  subject: AbacSubject,
  resource: AbacResource,
  env: AbacEnvironment,
): Decision {
  const roleOk =
    subject.roles.includes('finance_manager') ||
    subject.roles.includes('admin') ||
    subject.permissions.includes('invoices:refund');

  if (!roleOk) return { allow: false, reason: 'missing_role' };
  if (resource.department !== subject.department && !subject.roles.includes('admin')) {
    return { allow: false, reason: 'department_mismatch' };
  }
  if (resource.amount > subject.refundLimit && !subject.roles.includes('admin')) {
    return { allow: false, reason: 'amount_exceeds_limit' };
  }
  if (!subject.mfa) return { allow: false, reason: 'mfa_required' };

  const hour = hourInBangkok(env.now);
  if (hour < 9 || hour >= 18) return { allow: false, reason: 'outside_business_hours' };

  return { allow: true };
}

/** Object-level access for reading invoices (IDOR defense). */
export function canReadInvoice(
  subject: { id: string; roles: string[]; department?: string },
  invoice: { ownerId: string; department: string },
): boolean {
  if (subject.roles.includes('admin')) return true;
  if (invoice.ownerId === subject.id) return true;
  if (
    (subject.roles.includes('accountant') || subject.roles.includes('finance_manager')) &&
    subject.department === invoice.department
  ) {
    return true;
  }
  return false;
}
