/**
 * SSRF Protection - Production-grade URL validation
 * Blocks private IPs, localhost, metadata endpoints, etc.
 */

const PRIVATE_IP_RANGES = [
  /^127\./, // loopback
  /^10\./, // private 10.0.0.0/8
  /^192\.168\./, // private 192.168.0.0/16
  /^172\.(1[6-9]|2\d|3[0-1])\./, // private 172.16.0.0/12
  /^169\.254\./, // link-local + AWS metadata
  /^0\.0\.0\.0/,
  /^::1$/,
  /^fc00:/, // unique local
  /^fe80:/, // link-local
];

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "instance-data",
  "169.254.169.254",
]);

const BLOCKED_SUFFIXES = [".internal", ".local", ".localhost"];

export interface SSRFOptions {
  allowPrivate?: boolean; // allow private IPs in development
  allowLoopback?: boolean;
  allowedHosts?: string[]; // explicit allowlist
  blockedHosts?: string[]; // explicit blocklist
}

export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((re) => re.test(ip));
}

export function isBlockedHostname(hostname: string, opts: SSRFOptions = {}): boolean {
  const lower = hostname.toLowerCase();

  if (opts.allowedHosts?.includes(lower)) return false;
  if (opts.blockedHosts?.includes(lower)) return true;

  if (BLOCKED_HOSTNAMES.has(lower)) return true;

  for (const suffix of BLOCKED_SUFFIXES) {
    if (lower.endsWith(suffix)) return true;
  }

  // Check if IP and private
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lower) || lower.includes(":")) {
    if (isPrivateIP(lower)) {
      if (lower.startsWith("127.") && opts.allowLoopback) return false;
      if (opts.allowPrivate) return false;
      return true;
    }
  }

  // localhost
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") {
    if (opts.allowLoopback) return false;
    return true;
  }

  // AWS metadata
  if (lower === "169.254.169.254") return true;

  return false;
}

export function validateUrlForSSRF(urlString: string, opts: SSRFOptions = {}): { allowed: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { allowed: false, reason: "Invalid URL format" };
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(url.protocol)) {
    return { allowed: false, reason: `Protocol ${url.protocol} not allowed, only http/https` };
  }

  // Block credentials in URL
  if (url.username || url.password) {
    return { allowed: false, reason: "URL with credentials not allowed" };
  }

  // Check hostname
  if (isBlockedHostname(url.hostname, opts)) {
    return { allowed: false, reason: `Hostname ${url.hostname} is blocked (SSRF protection)` };
  }

  // Block non-standard ports that are commonly used for internal services
  const port = url.port ? parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;
  const blockedPorts = [22, 25, 3306, 5432, 6379, 11211, 27017, 9200];
  if (blockedPorts.includes(port) && !opts.allowPrivate) {
    return { allowed: false, reason: `Port ${port} is blocked` };
  }

  return { allowed: true };
}

export function assertUrlAllowed(urlString: string, opts: SSRFOptions = {}): void {
  const result = validateUrlForSSRF(urlString, opts);
  if (!result.allowed) {
    throw new Error(`SSRF blocked: ${result.reason} - ${urlString}`);
  }
}

// Webhook URL validation - stricter
export function validateWebhookUrl(urlString: string, opts: SSRFOptions = {}): { allowed: boolean; reason?: string } {
  const base = validateUrlForSSRF(urlString, opts);
  if (!base.allowed) return base;

  const url = new URL(urlString);

  // Webhooks must be https in production
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    return { allowed: false, reason: "Webhook URL must be https in production" };
  }

  // No fragments
  if (url.hash) {
    return { allowed: false, reason: "Webhook URL must not contain fragment" };
  }

  return { allowed: true };
}
