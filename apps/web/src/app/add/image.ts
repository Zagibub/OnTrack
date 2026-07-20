// Client-side photo compression (SPEC §3.6): downscale before upload, retain only a
// small thumbnail. The full-resolution original never leaves the device.

const ANALYSIS_MAX_PX = 1024;
const THUMB_MAX_PX = 320;
const THUMB_MAX_BYTES = 50 * 1024;

export interface CompressedPhoto {
  /** Larger (still compressed) image sent for analysis, then discarded. */
  analysis: string;
  /** Small retained thumbnail, kept with the saved entry (≤ ~50 KB). */
  thumbnail: string;
}

function drawScaled(source: ImageBitmap, maxPx: number): HTMLCanvasElement {
  const scale = Math.min(1, maxPx / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Approximate decoded byte size of a base64 data URL. */
function approxBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  return Math.floor(((dataUrl.length - comma - 1) * 3) / 4);
}

// WebP where supported; browsers without it fall back to PNG (the API accepts both).
function encode(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL("image/webp", quality);
}

/** Produce an analysis-grade image and a small retained thumbnail from a picked file. */
export async function compressMealPhoto(file: File): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file);
  try {
    const analysis = encode(drawScaled(bitmap, ANALYSIS_MAX_PX), 0.7);

    const thumbCanvas = drawScaled(bitmap, THUMB_MAX_PX);
    let quality = 0.7;
    let thumbnail = encode(thumbCanvas, quality);
    while (approxBytes(thumbnail) > THUMB_MAX_BYTES && quality > 0.3) {
      quality = Math.round((quality - 0.1) * 10) / 10;
      thumbnail = encode(thumbCanvas, quality);
    }
    return { analysis, thumbnail };
  } finally {
    bitmap.close();
  }
}
