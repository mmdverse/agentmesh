import { createAgentServer } from "./packages/server-sdk/dist/index.js";

const server = createAgentServer({
  card: {
    name: "real-code-reviewer",
    version: "1.0.0",
    description: "Real agent for SDK test - code review + translation",
    provider: { organization: "AgentMesh Test" },
    protocolVersion: "0.2.5",
  },
  skills: [
    { id: "code-review", name: "Code Review", description: "Reviews code", tags: ["review"] },
    { id: "translate", name: "Translate", description: "Translates text", tags: ["translate"] },
  ],
  port: 9001,
  host: "0.0.0.0",
  controlPlaneUrl: process.env.CONTROL_PLANE_URL || "http://localhost:3002",
  autoRegister: true,
  heartbeatIntervalMs: 10000,
  taskHandler: async (ctx) => {
    console.log(`[real-agent] Received task ${ctx.taskId}: ${ctx.message.text}`);
    const text = ctx.message.text.toLowerCase();
    if (text.includes("review")) {
      return {
        text: `Code review result: The code looks good! Found 0 issues. Reviewed at ${new Date().toISOString()}`,
        data: { issues: 0, score: 95, suggestions: ["Add comments"] },
        state: "COMPLETED",
      };
    }
    if (text.includes("translate")) {
      return {
        text: `Translated: "${ctx.message.text}" -> Persian: "سلام دنیا"`,
        data: { source: ctx.message.text, target: "سلام دنیا", lang: "fa" },
        state: "COMPLETED",
      };
    }
    if (text.includes("fail")) {
      return { text: "Task failed intentionally", state: "FAILED" };
    }
    return {
      text: `Echo: ${ctx.message.text} (processed by real agent)`,
      data: { echo: ctx.message.text, timestamp: new Date().toISOString() },
      state: "COMPLETED",
    };
  },
});

const { app, card, url, registeredId } = await server.listen();
console.log(`[real-agent] Listening at ${url}`);
console.log(`[real-agent] Card:`, JSON.stringify(card, null, 2));
console.log(`[real-agent] Auto-registered: ${registeredId || "will register shortly"}`);
console.log(`[real-agent] Modern Luxury V2 — Black Gray White Gradient`);
