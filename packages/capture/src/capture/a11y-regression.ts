export interface FlatViolation {
  ruleId: string;
  impact: string;
  description: string;
  helpUrl: string;
  cssSelector: string;
  html: string;
  fingerprint: string;
  url: string;
  viewport: string;
  browser: string;
}

export interface ClassifiedViolations {
  newViolations: FlatViolation[];
  fixedFingerprints: string[];
  existingViolations: FlatViolation[];
}

/**
 * Classify violations by comparing current fingerprints against a previous baseline.
 *
 * - NEW: fingerprint in current but not in previous
 * - FIXED: fingerprint in previous but not in current
 * - EXISTING: fingerprint in both
 *
 * On first capture (isFirstCapture=true), ALL violations are classified as EXISTING
 * to establish a baseline without triggering alerts.
 */
export function classifyViolations(
  current: FlatViolation[],
  previousFingerprints: Set<string>,
  isFirstCapture: boolean,
): ClassifiedViolations {
  if (isFirstCapture) {
    return {
      newViolations: [],
      fixedFingerprints: [],
      existingViolations: [...current],
    };
  }

  const currentFingerprints = new Set(current.map((v) => v.fingerprint));

  const newViolations: FlatViolation[] = [];
  const existingViolations: FlatViolation[] = [];

  for (const violation of current) {
    if (previousFingerprints.has(violation.fingerprint)) {
      existingViolations.push(violation);
    } else {
      newViolations.push(violation);
    }
  }

  const fixedFingerprints: string[] = [];
  for (const fp of previousFingerprints) {
    if (!currentFingerprints.has(fp)) {
      fixedFingerprints.push(fp);
    }
  }

  return { newViolations, fixedFingerprints, existingViolations };
}
