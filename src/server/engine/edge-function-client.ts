export interface EdgeFunctionConfig {
  supabaseUrl: string;
  anonKey: string;
}

export interface ChatRequest {
  siteSpecId: string;
  message: string;
  chatHistory: Array<{ role: string; content: string }>;
}

export interface ChatResponse {
  message: string;
  chat_history: Array<{ role: string; content: string }>;
  tool_calls?: Array<{ name: string; input: Record<string, unknown> }>;
  step_completed?: string;
  is_complete?: boolean;
}

export function buildChatRequest(req: ChatRequest) {
  return {
    site_spec_id: req.siteSpecId,
    message: req.message,
    chat_history: req.chatHistory,
  };
}

export function buildBuildRequest(req: { siteSpecId: string }) {
  return { site_spec_id: req.siteSpecId };
}

export class EdgeFunctionClient {
  readonly chatUrl: string;
  readonly buildUrl: string;
  readonly publishUrl: string;
  private readonly anonKey: string;

  constructor(config: EdgeFunctionConfig) {
    const base = config.supabaseUrl.replace(/\/$/, "");
    this.chatUrl = `${base}/functions/v1/chat`;
    this.buildUrl = `${base}/functions/v1/build`;
    this.publishUrl = `${base}/functions/v1/publish`;
    this.anonKey = config.anonKey;
  }

  private headers(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.anonKey}`,
      "Content-Type": "application/json",
    };
  }

  async sendChatMessage(req: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(this.chatUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildChatRequest(req)),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chat endpoint error ${response.status}: ${text}`);
    }
    return response.json();
  }

  async triggerBuild(siteSpecId: string): Promise<{ buildId: string }> {
    const response = await fetch(this.buildUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildBuildRequest({ siteSpecId })),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Build endpoint error ${response.status}: ${text}`);
    }
    return response.json();
  }

  async triggerPublish(siteSpecId: string): Promise<{ previewUrl: string }> {
    const response = await fetch(this.publishUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ site_spec_id: siteSpecId }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Publish endpoint error ${response.status}: ${text}`);
    }
    return response.json();
  }

  async waitForBuild(
    siteSpecId: string,
    pollFn: () => Promise<string>,
    timeoutMs: number = 120_000,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await pollFn();
      if (status === "built" || status === "published") return;
      if (status === "error") throw new Error("Build failed");
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error(`Build timed out after ${timeoutMs}ms`);
  }
}
