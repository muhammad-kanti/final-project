import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEM },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, saltRaw, keyRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let expected: Buffer;
  let salt: Buffer;
  let key: Buffer;
  try {
    salt = Buffer.from(saltRaw, "base64");
    expected = Buffer.from(keyRaw, "base64");
    key = await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password.normalize("NFKC"),
        salt,
        expected.length,
        { N, r, p, maxmem: MAX_MEM },
        (err, derived) => {
          if (err) reject(err);
          else resolve(derived);
        }
      );
    });
  } catch {
    return false;
  }

  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}