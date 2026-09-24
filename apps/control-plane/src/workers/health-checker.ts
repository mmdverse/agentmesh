import { getRegistryRepository } from "../modules/registry/repository.js";
import { getRegistryService } from "../modules/registry/service.js";

export interface HealthCheckerConfig {
  intervalMs?: number;
  ttlMs?: number;
  enabled?: boolean;
}

export class HealthChecker {
  private interval: NodeJS.Timeout | null = null;
  private config: Required<HealthCheckerConfig>;

  constructor(config: HealthCheckerConfig = {}) {
    this.config = {
      intervalMs: config.intervalMs ?? 30000,
      ttlMs: config.ttlMs ?? 120000,
      enabled: config.enabled ?? true,
    };
  }

  start(): void {
    if (!this.config.enabled) {
      console.log("[health-checker] disabled");
      return;
    }

    console.log(
      `[health-checker] starting with interval ${this.config.intervalMs}ms, ttl ${this.config.ttlMs}ms`
    );

    this.interval = setInterval(async () => {
      try {
        await this.check();
      } catch (err) {
        console.error("[health-checker] error during check", err);
      }
    }, this.config.intervalMs);

    // Don't block exit
    if (this.interval && (this.interval as any).unref) {
      (this.interval as any).unref();
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log("[health-checker] stopped");
    }
  }

  private async check(): Promise<void> {
    const repo = getRegistryRepository();
    const service = getRegistryService();

    // List all agents (in-memory or postgres)
    const { agents } = await repo.list({ limit: 1000 });

    const now = Date.now();
    let unhealthyCount = 0;
    let healthyCount = 0;

    for (const agent of agents) {
      const lastSeen = agent.lastSeenAt ? new Date(agent.lastSeenAt).getTime() : 0;
      const elapsed = now - lastSeen;

      // If TTL is set and elapsed > TTL, mark unhealthy
      // If no TTL, use global TTL
      const ttl = agent.ttlSeconds ? agent.ttlSeconds * 1000 : this.config.ttlMs;

      if (elapsed > ttl) {
        if (agent.health !== "UNHEALTHY") {
          console.log(
            `[health-checker] marking agent ${agent.id} (${agent.name}) as UNHEALTHY - last seen ${Math.round(elapsed / 1000)}s ago`
          );
          await service.updateHealth(agent.id, "UNHEALTHY");
          unhealthyCount++;
        }
      } else if (elapsed < ttl / 2) {
        // If recently seen and currently unhealthy, mark healthy
        if (agent.health === "UNHEALTHY") {
          console.log(
            `[health-checker] marking agent ${agent.id} (${agent.name}) as HEALTHY - recovered`
          );
          await service.updateHealth(agent.id, "HEALTHY");
          healthyCount++;
        }
      }
    }

    if (unhealthyCount > 0 || healthyCount > 0) {
      console.log(
        `[health-checker] check done: ${unhealthyCount} -> UNHEALTHY, ${healthyCount} -> HEALTHY, total ${agents.length}`
      );
    }
  }
}

let checkerInstance: HealthChecker | null = null;

export function getHealthChecker(): HealthChecker {
  if (!checkerInstance) checkerInstance = new HealthChecker();
  return checkerInstance;
}
