import {
  getMCPBridge,
  InMemoryMCPClient,
  type MCPServerInfo,
  type MCPTool,
  ExampleMCPServer,
} from "@agentmesh/mcp-bridge";
import { getTenantManager, type TenantContext } from "@agentmesh/tenancy";
import { NotFoundError, ValidationError } from "@agentmesh/core";

export class MCPService {
  private bridge = getMCPBridge();
  private tenantManager = getTenantManager();

  async registerServer(input: {
    name: string;
    endpoint: string;
    serverInfo?: MCPServerInfo;
    tools?: MCPTool[];
    tenant?: TenantContext;
  }): Promise<{ name: string; card: any }> {
    if (!input.name) throw new ValidationError("name is required");
    if (!input.endpoint) throw new ValidationError("endpoint is required");

    const serverInfo: MCPServerInfo = input.serverInfo ?? {
      name: input.name,
      version: "1.0.0",
      tools: input.tools ?? ExampleMCPServer.tools,
      resources: ExampleMCPServer.resources,
    };

    const client = new InMemoryMCPClient(serverInfo);

    // Register example handlers for demo tools
    for (const tool of serverInfo.tools) {
      client.registerToolHandler(tool.name, async args => {
        return {
          result: `Executed ${tool.name} with args ${JSON.stringify(args)}`,
          server: input.name,
          timestamp: new Date().toISOString(),
        };
      });
    }

    this.bridge.registerMCPServer(input.name, input.endpoint, client);

    const card = this.bridge.getBridgedCard(input.name);
    return { name: input.name, card };
  }

  async listServers(): Promise<Array<{ card: any; serverName: string }>> {
    return this.bridge.discoverAsA2A();
  }

  async discover(skill?: string): Promise<Array<{ card: any; serverName: string }>> {
    return this.bridge.discoverAsA2A(skill);
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    tenant?: TenantContext
  ): Promise<{ output: unknown; isError?: boolean }> {
    // In this direction, A2A agent calls MCP tool via bridge
    const result = await this.bridge.a2aToMCP(serverName, toolName, {
      message: JSON.stringify(args),
      context: args,
    });
    return result;
  }

  async callA2AFromMCP(
    mcpToolName: string,
    args: Record<string, unknown>,
    a2aCaller: (agentId: string, skillId: string, message: string) => Promise<unknown>
  ): Promise<unknown> {
    return this.bridge.mcpToA2A(mcpToolName, args, a2aCaller);
  }
}

let instance: MCPService | null = null;
export function getMCPService(): MCPService {
  if (!instance) instance = new MCPService();
  return instance;
}
