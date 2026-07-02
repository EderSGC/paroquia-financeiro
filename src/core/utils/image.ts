const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const BRAND_IMAGE_SRC = "/brand-identity.png";

export function getImageMimeType(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "png";
  return MIME_TYPES[extension] ?? "image/png";
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function createDataUrl(path: string, bytes: Uint8Array) {
  return `data:${getImageMimeType(path)};base64,${bytesToBase64(bytes)}`;
}
