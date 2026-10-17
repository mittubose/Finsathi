/**
 * FinSathi Security Utilities
 * Web Crypto API based PBKDF2/SHA-256 hashing, rate-limiting, and anti-tamper checksums.
 * 100% client-side, zero cloud dependencies.
 */

// Generate a random cryptographic salt
export function generateSalt(length = 16): string {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compute SHA-256 hash of a string
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash a password with salt using PBKDF2
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await window.crypto.subtle.exportKey('raw', derivedKey);
  const hashArray = Array.from(new Uint8Array(exported));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify a password against stored salt and hash
export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === storedHash;
}

// Anti-brute-force rate limiter for vault unlocking
interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

const ATTEMPTS_KEY = 'finsathi_auth_attempts';

export function checkRateLimit(): { isLocked: boolean; remainingSeconds: number } {
  try {
    const raw = sessionStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0 };
    const record: AttemptRecord = JSON.parse(raw);
    const now = Date.now();
    if (record.lockedUntil > now) {
      return { isLocked: true, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }
  } catch {
    // Ignore parse errors
  }
  return { isLocked: false, remainingSeconds: 0 };
}

export function recordFailedAttempt(): { isLocked: boolean; remainingSeconds: number } {
  try {
    const raw = sessionStorage.getItem(ATTEMPTS_KEY);
    const record: AttemptRecord = raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
    record.count += 1;

    // Progressive backoff:
    // >= 3 attempts: 10s lockout
    // >= 5 attempts: 60s lockout
    // >= 8 attempts: 300s lockout
    const now = Date.now();
    if (record.count >= 8) {
      record.lockedUntil = now + 300 * 1000;
    } else if (record.count >= 5) {
      record.lockedUntil = now + 60 * 1000;
    } else if (record.count >= 3) {
      record.lockedUntil = now + 10 * 1000;
    }

    sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(record));
    if (record.lockedUntil > now) {
      return { isLocked: true, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
    }
  } catch {
    // Ignore
  }
  return { isLocked: false, remainingSeconds: 0 };
}

export function resetFailedAttempts(): void {
  try {
    sessionStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    // Ignore
  }
}

// Compute checksum for backup export verification
export async function computeDataChecksum(payload: unknown): Promise<string> {
  const canonicalJson = JSON.stringify(payload, Object.keys(payload as object).sort());
  return sha256(canonicalJson);
}

// Sanitize user input to prevent XSS in rendered views
export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ============ RECOVERY KEY & OTP ENGINE ============

/**
 * Generate a high-entropy 24-character cryptographic Master Recovery Key.
 * Format: FS-XXXX-XXXX-XXXX-XXXX (Base32 hex characters)
 */
export function generateRecoveryKey(): string {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
  const chunks = hex.match(/.{1,4}/g) || [];
  return `FS-${chunks.join('-')}`;
}

/**
 * Normalize and validate recovery key format
 */
export function normalizeRecoveryKey(key: string): string {
  return key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Verify a recovery key against a stored SHA-256 hash
 */
export async function verifyRecoveryKey(inputKey: string, storedHash: string): Promise<boolean> {
  const normalized = normalizeRecoveryKey(inputKey);
  const computedHash = await sha256(normalized);
  return computedHash === storedHash;
}

/**
 * Generate a 6-digit numeric OTP with 10-minute expiry
 */
export interface OTPRecord {
  code: string;
  expiresAt: number;
  email: string;
}

export function generateNumericOTP(email: string, validityMinutes = 10): OTPRecord {
  const bytes = new Uint8Array(4);
  window.crypto.getRandomValues(bytes);
  const num = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0;
  const code = (num % 900000 + 100000).toString(); // Always 6 digits (100000 - 999999)
  const expiresAt = Date.now() + validityMinutes * 60 * 1000;
  
  // Cache in sessionStorage for zero-cloud client verification
  const record: OTPRecord = { code, expiresAt, email };
  sessionStorage.setItem('finsathi_recovery_otp', JSON.stringify(record));
  return record;
}

/**
 * Validate an entered OTP for an email
 */
export function verifyNumericOTP(inputCode: string, email: string): { valid: boolean; message: string } {
  try {
    const raw = sessionStorage.getItem('finsathi_recovery_otp');
    if (!raw) return { valid: false, message: 'No active OTP requested. Please request a new code.' };
    const record: OTPRecord = JSON.parse(raw);
    if (Date.now() > record.expiresAt) {
      sessionStorage.removeItem('finsathi_recovery_otp');
      return { valid: false, message: 'Recovery code expired. Please request a new code.' };
    }
    if (record.email.toLowerCase() !== email.toLowerCase()) {
      return { valid: false, message: 'Email address does not match OTP request.' };
    }
    if (record.code !== inputCode.trim()) {
      return { valid: false, message: 'Invalid recovery code. Please check your email or console.' };
    }
    // Success: consume OTP
    sessionStorage.removeItem('finsathi_recovery_otp');
    return { valid: true, message: 'Recovery code verified successfully.' };
  } catch {
    return { valid: false, message: 'Failed to verify recovery code.' };
  }
}

