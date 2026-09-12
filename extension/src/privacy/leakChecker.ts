import type { PiiCandidate, SanitizedContext } from "./types";

export interface LeakCheckResult {
  safe: boolean;
  leakedValues: string[];
  patternMatches: string[];
}

export function checkSanitizedContext(context: SanitizedContext, candidates: PiiCandidate[]): LeakCheckResult {
  const serialized = JSON.stringify(context).toLowerCase();
  const leakedValues = unique(
    candidates
      .map((candidate) => candidate.value.trim().toLowerCase())
      .filter((value) => value.length >= 4 && serialized.includes(value)),
  );

  const patternMatches = detectHighRiskPatterns(serialized);

  return {
    safe: leakedValues.length === 0 && patternMatches.length === 0,
    leakedValues,
    patternMatches,
  };
}

function detectHighRiskPatterns(serialized: string): string[] {
  const matches: string[] = [];
  if (/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/i.test(serialized)) matches.push("EMAIL-like value");
  if (/(?:\+91[- ]?)?[6-9]\d{9}/.test(serialized)) matches.push("PHONE-like value");
  if (/\b[A-Z]{5}\d{4}[A-Z]\b/i.test(serialized)) matches.push("PAN-like value");
  if (/\b\d{12}\b/.test(serialized)) matches.push("12-digit identifier");
  return matches;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
