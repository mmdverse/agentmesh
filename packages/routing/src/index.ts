import type { RegisteredAgentCard } from "@agentmesh/a2a-protocol";
import type { TenantContext } from "@agentmesh/core";

export interface RoutingContext {
  skill?: string;
  capability?: string;
  protocolVersion?: string;
  agentVersion?: string;
  region?: string;
  tenant?: TenantContext;
  costMetadata?: Record<string, unknown>;
  userRequirements?: Record<string, unknown>;
  traceId?: string;
  sessionId?: string;
}

export interface AgentCandidate {
  agent: RegisteredAgentCard;
  score?: number;
  latencyMs?: number;
  load?: number; // 0-1
  health: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
}

export interface RoutingStrategy {
  readonly name: string;
  select(candidates: AgentCandidate[], ctx: RoutingContext): AgentCandidate | null;
}

export interface RoutingEngine {
  route(
    candidates: AgentCandidate[],
    ctx: RoutingContext,
    strategyName?: string
  ): AgentCandidate | null;
  registerStrategy(strategy: RoutingStrategy): void;
  listStrategies(): string[];
}

// Built-in strategies

export class RoundRobinStrategy implements RoutingStrategy {
  readonly name = "round_robin";
  private counter = 0;

  select(candidates: AgentCandidate[]): AgentCandidate | null {
    if (candidates.length === 0) return null;
    const healthy = candidates.filter(c => c.health === "HEALTHY" || c.health === "UNKNOWN");
    const pool = healthy.length > 0 ? healthy : candidates;
    const idx = this.counter++ % pool.length;
    return pool[idx] ?? null;
  }
}

export class LeastLoadedStrategy implements RoutingStrategy {
  readonly name = "least_loaded";
  select(candidates: AgentCandidate[]): AgentCandidate | null {
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort((a, b) => (a.load ?? 0) - (b.load ?? 0));
    return sorted[0] ?? null;
  }
}

export class LatencyAwareStrategy implements RoutingStrategy {
  readonly name = "latency_aware";
  select(candidates: AgentCandidate[]): AgentCandidate | null {
    if (candidates.length === 0) return null;
    const withLatency = candidates.filter(c => c.latencyMs !== undefined);
    if (withLatency.length === 0) return candidates[0] ?? null;
    const sorted = withLatency.sort(
      (a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity)
    );
    return sorted[0] ?? null;
  }
}

export class WeightedStrategy implements RoutingStrategy {
  readonly name = "weighted";
  constructor(private weights: Record<string, number> = {}) {}

  select(candidates: AgentCandidate[]): AgentCandidate | null {
    if (candidates.length === 0) return null;
    // simple weighted random based on score or explicit weights
    const total = candidates.reduce(
      (sum, c) => sum + (this.weights[c.agent.id] ?? c.score ?? 1),
      0
    );
    let r = Math.random() * total;
    for (const c of candidates) {
      const w = this.weights[c.agent.id] ?? c.score ?? 1;
      if (r < w) return c;
      r -= w;
    }
    return candidates[0] ?? null;
  }
}

export class CapabilityMatchStrategy implements RoutingStrategy {
  readonly name = "capability_match";
  select(candidates: AgentCandidate[], ctx: RoutingContext): AgentCandidate | null {
    if (!ctx.skill && !ctx.capability) return candidates[0] ?? null;
    const filtered = candidates.filter(c => {
      if (ctx.skill) {
        return c.agent.skills.some(s => s.id === ctx.skill || s.name === ctx.skill);
      }
      if (ctx.capability) {
        return c.agent.capabilities.extensions?.includes(ctx.capability) ?? false;
      }
      return true;
    });
    return filtered[0] ?? candidates[0] ?? null;
  }
}

export class DefaultRoutingEngine implements RoutingEngine {
  private strategies = new Map<string, RoutingStrategy>();

  constructor() {
    this.registerStrategy(new RoundRobinStrategy());
    this.registerStrategy(new LeastLoadedStrategy());
    this.registerStrategy(new LatencyAwareStrategy());
    this.registerStrategy(new WeightedStrategy());
    this.registerStrategy(new CapabilityMatchStrategy());
  }

  registerStrategy(strategy: RoutingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  listStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  route(
    candidates: AgentCandidate[],
    ctx: RoutingContext,
    strategyName = "capability_match"
  ): AgentCandidate | null {
    // Phase 0: two-stage filter + score
    // Stage 1: Filter by health, region, version if provided
    let pool = candidates.filter(c => c.health !== "UNHEALTHY");

    if (ctx.region) {
      const regional = pool.filter(c => c.agent.region === ctx.region);
      if (regional.length > 0) pool = regional;
    }

    if (ctx.agentVersion) {
      const versioned = pool.filter(c => c.agent.version === ctx.agentVersion);
      if (versioned.length > 0) pool = versioned;
    }

    // Stage 2: strategy
    const strategy = this.strategies.get(strategyName) ?? this.strategies.get("round_robin")!;
    return strategy.select(pool, ctx);
  }
}

// Factory
export function createRoutingEngine(): RoutingEngine {
  return new DefaultRoutingEngine();
}
