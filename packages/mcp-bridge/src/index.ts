/**
 * MCP Bridge - Bridges A2A Agents <-> MCP Tools
 * A2A Agent | AgentMesh | MCP Server / Tool
 * MCP-based Agent | AgentMesh | A2A Agent
 * Keeps protocol concerns separate with clear abstraction
 */

import { z } from "zod";
import { generateId, nowIso } from "@agentmesh/core";

// MCP Types (simplified, based on MCP spec)

export const MCPToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(), // JSON Schema
});

export type MCPTool = z.infer<typeof MCPToolSchema>;

export const MCPResourceSchema = z.object({
  uri: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

export type MCPResource = z.infer<typeof MCPResourceSchema>;

export const MCPServerInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  tools: z.array(MCPToolSchema).default([]),
  resources: z.array(MCPResourceSchema).default([]),
});

export type MCPServerInfo = z.infer<typeof MCPServerInfoSchema>;

// A2A Types for bridge (simplified)

export interface A2ASkill {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  inputModes?: string[];
  outputModes?: string[];
  metadata?: Record<string, unknown>;
}

export interface A2AAgentCard {
  name: string;
  description?: string;
  version: string;
  skills: A2ASkill[];
  provider?: { organization: string };
}

// Bridge: MCP Tool -> A2A Skill

export function mcpToolToA2ASkill(tool: MCPTool): A2ASkill {
  return {
    id: `mcp_${tool.name}`,
    name: tool.name,
    description: tool.description ?? `MCP tool: ${tool.name}`,
    tags: ["mcp", "tool", tool.name],
    inputModes: ["text", "json"],
    outputModes: ["text", "json"],
    metadata: {
      origin: "mcp",
      mcpTool: tool.name,
      inputSchema: tool.inputSchema,
    },
  };
}

export function mcpServerToA2ACard(server: MCPServerInfo, endpoint: string): A2AAgentCard {
  return {
    name: server.name,
    description: `MCP Server ${server.name} v${server.version} bridged via AgentMesh`,
    version: server.version,
    skills: server.tools.map(mcpToolToA2ASkill),
    provider: { organization: "mcp-bridge" },
  };
}

// Bridge: A2A Skill -> MCP Tool

export function a2aSkillToMCPTool(skill: A2ASkill): MCPTool {
  return {
    name: skill.id,
    description: skill.description ?? `A2A skill: ${skill.name}`,
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Task message" },
        context: { type: "object", description: "Context" },
      },
      required: ["message"],
    },
  };
}

// MCP Client abstraction

export interface MCPClient {
  readonly serverInfo: MCPServerInfo;
  listTools(): Promise<MCPTool[]>;
  callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: unknown; isError?: boolean }>;
  listResources(): Promise<MCPResource[]>;
  readResource(uri: string): Promise<{ contents: unknown }>;
  close(): Promise<void>;
}

// In-memory MCP client for testing / Phase 4

export class InMemoryMCPClient implements MCPClient {
  serverInfo: MCPServerInfo;

  constructor(
    serverInfo: MCPServerInfo,
    private toolHandlers: Map<
      string,
      (args: Record<string, unknown>) => Promise<unknown>
    > = new Map()
  ) {
    this.serverInfo = serverInfo;
  }

  async listTools(): Promise<MCPTool[]> {
    return this.serverInfo.tools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: unknown; isError?: boolean }> {
    const handler = this.toolHandlers.get(name);
    if (!handler) {
      return { content: { error: `Tool ${name} not found` }, isError: true };
    }
    try {
      const result = await handler(args);
      return { content: result };
    } catch (err) {
      return { content: { error: (err as Error).message }, isError: true };
    }
  }

  async listResources(): Promise<MCPResource[]> {
    return this.serverInfo.resources;
  }

  async readResource(uri: string): Promise<{ contents: unknown }> {
    const resource = this.serverInfo.resources.find(r => r.uri === uri);
    if (!resource) throw new Error(`Resource ${uri} not found`);
    return { contents: { uri, text: `Content of ${uri}` } };
  }

  async close(): Promise<void> {}

  registerToolHandler(
    name: string,
    handler: (args: Record<string, unknown>) => Promise<unknown>
  ): void {
    this.toolHandlers.set(name, handler);
  }
}

// Bridge Manager - manages A2A <-> MCP translation

export interface BridgeConfig {
  mcpServers: Array<{ name: string; endpoint: string; client: MCPClient }>;
}

export class MCPBridge {
  private mcpClients = new Map<string, MCPClient>();
  private a2aCards = new Map<string, A2AAgentCard>();

  constructor(private config: BridgeConfig = { mcpServers: [] }) {
    for (const server of config.mcpServers) {
      this.mcpClients.set(server.name, server.client);
      const card = mcpServerToA2ACard(server.client.serverInfo, server.endpoint);
      this.a2aCards.set(server.name, card);
    }
  }

  registerMCPServer(name: string, endpoint: string, client: MCPClient): void {
    this.mcpClients.set(name, client);
    const card = mcpServerToA2ACard(client.serverInfo, endpoint);
    this.a2aCards.set(name, card);
    console.log(
      `[mcp-bridge] registered MCP server ${name} with ${card.skills.length} skills as A2A agent`
    );
  }

  // A2A Agent wants to use MCP tool - translate A2A task to MCP tool call
  async a2aToMCP(
    agentId: string,
    skillId: string,
    input: { message: string; context?: Record<string, unknown> }
  ): Promise<{ output: unknown; isError?: boolean }> {
    // Find which MCP server provides this skill
    for (const [serverName, card] of this.a2aCards.entries()) {
      const skill = card.skills.find(s => s.id === skillId || s.name === skillId);
      if (skill) {
        const client = this.mcpClients.get(serverName);
        if (!client) continue;

        const mcpToolName = (skill.metadata as any)?.mcpTool ?? skill.name;
        console.log(
          `[mcp-bridge] A2A skill ${skillId} -> MCP tool ${mcpToolName} on server ${serverName}`
        );

        // Translate A2A input to MCP args
        const mcpArgs = {
          message: input.message,
          ...input.context,
        };

        const result = await client.callTool(mcpToolName, mcpArgs);
        return { output: result.content, isError: result.isError };
      }
    }

    throw new Error(`No MCP server found providing skill ${skillId}`);
  }

  // MCP Agent wants to call A2A Agent - translate MCP tool call to A2A task
  async mcpToA2A(
    mcpToolName: string,
    args: Record<string, unknown>,
    a2aAgentCaller: (agentId: string, skillId: string, message: string) => Promise<unknown>
  ): Promise<unknown> {
    // mcpToolName is actually an A2A skill ID in this direction
    // We need to find A2A agent that provides this skill - caller provides lookup
    // For Phase 4, we expect a2aAgentCaller to handle discovery

    const skillId = mcpToolName.startsWith("mcp_") ? mcpToolName.slice(4) : mcpToolName;
    const message = (args.message as string) ?? JSON.stringify(args);

    // In this direction, we delegate to A2A via provided caller
    // The caller should discover A2A agent and create task
    return a2aAgentCaller("discover", skillId, message);
  }

  listBridgedAgents(): A2AAgentCard[] {
    return Array.from(this.a2aCards.values());
  }

  getBridgedCard(serverName: string): A2AAgentCard | null {
    return this.a2aCards.get(serverName) ?? null;
  }

  // For A2A discovery - return all MCP tools as A2A agents
  async discoverAsA2A(skill?: string): Promise<Array<{ card: A2AAgentCard; serverName: string }>> {
    const result: Array<{ card: A2AAgentCard; serverName: string }> = [];
    for (const [serverName, card] of this.a2aCards.entries()) {
      if (!skill) {
        result.push({ card, serverName });
      } else {
        const matchingSkills = card.skills.filter(
          s => s.id === skill || s.name === skill || s.tags.includes(skill)
        );
        if (matchingSkills.length > 0) {
          result.push({ card: { ...card, skills: matchingSkills }, serverName });
        }
      }
    }
    return result;
  }
}

let bridgeInstance: MCPBridge | null = null;

export function getMCPBridge(): MCPBridge {
  if (!bridgeInstance) bridgeInstance = new MCPBridge();
  return bridgeInstance;
}

export function createMCPBridge(config?: BridgeConfig): MCPBridge {
  return new MCPBridge(config);
}

// Example usage for docs
export const ExampleMCPServer: MCPServerInfo = {
  name: "example-tools",
  version: "1.0.0",
  tools: [
    {
      name: "read_file",
      description: "Read a file",
      inputSchema: { type: "object", properties: { path: { type: "string" } } },
    },
    {
      name: "write_file",
      description: "Write a file",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
      },
    },
    {
      name: "search",
      description: "Search",
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
    },
  ],
  resources: [{ uri: "file:///tmp", name: "tmp", description: "Temp files" }],
};
