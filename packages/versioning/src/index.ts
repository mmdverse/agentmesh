/**
 * Versioning - Production-grade version resolution for AgentMesh
 * Supports: semver, latest, stable, specific version, minimum version, canary, compatibility rules
 */

import { z } from "zod";

export const VersionSelectionStrategySchema = z.enum([
  "latest",
  "stable",
  "specific",
  "minimum",
  "canary",
  "max_satisfying",
]);

export type VersionSelectionStrategy = z.infer<typeof VersionSelectionStrategySchema>;

export interface VersionedAgent {
  id: string;
  name: string;
  version: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface VersionConstraint {
  strategy: VersionSelectionStrategy;
  version?: string; // for specific/minimum/max_satisfying
  range?: string; // semver range like ^1.0.0, >=2.0.0 <3.0.0
  allowPrerelease?: boolean;
  preferStable?: boolean;
}

export interface CompatibilityRule {
  id: string;
  agentName: string;
  fromVersion: string;
  toVersion: string;
  compatible: boolean;
  reason?: string;
}

// Simple semver parsing - no external dep to keep lightweight
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

export function parseSemVer(v: string): SemVer | null {
  const cleaned = v.trim().replace(/^v/, "");
  // regex for semver: major.minor.patch[-prerelease][+build]
  const m = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/);
  if (!m) {
    // try to parse as major.minor or major
    const simple = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!simple) return null;
    return {
      major: parseInt(simple[1], 10),
      minor: simple[2] ? parseInt(simple[2], 10) : 0,
      patch: simple[3] ? parseInt(simple[3], 10) : 0,
      raw: v,
    };
  }
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4],
    build: m[5],
    raw: v,
  };
}

export function compareSemVer(a: string, b: string): number {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);
  if (!pa && !pb) return a.localeCompare(b);
  if (!pa) return -1;
  if (!pb) return 1;

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  // prerelease handling: version without prerelease is greater than with prerelease
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && !pb.prerelease) return -1;
  if (pa.prerelease && pb.prerelease) {
    return pa.prerelease.localeCompare(pb.prerelease);
  }
  return 0;
}

export function isStableVersion(v: string): boolean {
  const parsed = parseSemVer(v);
  if (!parsed) return false;
  // stable = no prerelease and not containing canary/beta/alpha/rc
  if (parsed.prerelease) {
    const pre = parsed.prerelease.toLowerCase();
    if (pre.includes("canary") || pre.includes("beta") || pre.includes("alpha") || pre.includes("rc")) return false;
    // any prerelease is considered unstable unless explicitly allowed
    return false;
  }
  const lower = v.toLowerCase();
  return !lower.includes("canary") && !lower.includes("-dev") && !lower.includes("-beta") && !lower.includes("-alpha");
}

export function isCanaryVersion(v: string): boolean {
  return v.toLowerCase().includes("canary");
}

export function satisfiesRange(version: string, range: string): boolean {
  // Simplified range support: ^, ~, >=, >, <=, <, =, *, x
  // For full semver we would need library, but implement common cases
  const v = parseSemVer(version);
  if (!v) return false;

  const trimmed = range.trim();

  if (trimmed === "*" || trimmed === "x" || trimmed === "") return true;

  // Handle OR (||)
  if (trimmed.includes("||")) {
    return trimmed.split("||").some((r) => satisfiesRange(version, r.trim()));
  }

  // Handle AND (space separated)
  if (trimmed.includes(" ")) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length > 1 && !parts.some((p) => p.startsWith("^") || p.startsWith("~"))) {
      return parts.every((p) => satisfiesRange(version, p));
    }
  }

  if (trimmed.startsWith("^")) {
    const base = parseSemVer(trimmed.slice(1));
    if (!base) return false;
    if (v.major !== base.major) return false;
    if (v.major === 0) {
      if (v.minor !== base.minor) return false;
      return v.patch >= base.patch;
    }
    // major >=0, minor must be >= base if same major, etc.
    return compareSemVer(version, trimmed.slice(1)) >= 0;
  }

  if (trimmed.startsWith("~")) {
    const base = parseSemVer(trimmed.slice(1));
    if (!base) return false;
    if (v.major !== base.major) return false;
    if (v.minor !== base.minor) return false;
    return v.patch >= base.patch;
  }

  if (trimmed.startsWith(">=")) {
    return compareSemVer(version, trimmed.slice(2).trim()) >= 0;
  }
  if (trimmed.startsWith(">")) {
    return compareSemVer(version, trimmed.slice(1).trim()) > 0;
  }
  if (trimmed.startsWith("<=")) {
    return compareSemVer(version, trimmed.slice(2).trim()) <= 0;
  }
  if (trimmed.startsWith("<")) {
    return compareSemVer(version, trimmed.slice(1).trim()) < 0;
  }
  if (trimmed.startsWith("=") || trimmed.startsWith("v")) {
    const clean = trimmed.replace(/^=v?/, "").replace(/^v/, "");
    return compareSemVer(version, clean) === 0;
  }

  // exact match
  return compareSemVer(version, trimmed) === 0;
}

export class VersionResolver {
  constructor(private compatibilityRules: CompatibilityRule[] = []) {}

  addCompatibilityRule(rule: CompatibilityRule): void {
    this.compatibilityRules.push(rule);
  }

  resolve(agents: VersionedAgent[], constraint: VersionConstraint): VersionedAgent | null {
    if (agents.length === 0) return null;

    let filtered = [...agents];

    // Filter prerelease if not allowed
    if (constraint.allowPrerelease === false) {
      filtered = filtered.filter((a) => isStableVersion(a.version));
    }

    if (constraint.preferStable) {
      const stable = filtered.filter((a) => isStableVersion(a.version));
      if (stable.length > 0) filtered = stable;
    }

    switch (constraint.strategy) {
      case "latest":
        return this.getLatest(filtered);

      case "stable":
        return this.getStableLatest(filtered);

      case "specific":
        if (!constraint.version) throw new Error("specific strategy requires version");
        return filtered.find((a) => a.version === constraint.version) ?? null;

      case "minimum":
        if (!constraint.version) throw new Error("minimum strategy requires version");
        return this.getMinimumSatisfying(filtered, constraint.version);

      case "canary":
        return this.getCanaryLatest(filtered);

      case "max_satisfying":
        if (!constraint.range) throw new Error("max_satisfying requires range");
        return this.getMaxSatisfying(filtered, constraint.range);

      default:
        return this.getLatest(filtered);
    }
  }

  resolveAll(agents: VersionedAgent[], constraint: VersionConstraint): VersionedAgent[] {
    if (agents.length === 0) return [];

    let filtered = [...agents];

    if (constraint.allowPrerelease === false) {
      filtered = filtered.filter((a) => isStableVersion(a.version));
    }

    if (constraint.preferStable) {
      const stable = filtered.filter((a) => isStableVersion(a.version));
      if (stable.length > 0) filtered = stable;
    }

    switch (constraint.strategy) {
      case "specific":
        if (!constraint.version) return filtered;
        return filtered.filter((a) => a.version === constraint.version);

      case "minimum":
        if (!constraint.version) return filtered;
        return filtered
          .filter((a) => compareSemVer(a.version, constraint.version!) >= 0)
          .sort((a, b) => compareSemVer(b.version, a.version));

      case "max_satisfying":
        if (!constraint.range) return filtered;
        return filtered
          .filter((a) => satisfiesRange(a.version, constraint.range!))
          .sort((a, b) => compareSemVer(b.version, a.version));

      case "stable":
        return filtered.filter((a) => isStableVersion(a.version)).sort((a, b) => compareSemVer(b.version, a.version));

      case "canary":
        return filtered.filter((a) => isCanaryVersion(a.version)).sort((a, b) => compareSemVer(b.version, a.version));

      case "latest":
      default:
        return filtered.sort((a, b) => compareSemVer(b.version, a.version));
    }
  }

  isCompatible(fromVersion: string, toVersion: string, agentName: string): boolean {
    // Check explicit rules first
    for (const rule of this.compatibilityRules) {
      if (
        rule.agentName === agentName &&
        rule.fromVersion === fromVersion &&
        rule.toVersion === toVersion
      ) {
        return rule.compatible;
      }
    }

    // Default compatibility: same major version is compatible (semver)
    const from = parseSemVer(fromVersion);
    const to = parseSemVer(toVersion);
    if (!from || !to) return true; // if not semver, assume compatible

    // Major 0 is special - minor must match
    if (from.major === 0 && to.major === 0) {
      return from.minor === to.minor;
    }

    return from.major === to.major;
  }

  private getLatest(agents: VersionedAgent[]): VersionedAgent | null {
    if (agents.length === 0) return null;
    return agents.reduce((latest, curr) => (compareSemVer(curr.version, latest.version) > 0 ? curr : latest));
  }

  private getStableLatest(agents: VersionedAgent[]): VersionedAgent | null {
    const stable = agents.filter((a) => isStableVersion(a.version));
    if (stable.length === 0) return this.getLatest(agents); // fallback to latest if no stable
    return this.getLatest(stable);
  }

  private getCanaryLatest(agents: VersionedAgent[]): VersionedAgent | null {
    const canary = agents.filter((a) => isCanaryVersion(a.version));
    if (canary.length === 0) return null;
    return this.getLatest(canary);
  }

  private getMinimumSatisfying(agents: VersionedAgent[], minVersion: string): VersionedAgent | null {
    const satisfying = agents.filter((a) => compareSemVer(a.version, minVersion) >= 0);
    if (satisfying.length === 0) return null;
    // Return minimum that satisfies
    return satisfying.reduce((min, curr) => (compareSemVer(curr.version, min.version) < 0 ? curr : min));
  }

  private getMaxSatisfying(agents: VersionedAgent[], range: string): VersionedAgent | null {
    const satisfying = agents.filter((a) => satisfiesRange(a.version, range));
    if (satisfying.length === 0) return null;
    return this.getLatest(satisfying);
  }
}

// Singleton for convenience
let defaultResolver: VersionResolver | null = null;

export function getVersionResolver(): VersionResolver {
  if (!defaultResolver) defaultResolver = new VersionResolver();
  return defaultResolver;
}

export function createVersionResolver(rules?: CompatibilityRule[]): VersionResolver {
  return new VersionResolver(rules);
}
