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
    const isDev = process.env.NODE_ENV !== "production";
    this.config = {
      intervalMs: config.intervalMs ?? (isDev ? 10000 : 30000),
      ttlMs: config.ttlMs ?? (isDev ? 60000 : 120000),
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

    const { agents } = await repo.list({ limit: 1000 });

    const now = Date.now();
    let unhealthyCount = 0;
    let healthyCount = 0;

    for (const agent of agents) {
      const lastSeen = agent.lastSeenAt ? new Date(agent.lastSeenAt).getTime() : 0;
      const elapsed = now - lastSeen;
      const ttl = agent.ttlSeconds ? agent.ttlSeconds * 1000 : this.config.ttlMs;

      if (elapsed > ttl) {
        if (agent.health !== "UNHEALTHY") {
          console.log(
            `[health-checker] marking agent ${agent.id} (${agent.name}) as UNHEALTHY - last seen ${Math.round(elapsed / 1000)}s ago`
          );
          await service.updateHealth(agent.id, "UNHEALTHY");
          unhealthyCount++;
        }
      } else {
        // Recently seen - should be HEALTHY
        if (agent.health === "UNHEALTHY" || agent.health === "UNKNOWN") {
          // Try to verify agent is actually reachable
          let reachable = true;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${agent.url}/health`, { signal: controller.signal }).catch(() => null);
            clearTimeout(timeout);
            if (res && !res.ok) {
              // Try card endpoint
              const controller2 = new AbortController();
              const timeout2 = setTimeout(() => controller2.abort(), 2000);
              const res2 = await fetch(`${agent.url}/.well-known/agent.json`, { signal: controller2.signal }).catch(() => null);
              clearTimeout(timeout2);
              reachable = !!res2 && res2.ok;
            }
          } catch {
            reachable = true; // If fetch fails but lastSeen is recent, still mark healthy (dev mode)
          }

          if (reachable) {
            console.log(
              `[health-checker] marking agent ${agent.id} (${agent.name}) as HEALTHY - live (was ${agent.health})`
            );
            await service.updateHealth(agent.id, "HEALTHY");
            healthyCount++;
          }
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
