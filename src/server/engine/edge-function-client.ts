export interface EdgeFunctionConfig {
  supabaseUrl: string;
  authToken: string; // User JWT token for edge function authentication
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface ChatResponse {
  content: ChatContentBlock[];
  stop_reason: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

export interface BuildFile {
  path: string;
  content: string;
}

export interface BuildResponse {
  success: boolean;
  preview_url: string;
}

export interface PublishResponse {
  success: boolean;
  deploy_url?: string;
}

export function buildChatRequest(messages: ChatMessage[]): { messages: ChatMessage[] } {
  return { messages };
}

export function buildBuildRequest(
  siteSpecId: string,
  files: BuildFile[],
): { site_spec_id: string; files: BuildFile[] } {
  return { site_spec_id: siteSpecId, files };
}

/**
 * Joins all text content blocks from a ChatResponse into a single string.
 */
export function extractTextFromResponse(response: ChatResponse): string {
  return response.content
    .filter((block): block is ChatContentBlock & { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("");
}

/**
 * Extracts all tool_use blocks from a ChatResponse.
 */
export function extractToolCalls(
  response: ChatResponse,
): Array<{ name: string; input: Record<string, unknown> }> {
  return response.content
    .filter((block): block is ChatContentBlock & { type: "tool_use"; name: string; input: Record<string, unknown> } =>
      block.type === "tool_use" && typeof block.name === "string" && block.input !== undefined,
    )
    .map((block) => ({ name: block.name, input: block.input }));
}

/**
 * Checks whether the conversation is complete by looking for a
 * mark_step_complete tool call with next_step === "complete".
 */
export function isConversationComplete(response: ChatResponse): boolean {
  const toolCalls = extractToolCalls(response);
  return toolCalls.some(
    (tc) => tc.name === "mark_step_complete" && tc.input.next_step === "complete",
  );
}

export class EdgeFunctionClient {
  readonly chatUrl: string;
  readonly buildUrl: string;
  readonly publishUrl: string;
  private readonly authToken: string;

  constructor(config: EdgeFunctionConfig) {
    const base = config.supabaseUrl.replace(/\/$/, "");
    this.chatUrl = `${base}/functions/v1/chat`;
    this.buildUrl = `${base}/functions/v1/build`;
    this.publishUrl = `${base}/functions/v1/publish`;
    this.authToken = config.authToken;
  }

  private headers(): Record<string, string> {
    const auth = this.authToken.startsWith("Bearer ") ? this.authToken : `Bearer ${this.authToken}`;
    return {
      "Authorization": auth,
      "Content-Type": "application/json",
    };
  }

  async sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
    const response = await fetch(this.chatUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildChatRequest(messages)),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Chat endpoint error ${response.status}: ${text}`);
    }
    return response.json() as Promise<ChatResponse>;
  }

  async triggerBuild(siteSpecId: string, files: BuildFile[]): Promise<BuildResponse> {
    const response = await fetch(this.buildUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildBuildRequest(siteSpecId, files)),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Build endpoint error ${response.status}: ${text}`);
    }
    return response.json() as Promise<BuildResponse>;
  }

  async triggerPublish(
    siteSpecId: string,
    action: "publish" | "unpublish",
  ): Promise<PublishResponse> {
    const response = await fetch(this.publishUrl, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ site_spec_id: siteSpecId, action }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Publish endpoint error ${response.status}: ${text}`);
    }
    return response.json() as Promise<PublishResponse>;
  }
}
