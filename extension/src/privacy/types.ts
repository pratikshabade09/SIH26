export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PiiClass =
  | "AADHAAR"
  | "PAN"
  | "CARD"
  | "EMAIL"
  | "PHONE"
  | "IFSC"
  | "ACCOUNT"
  | "DOB"
  | "PERSON"
  | "ADDRESS"
  | "PASSWORD";

export type CandidateSource = "dom" | "ocr" | "vision" | "fused";

export interface PageElement {
  id: string;
  tag: string;
  type?: string;
  label?: string;
  text?: string;
  placeholder?: string;
  autocomplete?: string;
  name?: string;
  bbox: Box;
  visible: boolean;
  value?: string;
}

export interface PageSnapshot {
  url: string;
  title: string;
  viewport: { width: number; height: number; devicePixelRatio?: number };
  elements: PageElement[];
}

export interface OcrWord {
  text: string;
  box: Box;
  confidence: number;
}

export interface VisualCandidate {
  id: string;
  label: string;
  bbox: Box;
  confidence: number;
}

export interface PiiCandidate {
  id: string;
  piiClass: PiiClass;
  box: Box;
  confidence: number;
  source: CandidateSource;
  placeholder: string;
  /** Local only. Never include this field in the sanitized payload. */
  value: string;
}

export interface SanitizedElement {
  id: string;
  tag: string;
  type?: string;
  label?: string;
  text?: string;
  placeholder?: string;
  autocomplete?: string;
  bbox: Box;
  visible: boolean;
}

export interface SanitizedContext {
  version: 1;
  page: {
    url: string;
    title: string;
    viewport: PageSnapshot["viewport"];
  };
  elements: SanitizedElement[];
  pii: Array<{
    id: string;
    piiClass: PiiClass;
    bbox: Box;
    confidence: number;
    source: CandidateSource;
    placeholder: string;
  }>;
  stats: {
    detected: number;
    redacted: number;
    rawPiiCountInPayload: number;
  };
}

export interface PrivacyResult {
  candidates: PiiCandidate[];
  sanitizedContext: SanitizedContext;
  reverseMap: Record<string, string>;
  safeToTransmit: boolean;
}
