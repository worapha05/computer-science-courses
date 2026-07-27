const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  if (email.length > 254) errors.push('อีเมลยาวเกินไป');
  if (!EMAIL_RE.test(email)) errors.push('รูปแบบอีเมลไม่ถูกต้อง');
  return { ok: errors.length === 0, errors };
}

export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];
  if (username.length < 3 || username.length > 32) {
    errors.push('username ต้องยาว 3–32 ตัวอักษร');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    errors.push('username มีอักขระไม่อนุญาต');
  }
  return { ok: errors.length === 0, errors };
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function stripControlChars(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, '');
}

export function sanitizeDisplayName(raw: string): {
  sanitized: string;
  validation: ValidationResult;
} {
  const cleaned = stripControlChars(raw).trim().slice(0, 64);
  const errors: string[] = [];
  if (cleaned.length < 1) errors.push('ชื่อว่างไม่ได้');
  return {
    sanitized: escapeHtml(cleaned),
    validation: { ok: errors.length === 0, errors },
  };
}

export function demoSanitization(): void {
  console.log('\n=== Input Sanitization Demo ===\n');

  console.log('email ok:', validateEmail('user@clinic.example'));
  console.log('email bad:', validateEmail('not-an-email'));

  const xss = '<script>alert("XSS")</script>คุณหมอสมชาย';
  const { sanitized, validation } = sanitizeDisplayName(xss);
  console.log('raw:', xss);
  console.log('sanitized for HTML:', sanitized);
  console.log('validation:', validation);
  console.log('เมื่อเรนเดอร์ใน HTML จะไม่กลายเป็น script ที่รันได้');
}
