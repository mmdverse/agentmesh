import { validateUrlForSSRF } from "@agentmesh/core";

export interface ProxyOptions {
  timeoutMs?: number;
  retries?: number;
  allowPrivate?: boolean;
}

export interface ProxyRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  traceId?: string;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  latencyMs: number;
}

export class A2AProxy {
  async forward(req: ProxyRequest, opts: ProxyOptions = {}): Promise<ProxyResponse> {
    const timeout = opts.timeoutMs ?? 30000;
    const url = req.url;

    // SSRF protection
    const ssrfCheck = validateUrlForSSRF(url, {
      allowPrivate: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
      allowLoopback: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
    });
    if (!ssrfCheck.allowed) {
      throw new Error(`SSRF blocked: ${ssrfCheck.reason} - ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const start = Date.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "AgentMesh-Gateway/0.1.0",
        ...(req.headers ?? {}),
      };

      if (req.traceId) {
        headers["X-Trace-Id"] = req.traceId;
        headers["X-Request-Id"] = req.traceId;
      }

      // Remove hop-by-hop headers
      delete (headers as any)["connection"];
      delete (headers as any)["keep-alive"];
      delete (headers as any)["transfer-encoding"];

      const res = await fetch(url, {
        method: req.method ?? "POST",
        headers,
        body: req.body ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;

      let body: unknown;
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json") || contentType.includes("+json")) {
        try {
          body = await res.json();
        } catch {
          body = await res.text();
        }
      } else {
        body = await res.text();
      }

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        // Filter sensitive headers
        if (!["set-cookie", "www-authenticate"].includes(key.toLowerCase())) {
          responseHeaders[key] = value;
        }
      });

      return {
        status: res.status,
        headers: responseHeaders,
        body,
        latencyMs,
      };
    } catch (err) {
      if ((err as any).name === "AbortError") {
        throw new Error(`Proxy timeout after ${timeout}ms to ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async forwardWithRetry(req: ProxyRequest, opts: ProxyOptions = {}): Promise<ProxyResponse> {
    const retries = opts.retries ?? 0;
    let lastErr: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.forward(req, opts);
      } catch (err) {
        lastErr = err as Error;
        if (attempt < retries) {
          const backoff = Math.min(1000 * 2 ** attempt, 5000);
          await new Promise((r) => setTimeout(r, backoff));
          console.warn(`[a2a-proxy] retry ${attempt + 1}/${retries} for ${req.url}: ${(err as Error).message}`);
        }
      }
    }

    throw lastErr ?? new Error("Proxy failed after retries");
  }
}

let proxyInstance: A2AProxy | null = null;

export function getA2AProxy(): A2AProxy {
  if (!proxyInstance) proxyInstance = new A2AProxy();
  return proxyInstance;
}
