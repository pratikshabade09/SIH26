import type { VisualElement, VisionBackend } from "../../shared/types";
import type { VisionModelProvider } from "./visionModelProvider";

/**
 * LightweightFallbackProvider
 * ----------------------------
 * This is NOT a trained vision model. It is a deterministic, local
 * heuristic detector: it grids the screenshot, measures local contrast
 * per cell, and merges high-contrast adjacent cells into candidate
 * bounding boxes (the kind of regions a button, input outline, or block
 * of text tends to produce).
 *
 * It exists so Phase 1 has a genuinely working, honestly-labelled
 * perception path end-to-end before a real model is wired in
 * (ONNXVisionProvider / TransformersVisionProvider, Phase 2). Every
 * element it returns is tagged `source: "vision"` with a confidence
 * derived from measured contrast — never invented.
 */
export class LightweightFallbackProvider implements VisionModelProvider {
  readonly name = "LightweightFallbackProvider";
  readonly backend: VisionBackend;

  private readonly gridCols = 32;
  private readonly gridRows = 24;
  private readonly contrastThreshold = 18; // stddev threshold, 0-255 scale

  constructor(backend: VisionBackend) {
    this.backend = backend;
  }

  async init(): Promise<void> {
    // No model weights to load for the heuristic provider.
    return;
  }

  async detect(imageData: ImageData): Promise<VisualElement[]> {
    const { width, height, data } = imageData;
    const cellW = Math.max(1, Math.floor(width / this.gridCols));
    const cellH = Math.max(1, Math.floor(height / this.gridRows));
    const cols = Math.ceil(width / cellW);
    const rows = Math.ceil(height / cellH);

    // 1. Per-cell grayscale mean + stddev (a crude local-contrast proxy).
    const interesting: boolean[] = new Array(cols * rows).fill(false);
    const cellConfidence: number[] = new Array(cols * rows).fill(0);

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const x0 = gx * cellW;
        const y0 = gy * cellH;
        const x1 = Math.min(width, x0 + cellW);
        const y1 = Math.min(height, y0 + cellH);

        let sum = 0;
        let sumSq = 0;
        let n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const idx = (y * width + x) * 4;
            const gray =
              0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            sum += gray;
            sumSq += gray * gray;
            n++;
          }
        }
        if (n === 0) continue;
        const mean = sum / n;
        const variance = sumSq / n - mean * mean;
        const stddev = Math.sqrt(Math.max(0, variance));

        const idx = gy * cols + gx;
        if (stddev > this.contrastThreshold) {
          interesting[idx] = true;
          // Normalize a plausible confidence from contrast strength.
          cellConfidence[idx] = Math.min(0.6, 0.15 + stddev / 255);
        }
      }
    }

    // 2. Merge adjacent interesting cells into regions (flood fill).
    const visited: boolean[] = new Array(cols * rows).fill(false);
    const elements: VisualElement[] = [];
    let elementCount = 0;

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const startIdx = gy * cols + gx;
        if (!interesting[startIdx] || visited[startIdx]) continue;

        // BFS flood fill over 4-connected interesting cells.
        const stack: [number, number][] = [[gx, gy]];
        visited[startIdx] = true;
        let minX = gx, maxX = gx, minY = gy, maxY = gy;
        let confSum = 0, confN = 0;

        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          const idx = cy * cols + cx;
          confSum += cellConfidence[idx];
          confN++;
          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);

          const neighbors: [number, number][] = [
            [cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1],
          ];
          for (const [nx, ny] of neighbors) {
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const nIdx = ny * cols + nx;
            if (interesting[nIdx] && !visited[nIdx]) {
              visited[nIdx] = true;
              stack.push([nx, ny]);
            }
          }
        }

        const regionCells = (maxX - minX + 1) * (maxY - minY + 1);
        // Discard specks (noise) and near-full-page regions (not useful
        // as an "element" candidate).
        if (regionCells < 2 || regionCells > cols * rows * 0.5) continue;

        const bboxX = minX * cellW;
        const bboxY = minY * cellH;
        const bboxW = Math.min(width, (maxX - minX + 1) * cellW) ;
        const bboxH = Math.min(height, (maxY - minY + 1) * cellH);

        elementCount++;
        elements.push({
          id: `element-${elementCount}`,
          type: "unknown", // classification arrives with a real model in Phase 2
          label: "",
          bbox: { x: bboxX, y: bboxY, width: bboxW, height: bboxH },
          confidence: Number((confSum / Math.max(1, confN)).toFixed(2)),
          source: "vision",
        });
      }
    }

    // Keep the response bounded and demo-friendly.
    return elements
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 40);
  }
}
