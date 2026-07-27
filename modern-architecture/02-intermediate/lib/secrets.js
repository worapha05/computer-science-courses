/**
 * Secret Manager จำลอง — แยก secrets ออกจากโค้ดและ env ที่ hardcode ใน repo
 * ใน production: ใช้ AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault
 */

const vault = new Map([
  ['db/orders/url', 'postgres://orders:s3cret@localhost:5432/orders'],
  ['db/payments/url', 'postgres://payments:s3cret@localhost:5432/payments'],
  ['api/payment-provider/key', 'sk_test_bootcamp_do_not_use_in_prod'],
  ['jwt/signing-key', 'bootcamp-dev-signing-key-rotate-me'],
]);

/** ดึง secret ตาม path — จำลอง latency ของ remote Secret Manager */
export async function getSecret(path, { latencyMs = 5 } = {}) {
  if (latencyMs > 0) {
    await new Promise((r) => setTimeout(r, latencyMs));
  }
  if (!vault.has(path)) {
    const err = new Error(`SecretNotFound: ${path}`);
    err.code = 'SecretNotFound';
    throw err;
  }
  return vault.get(path);
}

/** ใส่ secret เพิ่ม (lab / test) */
export function putSecret(path, value) {
  vault.set(path, value);
}

/** รายการ path ที่มี (อย่า log ค่า secret จริง) */
export function listSecretPaths() {
  return [...vault.keys()];
}

/**
 * Cache secrets ใน memory ของ process (warm instance)
 * ลด call ไป Secret Manager ต่อ request — แต่ต้องคิดเรื่อง rotation
 */
export function createSecretCache({ ttlMs = 60_000 } = {}) {
  const cache = new Map();

  return {
    async get(path) {
      const hit = cache.get(path);
      if (hit && Date.now() - hit.at < ttlMs) {
        return { value: hit.value, source: 'cache' };
      }
      const value = await getSecret(path);
      cache.set(path, { value, at: Date.now() });
      return { value, source: 'remote' };
    },

    invalidate(path) {
      if (path) cache.delete(path);
      else cache.clear();
    },
  };
}
