import { AgentCardSchema, type AgentCard, WELL_KNOWN_AGENT_CARD_PATH } from "./index.js";

export interface FetchCardOptions {
  timeoutMs?: number;
  allowPrivate?: boolean; // allow private IPs in dev
  allowLoopback?: boolean;
  headers?: Record<string, string>;
  validateCard?: boolean;
}

// Simple SSRF check - duplicated to avoid circular dep, but core will be used in services
function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
  if (lower === "169.254.169.254") return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  return false;
}

function validateUrl(urlString: string, opts: FetchCardOptions): void {
  const url = new URL(urlString);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Only http/https allowed, got ${url.protocol}`);
  }
  if (!opts.allowPrivate && isPrivateHost(url.hostname) && !opts.allowLoopback) {
    // In production, block. In dev, allow if flag set
    if (process.env.NODE_ENV === "production") {
      throw new Error(`SSRF blocked: private host ${url.hostname}`);
    }
    // In dev, log warning but allow if allowPrivate or allowLoopback
    if (!opts.allowPrivate && !opts.allowLoopback) {
      throw new Error(`SSRF blocked: private host ${url.hostname} (use allowPrivate in dev)`);
    }
  }
}

export async function fetchAgentCard(
  url: string,
  opts: FetchCardOptions = {}
): Promise<{ card: AgentCard; raw: unknown; url: string; fetchedAt: string }> {
  const timeout = opts.timeoutMs ?? 10000;
  validateUrl(url, opts);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AgentMesh/0.1.0 (A2A Card Fetcher)",
        ...opts.headers,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Agent Card: ${res.status} ${res.statusText} from ${url}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (
      !contentType.includes("application/json") &&
      !contentType.includes("text/json") &&
      !contentType.includes("+json")
    ) {
      // Some agents may return with text/plain, so we try anyway but warn
      console.warn(`[a2a] unexpected content-type ${contentType} for ${url}`);
    }

    const raw = await res.json();
    const parsed = opts.validateCard !== false ? AgentCardSchema.parse(raw) : (raw as AgentCard);

    return {
      card: parsed,
      raw,
      url,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if ((err as any).name === "AbortError") {
      throw new Error(`Timeout fetching Agent Card from ${url} after ${timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchWellKnownCard(
  baseUrl: string,
  opts: FetchCardOptions = {}
): Promise<{ card: AgentCard; raw: unknown; url: string; fetchedAt: string }> {
  const base = new URL(baseUrl);
  const wellKnownUrl = `${base.origin}${WELL_KNOWN_AGENT_CARD_PATH}`;
  return fetchAgentCard(wellKnownUrl, opts);
}

export async function fetchCardWithFallbacks(
  urls: string[],
  opts: FetchCardOptions = {}
): Promise<{ card: AgentCard; raw: unknown; url: string; fetchedAt: string }> {
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      return await fetchAgentCard(url, opts);
    } catch (err) {
      lastError = err as Error;
      console.warn(`[a2a] failed to fetch ${url}: ${(err as Error).message}`);
    }
  }
  throw lastError ?? new Error("No URLs provided for card fetching");
}

export function buildDiscoveryUrls(baseUrl: string): string[] {
  const base = new URL(baseUrl);
  return [
    baseUrl, // direct
    `${base.origin}${WELL_KNOWN_AGENT_CARD_PATH}`, // well-known
    `${base.origin}/.well-known/a2a.json`, // alternative
    `${base.origin}/agent.json`, // common alternative
    `${base.origin}/.well-known/agent-card.json`,
  ];
}
