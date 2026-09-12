import type {
  Box,
  OcrWord,
  PageElement,
  PiiCandidate,
  PiiClass,
  VisualCandidate,
} from "./types";

const EMAIL_RE = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$/i;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const DOB_RE = /^(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)\d{2}$/;
const PHONE_RE = /^(?:\+91[- ]?)?[6-9]\d{9}$/;

export function detectDomPii(elements: PageElement[]): PiiCandidate[] {
  const candidates: PiiCandidate[] = [];

  for (const element of elements) {
    const type = (element.type ?? "").toLowerCase();
    const autocomplete = (element.autocomplete ?? "").toLowerCase();
    const label = [element.label, element.placeholder, element.name, element.text]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (type === "password" || /password|passcode|pin\b/.test(label) || autocomplete.includes("current-password") || autocomplete.includes("new-password")) {
      candidates.push(makeCandidate(element, "PASSWORD", element.value ?? "", 1, "dom"));
      continue;
    }

    if (type === "email" || autocomplete.includes("email")) {
      const value = element.value ?? "";
      candidates.push(makeCandidate(element, "EMAIL", value, 0.99, "dom"));
      continue;
    }

    if (autocomplete.includes("tel") || autocomplete.includes("tel-national") || /phone|mobile|telephone/.test(label)) {
      candidates.push(makeCandidate(element, "PHONE", element.value ?? "", 0.98, "dom"));
      continue;
    }

    if (autocomplete.includes("cc-number") || autocomplete.includes("cc-csc") || autocomplete.includes("cc-exp")) {
      candidates.push(makeCandidate(element, "CARD", element.value ?? "", 0.99, "dom"));
      continue;
    }

    if (autocomplete.includes("street-address") || autocomplete.includes("postal-code") || /address|street|pincode|zip code|postal/.test(label)) {
      candidates.push(makeCandidate(element, "ADDRESS", element.value ?? element.text ?? "", 0.9, "dom"));
      continue;
    }

    if (/aadhaar|aadhar/.test(label)) {
      candidates.push(makeCandidate(element, "AADHAAR", element.value ?? "", 0.97, "dom"));
      continue;
    }

    if (/\bpan\b/.test(label)) {
      candidates.push(makeCandidate(element, "PAN", element.value ?? "", 0.97, "dom"));
      continue;
    }

    if (/\baccount\b|bank account/.test(label)) {
      candidates.push(makeCandidate(element, "ACCOUNT", element.value ?? "", 0.9, "dom"));
    }
  }

  return candidates.filter((candidate) => candidate.value.trim().length > 0 || candidate.piiClass === "PASSWORD");
}

export function detectOcrPii(words: OcrWord[]): PiiCandidate[] {
  const candidates: PiiCandidate[] = [];

  for (let start = 0; start < words.length; start += 1) {
    for (let end = start; end < Math.min(words.length, start + 4); end += 1) {
      const group = words.slice(start, end + 1);
      const text = group.map((word) => word.text).join(" ").trim();
      const match = classifyStructured(text);
      if (!match) continue;

      candidates.push({
        id: `ocr-${start}-${end}`,
        piiClass: match.piiClass,
        box: unionBox(group.map((word) => word.box)),
        confidence: average(group.map((word) => word.confidence)),
        source: "ocr",
        placeholder: "",
        value: match.value,
      });
    }
  }

  return dedupeOverlaps(candidates);
}

export function detectVisualPii(candidates: VisualCandidate[]): PiiCandidate[] {
  return candidates
    .filter((candidate) => /face|person|passport|id|document/i.test(candidate.label))
    .map((candidate, index) => ({
      id: `vision-${index + 1}`,
      piiClass: /face|person/i.test(candidate.label) ? "PERSON" : "ADDRESS",
      box: candidate.bbox,
      confidence: candidate.confidence,
      source: "vision",
      placeholder: "",
      value: candidate.label,
    }));
}

function classifyStructured(text: string): { piiClass: PiiClass; value: string } | null {
  const compact = text.replace(/\s+/g, "");
  const digits = text.replace(/\D/g, "");
  const upper = compact.toUpperCase();

  if (/^\d{12}$/.test(digits) && /^[\d -]+$/.test(text) && verhoeffValid(digits)) {
    return { piiClass: "AADHAAR", value: digits };
  }
  if (PAN_RE.test(upper)) return { piiClass: "PAN", value: upper };
  if (/^[\d -]{13,25}$/.test(text) && digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
    return { piiClass: "CARD", value: digits };
  }
  if (EMAIL_RE.test(text)) return { piiClass: "EMAIL", value: text.toLowerCase() };
  if (PHONE_RE.test(compact)) return { piiClass: "PHONE", value: digits.slice(-10) };
  if (IFSC_RE.test(upper)) return { piiClass: "IFSC", value: upper };
  if (DOB_RE.test(compact)) return { piiClass: "DOB", value: compact };
  if (/^[\d -]+$/.test(text) && /^\d{9,18}$/.test(digits)) {
    return { piiClass: "ACCOUNT", value: digits };
  }
  return null;
}

function makeCandidate(
  element: PageElement,
  piiClass: PiiClass,
  value: string,
  confidence: number,
  source: "dom",
): PiiCandidate {
  return {
    id: `dom-${element.id}`,
    piiClass,
    box: element.bbox,
    confidence,
    source,
    placeholder: "",
    value,
  };
}

function dedupeOverlaps(candidates: PiiCandidate[]): PiiCandidate[] {
  const priority: Record<PiiClass, number> = {
    PASSWORD: 11,
    CARD: 10,
    AADHAAR: 9,
    PAN: 8,
    EMAIL: 7,
    PHONE: 6,
    IFSC: 5,
    DOB: 4,
    ACCOUNT: 3,
    PERSON: 2,
    ADDRESS: 1,
  };

  const sorted = [...candidates].sort((a, b) => priority[b.piiClass] - priority[a.piiClass] || b.confidence - a.confidence);
  const accepted: PiiCandidate[] = [];

  for (const candidate of sorted) {
    if (!accepted.some((other) => boxIoU(candidate.box, other.box) > 0.5)) accepted.push(candidate);
  }

  return accepted;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unionBox(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}

function boxIoU(a: Box, b: Box): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function luhnValid(value: string): boolean {
  let sum = 0;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if ((value.length - 1 - index) % 2 === 1) digit = digit > 4 ? digit * 2 - 9 : digit * 2;
    sum += digit;
  }
  return sum % 10 === 0;
}

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

function verhoeffValid(value: string): boolean {
  return [...value].reverse().reduce((checksum, digit, index) => D[checksum][P[index % 8][Number(digit)]], 0) === 0;
}
