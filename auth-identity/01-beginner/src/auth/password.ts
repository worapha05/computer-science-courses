import bcrypt from 'bcrypt';
import { hash as argon2Hash, verify as argon2Verify, type Options as Argon2Options } from 'argon2';

/**
 * Password hashing helpers.
 *
 * NEVER use MD5 / SHA-1 / plain SHA-256 for passwords.
 * Prefer Argon2id for new systems; bcrypt remains widely acceptable.
 */

export const BCRYPT_COST = 12;

const ARGON2_OPTS: Argon2Options & { raw?: false } = {
  type: 2, // argon2id
  memoryCost: 19_456, // ~19 MiB
  timeCost: 2,
  parallelism: 1,
};

export type HashAlgorithm = 'bcrypt' | 'argon2id';

export async function hashPassword(
  plain: string,
  algorithm: HashAlgorithm = 'bcrypt',
): Promise<string> {
  if (algorithm === 'argon2id') {
    return argon2Hash(plain, ARGON2_OPTS);
  }
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  // Argon2 hashes start with $argon2
  if (storedHash.startsWith('$argon2')) {
    try {
      return await argon2Verify(storedHash, plain, ARGON2_OPTS);
    } catch {
      return false;
    }
  }
  return bcrypt.compare(plain, storedHash);
}
