/**
 * Observability - OpenTelemetry integration for AgentMesh
 * Traces: User -> Agent A -> Agent B -> Tool
 * Metrics: latency, errors, retries, task duration, queue time, agent utilization, success rate, timeouts
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags?: number;
  traceState?: string;
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: "internal" | "server" | "client" | "producer" | "consumer";
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, unknown>;
  status: "ok" | "error" | "unset";
  error?: { message: string; stack?: string };
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
}

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
  type: "counter" | "gauge" | "histogram";
}

// Simple in-memory tracer for Phase 4 (OTel SDK in production)

class InMemoryTracer {
  private spans = new Map<string, Span>();
  private metrics: Metric[] = [];

  startSpan(name: string, opts: { parentSpanId?: string; traceId?: string; kind?: Span["kind"]; attributes?: Record<string, unknown> } = {}): Span {
    const id = `span_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const traceId = opts.traceId ?? `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const span: Span = {
      id,
      traceId,
      parentSpanId: opts.parentSpanId,
      name,
      kind: opts.kind ?? "internal",
      startTime: Date.now(),
      attributes: opts.attributes ?? {},
      status: "unset",
      events: [],
    };

    this.spans.set(id, span);
    return span;
  }

  endSpan(spanId: string, opts: { status?: Span["status"]; error?: Error; attributes?: Record<string, unknown> } = {}): Span | null {
    const span = this.spans.get(spanId);
    if (!span) return null;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = opts.status ?? (opts.error ? "error" : "ok");
    if (opts.error) {
      span.error = { message: opts.error.message, stack: opts.error.stack };
    }
    if (opts.attributes) {
      span.attributes = { ...span.attributes, ...opts.attributes };
    }

    this.spans.set(spanId, span);

    // Record metrics
    this.recordMetric({
      name: "span_duration",
      value: span.durationMs,
      timestamp: Date.now(),
      labels: { span_name: span.name, status: span.status },
      type: "histogram",
    });

    return span;
  }

  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.events.push({ name, timestamp: Date.now(), attributes });
  }

  setAttribute(spanId: string, key: string, value: unknown): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.attributes[key] = value;
  }

  getSpan(spanId: string): Span | null {
    return this.spans.get(spanId) ?? null;
  }

  getTrace(traceId: string): Span[] {
    return Array.from(this.spans.values()).filter((s) => s.traceId === traceId);
  }

  recordMetric(metric: Metric): void {
    this.metrics.push(metric);
  }

  getMetrics(filter?: { name?: string }): Metric[] {
    if (!filter?.name) return this.metrics;
    return this.metrics.filter((m) => m.name === filter.name);
  }

  // For testing: get all spans
  getAllSpans(): Span[] {
    return Array.from(this.spans.values());
  }
}

const tracerInstance = new InMemoryTracer();

// High-level API for AgentMesh

export interface TaskTraceContext {
  traceId: string;
  rootSpanId: string;
  taskId: string;
  agentId: string;
}

export class Observability {
  private tracer = tracerInstance;

  // Start a trace for a task: User -> Agent A -> Agent B -> Tool
  startTaskTrace(taskId: string, agentId: string, parentTraceId?: string): TaskTraceContext {
    const span = this.tracer.startSpan(`task.${taskId}`, {
      traceId: parentTraceId,
      kind: "server",
      attributes: { taskId, agentId, "agentmesh.task.id": taskId, "agentmesh.agent.id": agentId },
    });

    this.tracer.addEvent(span.id, "task.started", { taskId, agentId });

    return { traceId: span.traceId, rootSpanId: span.id, taskId, agentId };
  }

  startAgentSpan(parent: TaskTraceContext, agentId: string, operation: string): Span {
    const span = this.tracer.startSpan(`agent.${agentId}.${operation}`, {
      traceId: parent.traceId,
      parentSpanId: parent.rootSpanId,
      kind: "client",
      attributes: { taskId: parent.taskId, agentId, operation, "agentmesh.agent.id": agentId },
    });
    return span;
  }

  startToolSpan(parentSpanId: string, traceId: string, toolName: string): Span {
    return this.tracer.startSpan(`tool.${toolName}`, {
      traceId,
      parentSpanId,
      kind: "client",
      attributes: { tool: toolName, "agentmesh.tool.name": toolName },
    });
  }

  endSpan(spanId: string, opts?: { error?: Error; attributes?: Record<string, unknown> }): void {
    this.tracer.endSpan(spanId, opts);
  }

  recordTaskMetrics(taskId: string, metrics: { durationMs?: number; queueTimeMs?: number; retries?: number; success?: boolean; agentId?: string }): void {
    const now = Date.now();
    const labels = { taskId, agentId: metrics.agentId ?? "unknown", success: String(metrics.success ?? true) };

    if (metrics.durationMs !== undefined) {
      this.tracer.recordMetric({ name: "task_duration", value: metrics.durationMs, timestamp: now, labels, type: "histogram" });
    }
    if (metrics.queueTimeMs !== undefined) {
      this.tracer.recordMetric({ name: "queue_time", value: metrics.queueTimeMs, timestamp: now, labels, type: "histogram" });
    }
    if (metrics.retries !== undefined) {
      this.tracer.recordMetric({ name: "task_retries", value: metrics.retries, timestamp: now, labels, type: "counter" });
    }

    this.tracer.recordMetric({ name: "task_completed", value: 1, timestamp: now, labels, type: "counter" });
  }

  recordAgentMetrics(agentId: string, metrics: { latencyMs?: number; utilization?: number; error?: boolean }): void {
    const now = Date.now();
    const labels = { agentId };

    if (metrics.latencyMs !== undefined) {
      this.tracer.recordMetric({ name: "agent_latency", value: metrics.latencyMs, timestamp: now, labels, type: "histogram" });
    }
    if (metrics.utilization !== undefined) {
      this.tracer.recordMetric({ name: "agent_utilization", value: metrics.utilization, timestamp: now, labels, type: "gauge" });
    }
    if (metrics.error) {
      this.tracer.recordMetric({ name: "agent_errors", value: 1, timestamp: now, labels, type: "counter" });
    }
  }

  // Getters for debugging / console
  getTrace(traceId: string): Span[] {
    return this.tracer.getTrace(traceId);
  }

  getMetrics(name?: string): Metric[] {
    return this.tracer.getMetrics(name ? { name } : undefined);
  }

  getAllSpans(): Span[] {
    return this.tracer.getAllSpans();
  }

  // Export in OTel-compatible format (simplified)
  exportTrace(traceId: string): { traceId: string; spans: Span[] } {
    return { traceId, spans: this.getTrace(traceId) };
  }
}

let obsInstance: Observability | null = null;

export function getObservability(): Observability {
  if (!obsInstance) obsInstance = new Observability();
  return obsInstance;
}

export function createObservability(): Observability {
  return new Observability();
}

// Middleware for Fastify to auto-trace requests
export function createTracingHook() {
  const obs = getObservability();

  return {
    onRequest: (req: any) => {
      const traceId = req.headers["x-trace-id"] ?? `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const span = obs["tracer"].startSpan(`http.${req.method} ${req.url}`, {
        traceId,
        kind: "server",
        attributes: { "http.method": req.method, "http.url": req.url, "http.trace_id": traceId },
      });
      req.traceId = traceId;
      req.spanId = span.id;
    },
    onResponse: (req: any, reply: any) => {
      if (req.spanId) {
        obs.endSpan(req.spanId, {
          attributes: { "http.status_code": reply.statusCode, "http.duration": Date.now() - obs["tracer"].getSpan(req.spanId)?.startTime! },
        });
      }
    },
  };
}
