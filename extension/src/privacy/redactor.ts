import type { Box, PiiCandidate } from "./types";

/**
 * Applies opaque redaction directly to an ImageData buffer.
 * This is intentionally simple and deterministic for the browser prototype.
 * A later UI layer can render placeholders over the redacted regions.
 */
export function redactImageData(image: ImageData, candidates: PiiCandidate[]): ImageData {
  const output = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  const ctxCanvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(image.width, image.height) : document.createElement("canvas");
  ctxCanvas.width = image.width;
  ctxCanvas.height = image.height;
  const ctx = ctxCanvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create 2D canvas for redaction");

  ctx.putImageData(output, 0, 0);
  ctx.fillStyle = "#000000";
  for (const candidate of candidates) {
    fillClampedRect(ctx, candidate.box, image.width, image.height);
  }

  return ctx.getImageData(0, 0, image.width, image.height);
}

function fillClampedRect(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, box: Box, width: number, height: number): void {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const right = Math.min(width, Math.ceil(box.x + box.width));
  const bottom = Math.min(height, Math.ceil(box.y + box.height));
  if (right <= x || bottom <= y) return;
  ctx.fillRect(x, y, right - x, bottom - y);
}
