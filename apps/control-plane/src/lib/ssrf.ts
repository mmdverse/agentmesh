import { validateUrlForSSRF } from "@agentmesh/core";

export function assertUrlSafe(url: string, opts: { allowPrivate?: boolean; allowLoopback?: boolean } = {}): void {
  const result = validateUrlForSSRF(url, {
    allowPrivate: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
    allowLoopback: opts.allowLoopback ?? process.env.NODE_ENV !== "production",
  });
  if (!result.allowed) {
    throw new Error(`SSRF blocked: ${result.reason} - ${url}`);
  }
}

export function isUrlSafe(url: string, opts: { allowPrivate?: boolean; allowLoopback?: boolean } = {}): boolean {
  const result = validateUrlForSSRF(url, {
    allowPrivate: opts.allowPrivate ?? process.env.NODE_ENV !== "production",
    allowLoopback: opts.allowLoopback ?? process.env.NODE_ENV !== "production",
  });
  return result.allowed;
}
