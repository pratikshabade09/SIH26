import type { OcrWord } from "../types";

export interface OcrResult {
  words: OcrWord[];
  text: string;
  confidence: number;
  latencyMs: number;
}