import type { PiiCandidate } from "./types";

const PRIORITY = {
  PASSWORD: 100,
  CARD: 90,
  AADHAAR: 85,
  PAN: 80,
  EMAIL: 75,
  PHONE: 70,
  IFSC: 60,
  DOB: 50,
  ACCOUNT: 45,
  PERSON: 30,
  ADDRESS: 20,
} as const;

export function fusePiiCandidates(candidates: PiiCandidate[]): PiiCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    const priorityDiff = PRIORITY[b.piiClass] - PRIORITY[a.piiClass];
    return priorityDiff !== 0 ? priorityDiff : b.confidence - a.confidence;
  });

  const accepted: PiiCandidate[] = [];
  for (const candidate of sorted) {
    const overlap = accepted.some((existing) => boxIoU(candidate.box, existing.box) > 0.5);
    if (!overlap) accepted.push(candidate);
  }

  return assignPlaceholders(accepted);
}

function assignPlaceholders(candidates: PiiCandidate[]): PiiCandidate[] {
  const byKey = new Map<string, string>();
  const counts = new Map<string, number>();

  return candidates.map((candidate, index) => {
    const key = `${candidate.piiClass}:${candidate.value}`;
    let placeholder = byKey.get(key);
    if (!placeholder) {
      const count = (counts.get(candidate.piiClass) ?? 0) + 1;
      counts.set(candidate.piiClass, count);
      placeholder = `<${candidate.piiClass}_${count}>`;
      byKey.set(key, placeholder);
    }

    return {
      ...candidate,
      id: `pii-${index + 1}`,
      placeholder,
      source: candidate.source === "dom" && candidate.confidence === 1 ? "dom" : candidate.source,
    };
  });
}

function boxIoU(a: PiiCandidate["box"], b: PiiCandidate["box"]): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}
