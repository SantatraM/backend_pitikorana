import {
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
  maxmem: 64 * 1024 * 1024,
};

function randomReadableChars(length) {
  const bytes = randomBytes(length);
  return [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function generateReference() {
  return `PIT-${new Date().getUTCFullYear()}-${randomReadableChars(8)}`;
}

export function generateCodeSuivi() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  return Array.from({ length: 3 }, () => letters[randomInt(letters.length)]).join("")
    + "-" + Array.from({ length: 5 }, () => digits[randomInt(digits.length)]).join("");
}

export function normalizeCodeSuivi(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  const short = normalized.match(/^([A-HJ-NP-Z]{3})-?([2-9]{5})$/);
  if (short) return `${short[1]}-${short[2]}`;
  return /^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/.test(normalized)
    ? normalized
    : null;
}

export async function hashCodeSuivi(codeSuivi) {
  const salt = randomBytes(16);
  const hash = await scrypt(codeSuivi, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return [
    "scrypt",
    "v1",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    Buffer.from(hash).toString("base64url"),
  ].join("$");
}

export async function verifyCodeSuivi(codeSuivi, storedHash) {
  try {
    const [algorithm, version, n, r, p, saltValue, hashValue] = String(
      storedHash,
    ).split("$");
    if (
      algorithm !== "scrypt" ||
      version !== "v1" ||
      !saltValue ||
      !hashValue
    ) {
      return false;
    }

    const expectedHash = Buffer.from(hashValue, "base64url");
    const actualHash = await scrypt(codeSuivi, Buffer.from(saltValue, "base64url"), expectedHash.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    const actualBuffer = Buffer.from(actualHash);

    return (
      expectedHash.length === actualBuffer.length &&
      timingSafeEqual(expectedHash, actualBuffer)
    );
  } catch {
    return false;
  }
}

// A fixed dummy verifier keeps an unknown reference on the same scrypt path.
export const DUMMY_SUIVI_HASH = "scrypt$v1$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + Buffer.alloc(64).toString("base64url");
