export type SessionData = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix epoch ms
  user: {
    email: string;
    name: string;
    picture?: string;
  };
};

const SALT = new TextEncoder().encode("mb-drive-session-v1");
const PBKDF2_ITERATIONS = 100_000;

let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET environment variable must be set and at least 32 characters long");
  }

  if (cachedKey && cachedSecret === secret) {
    return cachedKey;
  }

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  cachedKey = derivedKey;
  cachedSecret = secret;
  return derivedKey;
}

/**
 * Encrypts session data into a base64 string using AES-256-GCM.
 * Output format: base64(iv + ciphertext + tag)
 */
export async function seal(data: SessionData): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  const combined = Buffer.concat([Buffer.from(iv), Buffer.from(encryptedBuffer)]);
  return combined.toString("base64");
}

/**
 * Decrypts a base64 string encrypted with seal().
 * Returns null if decryption or validation fails.
 */
export async function unseal(encrypted: string): Promise<SessionData | null> {
  try {
    if (!encrypted || typeof encrypted !== "string") {
      return null;
    }

    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
      return null;
    }

    const key = await getEncryptionKey();
    const combined = Buffer.from(encrypted, "base64");

    // Must have at least 12 bytes IV + 16 bytes authentication tag
    if (combined.length < 12 + 16) {
      return null;
    }

    const iv = combined.subarray(0, 12);
    const ciphertextWithTag = combined.subarray(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertextWithTag
    );

    const text = new TextDecoder().decode(decryptedBuffer);
    const parsed = JSON.parse(text) as SessionData;

    if (
      !parsed ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.refreshToken !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      !parsed.user ||
      typeof parsed.user.email !== "string" ||
      typeof parsed.user.name !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
