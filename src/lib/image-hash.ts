const CLIPBOARD_SEEN_HASHES_KEY = "mb.clipboardSeenHashes";
const MAX_CLIPBOARD_SEEN_HASHES = 50;

/**
 * Deterministic non-crypto hex digest used when Web Crypto SubtleCrypto is
 * unavailable (e.g., non-secure HTTP contexts).
 */
function fallbackBytesHexHash(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5 ^ bytes.length;
  let h2 = 0x9e3779b9 ^ bytes.length;
  let h3 = 0x85ebca6b ^ bytes.length;
  let h4 = 0xc2b2ae35 ^ bytes.length;

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (b + (i & 0xff)), 0x85ebca6b) >>> 0;
    h3 = Math.imul(h3 ^ (b + ((i >>> 8) & 0xff)), 0xc2b2ae35) >>> 0;
    h4 = Math.imul((h4 + b + 1) ^ (h4 >>> 13), 0x27d4eb2f) >>> 0;
  }

  const mix = (x: number): string => {
    let v = x >>> 0;
    v ^= v >>> 16;
    v = Math.imul(v, 0x85ebca6b) >>> 0;
    v ^= v >>> 13;
    v = Math.imul(v, 0xc2b2ae35) >>> 0;
    v ^= v >>> 16;
    return (v >>> 0).toString(16).padStart(8, "0");
  };

  return `${mix(h1)}${mix(h2)}${mix(h3)}${mix(h4)}`;
}

export async function computeBytesHash(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const hashBuffer = await subtle.digest("SHA-256", bytes as unknown as BufferSource);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fall through to deterministic non-crypto fallback
    }
  }
  return fallbackBytesHexHash(bytes);
}

export async function computeImageHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return computeBytesHash(new Uint8Array(buffer));
}

export function readClipboardSeenHashes(): string[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(CLIPBOARD_SEEN_HASHES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const item of parsed) {
      if (typeof item === "string" && item.length > 0) {
        if (seen.has(item)) {
          const idx = deduped.indexOf(item);
          if (idx !== -1) deduped.splice(idx, 1);
        } else {
          seen.add(item);
        }
        deduped.push(item);
      }
    }
    return deduped.slice(-MAX_CLIPBOARD_SEEN_HASHES);
  } catch {
    return [];
  }
}

export function isClipboardHashSeen(hash: string): boolean {
  if (!hash) return false;
  return readClipboardSeenHashes().includes(hash);
}

export function markClipboardHashSeen(hash: string): void {
  if (!hash) return;
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  try {
    const existing = readClipboardSeenHashes();
    const next = existing.filter((h) => h !== hash);
    next.push(hash);
    const bounded = next.slice(-MAX_CLIPBOARD_SEEN_HASHES);
    localStorage.setItem(CLIPBOARD_SEEN_HASHES_KEY, JSON.stringify(bounded));
  } catch {
    // Ignore storage quota / private browsing errors
  }
}
