import { loadControlPlaneConfig } from "@agentmesh/config";
import { initTelemetry } from "@agentmesh/telemetry";
import { buildApp } from "./app.js";

async function main() {
  const config = loadControlPlaneConfig();

  initTelemetry({
    serviceName: config.OTEL_SERVICE_NAME,
    serviceVersion: config.VERSION,
    otlpEndpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    enabled: !!config.OTEL_EXPORTER_OTLP_ENDPOINT,
    logLevel: config.NODE_ENV === "development" ? "info" : "warn",
  });

  const app = await buildApp({ config });

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`[control-plane] received ${signal}, shutting down...`);
      try {
        await app.close();
        console.log("[control-plane] closed gracefully");
        process.exit(0);
      } catch (err) {
        console.error("[control-plane] error during shutdown", err);
        process.exit(1);
      }
    });
  });

  try {
    await app.listen({ port: config.CONTROL_PLANE_PORT, host: config.CONTROL_PLANE_HOST });
    console.log(`[control-plane] listening on http://${config.CONTROL_PLANE_HOST}:${config.CONTROL_PLANE_PORT}`);
    console.log(`[control-plane] health: http://${config.CONTROL_PLANE_HOST}:${config.CONTROL_PLANE_PORT}/health`);
    console.log(`[control-plane] v1 health: http://${config.CONTROL_PLANE_HOST}:${config.CONTROL_PLANE_PORT}/v1/health`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
