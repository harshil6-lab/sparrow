import type { PhotoTicket, UploadProgress } from "./api/data";

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function buildPhotoUploadPayload(contentType: string, size: number) {
  return { contentType, size };
}

export function buildPhotoAttachPayload(key: string) {
  return { key };
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("photo could not be read"));
    };
    image.src = url;
  });
}

export async function compressBillPhoto(file: Blob): Promise<Blob> {
  if (!PHOTO_TYPES.includes(file.type as (typeof PHOTO_TYPES)[number])) {
    throw new Error("unsupported photo type");
  }
  const image = await loadImage(file);
  const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("photo could not be compressed");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.8, 0.65, 0.5, 0.35, 0.2]) {
    const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (result && result.size <= PHOTO_MAX_BYTES) return result;
  }
  throw new Error("photo is too large");
}

export function uploadToPhotoTicket(
  ticket: PhotoTicket,
  file: Blob,
  onProgress?: UploadProgress,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", ticket.url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`photo upload failed: ${request.status}`));
    };
    request.onerror = () => reject(new Error("photo upload failed"));
    const form = new FormData();
    Object.entries(ticket.fields).forEach(([name, value]) => form.append(name, value));
    form.append("file", file);
    request.send(form);
  });
}
