import { fetchAgentCard, fetchWellKnownCard, buildDiscoveryUrls, type AgentCard } from "@agentmesh/a2a-protocol";
import { assertUrlSafe } from "./ssrf.js";

export interface CardFetchResult {
  card: AgentCard;
  raw: unknown;
  url: string;
  fetchedAt: string;
}

export async function fetchCardFromUrl(url: string, opts: { timeoutMs?: number; allowPrivate?: boolean } = {}): Promise<CardFetchResult> {
  assertUrlSafe(url, { allowPrivate: opts.allowPrivate, allowLoopback: opts.allowPrivate });
  return fetchAgentCard(url, {
    timeoutMs: opts.timeoutMs ?? 10000,
    allowPrivate: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
    allowLoopback: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
  });
}

export async function fetchCardWithDiscovery(baseUrl: string, opts: { timeoutMs?: number; allowPrivate?: boolean } = {}): Promise<CardFetchResult> {
  assertUrlSafe(baseUrl, { allowPrivate: opts.allowPrivate, allowLoopback: opts.allowPrivate });
  const urls = buildDiscoveryUrls(baseUrl);
  let lastErr: Error | null = null;
  for (const u of urls) {
    try {
      // Skip URLs that fail SSRF check
      try {
        assertUrlSafe(u, { allowPrivate: opts.allowPrivate, allowLoopback: opts.allowPrivate });
      } catch {
        continue;
      }
      return await fetchAgentCard(u, {
        timeoutMs: opts.timeoutMs ?? 8000,
        allowPrivate: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
        allowLoopback: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
      });
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error(`Failed to fetch card from any discovery URL for ${baseUrl}`);
}

export async function fetchWellKnown(baseUrl: string, opts: { timeoutMs?: number; allowPrivate?: boolean } = {}): Promise<CardFetchResult> {
  assertUrlSafe(baseUrl, { allowPrivate: opts.allowPrivate, allowLoopback: opts.allowPrivate });
  return fetchWellKnownCard(baseUrl, {
    timeoutMs: opts.timeoutMs ?? 8000,
    allowPrivate: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
    allowLoopback: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
  });
}
