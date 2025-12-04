import * as crypto from 'crypto';

/**
 * Generate a hash from a string
 * @param input - Input string to hash
 * @param algorithm - Hash algorithm (default: sha256)
 */
export function hash(input: string, algorithm: string = 'sha256'): string {
  return crypto.createHash(algorithm).update(input).digest('hex');
}

/**
 * Generate a random hash
 * @param length - Length of the hash
 */
export function randomHash(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}
