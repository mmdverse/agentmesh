import { diag, DiagConsoleLogger, DiagLogLevel, trace, context, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { getObservability } from "@agentmesh/observability";

let sdk: NodeSDK | null = null;

export interface TelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string;
  enabled?: boolean;
  logLevel?: "none" | "error" | "warn" | "info" | "debug";
}

export function initTelemetry(config: TelemetryConfig): NodeSDK | null {
  if (config.enabled === false) {
    console.log("[telemetry] disabled");
    return null;
  }

  if (config.logLevel && config.logLevel !== "none") {
    const levelMap: Record<string, DiagLogLevel> = {
      error: DiagLogLevel.ERROR,
      warn: DiagLogLevel.WARN,
      info: DiagLogLevel.INFO,
      debug: DiagLogLevel.DEBUG,
    };
    diag.setLogger(new DiagConsoleLogger(), levelMap[config.logLevel] ?? DiagLogLevel.INFO);
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion ?? "0.1.0-phase4",
  });

  const traceExporter = config.otlpEndpoint ? new OTLPTraceExporter({ url: `${config.otlpEndpoint}/v1/traces` }) : undefined;

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log(`[telemetry] initialized for ${config.serviceName}${config.otlpEndpoint ? ` -> ${config.otlpEndpoint}` : " (no exporter, using in-memory observability)"}`);

  process.on("SIGTERM", async () => {
    try {
      await sdk?.shutdown();
    } catch {}
  });

  return sdk;
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

export function getTracer(name = "agentmesh") {
  return trace.getTracer(name);
}

export async function withSpan<T>(name: string, fn: (span: ReturnType<ReturnType<typeof getTracer>["startSpan"]>) => Promise<T>, kind = SpanKind.INTERNAL): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(name, { kind });
  const obs = getObservability();
  const internalSpan = obs["tracer"].startSpan(name, { kind: kind === SpanKind.CLIENT ? "client" : kind === SpanKind.SERVER ? "server" : "internal" });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    obs.endSpan(internalSpan.id);
    return result;
  } catch (err) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
    span.recordException(err as Error);
    obs.endSpan(internalSpan.id, { error: err as Error });
    throw err;
  } finally {
    span.end();
  }
}

export function createTraceContext() {
  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
  };
}

function generateTraceId(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function generateSpanId(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

// Re-export observability for convenience
export { getObservability, createObservability } from "@agentmesh/observability";

// Metrics helpers
export function recordLatency(metricName: string, latencyMs: number, labels: Record<string, string> = {}): void {
  const obs = getObservability();
  obs["tracer"].recordMetric({
    name: metricName,
    value: latencyMs,
    timestamp: Date.now(),
    labels,
    type: "histogram",
  });
}

export function recordCounter(metricName: string, value = 1, labels: Record<string, string> = {}): void {
  const obs = getObservability();
  obs["tracer"].recordMetric({
    name: metricName,
    value,
    timestamp: Date.now(),
    labels,
    type: "counter",
  });
}
