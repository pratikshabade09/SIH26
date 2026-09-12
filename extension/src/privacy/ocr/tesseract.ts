import { createWorker, type Worker } from "tesseract.js";
import type { OcrWord } from "../types";
import type { OcrResult } from "./types";

export class TesseractOCR {
  private worker: Worker | null = null;

  async initialize(): Promise<void> {
    if (this.worker) return;

    this.worker = await createWorker("eng");
  }

  async recognize(
    image: string | HTMLCanvasElement,
    options?: { numericOnly?: boolean }
  ): Promise<OcrResult> {
    if (!this.worker) {
      throw new Error(
        "TesseractOCR is not initialized. Call initialize() first."
      );
    }

    const start = performance.now();

    const parameters = options?.numericOnly
  ? ({
      tessedit_char_whitelist: "0123456789 ",
    } as any)
  : undefined;
    const result = await this.worker.recognize(
      image,
      parameters,
      {
        blocks: true,
        text: true,
        hocr: false,
        tsv: false,
        osd: false,
        pdf: false,
        unlv: false,
      }
    );

    const words: OcrWord[] = [];

    for (const block of result.data.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          for (const word of line.words ?? []) {
            if (!word.text.trim()) continue;

            words.push({
              text: word.text.trim(),
              confidence: word.confidence / 100,
              box: {
                x: word.bbox.x0,
                y: word.bbox.y0,
                width: word.bbox.x1 - word.bbox.x0,
                height: word.bbox.y1 - word.bbox.y0,
              },
            });
          }
        }
      }
    }

    const confidence =
      words.length > 0
        ? words.reduce((sum, word) => sum + word.confidence, 0) /
          words.length
        : 0;

    return {
      words,
      text: result.data.text,
      confidence,
      latencyMs: performance.now() - start,
    };
  }

  async terminate(): Promise<void> {
    if (!this.worker) return;

    await this.worker.terminate();
    this.worker = null;
  }
}