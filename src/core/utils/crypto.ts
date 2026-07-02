// src/core/utils/crypto.ts
// PBKDF2 com salt aleatório via Web Crypto API (nativo no WebView Tauri)
// Formato do hash armazenado: "pbkdf2$<hex-salt>$<hex-hash>"

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const SALT_BYTES = 16;
const KEY_BYTES = 32;

async function derivarChave(senha: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: PBKDF2_HASH, salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    baseKey,
    KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derivarChave(senha, salt);
  return `pbkdf2$${toHex(salt)}$${toHex(hash)}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  // Legado: texto plano (bases muito antigas)
  if (!armazenado.startsWith("pbkdf2$") && armazenado.length < 60) {
    return senha === armazenado;
  }
  // Legado: SHA-256 sem salt (formato hex puro de 64 chars)
  if (!armazenado.startsWith("pbkdf2$")) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(senha));
    const hexLegado = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    return hexLegado === armazenado;
  }
  // Formato atual: pbkdf2$<salt>$<hash>
  const parts = armazenado.split("$");
  if (parts.length !== 3) return false;
  const salt = fromHex(parts[1]);
  const hashEsperado = fromHex(parts[2]);
  const hashCalculado = await derivarChave(senha, salt);
  // Comparação em tempo constante
  if (hashCalculado.length !== hashEsperado.length) return false;
  let diff = 0;
  for (let i = 0; i < hashCalculado.length; i++) diff |= hashCalculado[i] ^ hashEsperado[i];
  return diff === 0;
}
