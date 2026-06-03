// AES-256-GCM envelope encryption for BVN.
// The hexKey is a 64-char hex string (32 bytes) stored as the Convex
// environment variable BVN_ENCRYPTION_KEY — rotate via key-versioning (bump
// the PREFIX tag) rather than re-encrypting old rows.
//
// Uses the Web Crypto API (globalThis.crypto) which is available in Convex's
// V8 runtime. Must be called from an action, not a mutation, because
// getRandomValues() is non-deterministic.

const PREFIX = "enc:v1:";
const IV_BYTES = 12; // 96-bit IV recommended for AES-GCM

function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function toB64(buf: Uint8Array | ArrayBuffer): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...u8));
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function importKey(hexKey: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    fromHex(hexKey).buffer as ArrayBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Returns a string of the form "enc:v1:<ivB64>:<ciphertextWithTagB64>"
export async function encryptBvn(plaintext: string, hexKey: string): Promise<string> {
  const key = await importKey(hexKey);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipherBuf = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${PREFIX}${toB64(iv)}:${toB64(cipherBuf)}`;
}

export async function decryptBvn(stored: string, hexKey: string): Promise<string> {
  if (!stored.startsWith(PREFIX)) throw new Error("Unknown BVN ciphertext format");
  const rest = stored.slice(PREFIX.length);
  const sep = rest.indexOf(":");
  const iv = fromB64(rest.slice(0, sep));
  const ct = fromB64(rest.slice(sep + 1));
  const key = await importKey(hexKey);
  const plain = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, tagLength: 128 },
    key,
    ct.buffer as ArrayBuffer
  );
  return new TextDecoder().decode(plain);
}
