import { loadGatewayConfig } from "@agentmesh/config";
import { initTelemetry } from "@agentmesh/telemetry";
import { buildApp } from "./app.js";

async function main() {
  const config = loadGatewayConfig();

  // Telemetry
  initTelemetry({
    serviceName: config.OTEL_SERVICE_NAME,
    serviceVersion: config.VERSION,
    otlpEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    enabled: !!config.OTEL_EXPORTER_OTLP_ENDPOINT,
    logLevel: config.NODE_ENV === "development" ? "info" : "warn",
  });

  const app = await buildApp({ config });

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`[gateway] received ${signal}, shutting down...`);
      try {
        await app.close();
        console.log("[gateway] closed gracefully");
        process.exit(0);
      } catch (err) {
        console.error("[gateway] error during shutdown", err);
        process.exit(1);
      }
    });
  });

  try {
    await app.listen({ port: config.GATEWAY_PORT, host: config.GATEWAY_HOST });
    console.log(`[gateway] listening on http://${config.GATEWAY_HOST}:${config.GATEWAY_PORT}`);
    console.log(`[gateway] health: http://${config.GATEWAY_HOST}:${config.GATEWAY_PORT}/health`);
    console.log(`[gateway] v1 health: http://${config.GATEWAY_HOST}:${config.GATEWAY_PORT}/v1/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
