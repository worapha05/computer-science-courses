export interface QueryParts {
  text: string;
  params: unknown[];
}

export function vulnerableFindUserByEmail(email: string): string {
  return `SELECT id, email, role FROM users WHERE email = '${email}';`;
}

export function safeFindUserByEmail(email: string): QueryParts {
  return {
    text: 'SELECT id, email, role FROM users WHERE email = $1',
    params: [email],
  };
}

const SORTABLE = new Set(['created_at', 'email', 'id'] as const);
type SortColumn = 'created_at' | 'email' | 'id';

export function safeListUsers(sortBy: string, direction: string): QueryParts | { error: string } {
  if (!SORTABLE.has(sortBy as SortColumn)) {
    return { error: 'sort column ไม่อยู่ใน allowlist' };
  }
  const dir = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return {
    text: `SELECT id, email FROM users ORDER BY ${sortBy} ${dir}`,
    params: [],
  };
}

export function demoInjection(): void {
  console.log('\n=== SQL Injection: Vulnerable vs Safe ===\n');

  const attack = "admin'--";
  const evil = "' OR '1'='1";

  console.log('vulnerable:', vulnerableFindUserByEmail(attack));
  console.log(' → คอมเมนต์ส่วนเงื่อนไขท้าย ทำให้ logic เปลี่ยนได้\n');

  console.log('vulnerable (dump):', vulnerableFindUserByEmail(evil));
  console.log(' → อาจคืนทุกแถว\n');

  console.log('safe:', safeFindUserByEmail(evil));
  console.log(' → email ทั้งก้อนเป็นค่า parameter ไม่ใช่โค้ด SQL\n');

  console.log('ORDER BY allowlist:', safeListUsers('email', 'DESC'));
  console.log('ORDER BY reject:', safeListUsers('password_hash; DROP TABLE users;--', 'ASC'));
}
