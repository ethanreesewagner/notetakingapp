const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";
const OPENAI_API_BASE = "https://api.openai.com/v1";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type OpenAITool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

function getApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY ?? process.env.NVIDIA_API_KEY;
}

function usesNvidiaApi(key: string): boolean {
  if (process.env.OPENAI_BASE_URL?.includes("nvidia.com")) return true;
  if (process.env.NVIDIA_API_BASE_URL) return true;
  return key.startsWith("nvapi-");
}

function getApiBase(): string {
  if (process.env.OPENAI_BASE_URL) {
    return process.env.OPENAI_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.NVIDIA_API_BASE_URL) {
    return process.env.NVIDIA_API_BASE_URL.replace(/\/$/, "");
  }
  const key = getApiKey();
  if (key && usesNvidiaApi(key)) {
    return NVIDIA_API_BASE;
  }
  return OPENAI_API_BASE;
}

function getDefaultModel(): string {
  if (process.env.OPENAI_MODEL) {
    return process.env.OPENAI_MODEL;
  }
  const key = getApiKey();
  if (key && usesNvidiaApi(key)) {
    return "meta/llama-3.1-70b-instruct";
  }
  return "gpt-4o-mini";
}

export async function createChatCompletion(params: {
  messages: ChatMessage[];
  tools?: OpenAITool[];
  model?: string;
}): Promise<{
  message: ChatMessage;
  finishReason: string | null;
}> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY (or NVIDIA_API_KEY) is not set. Add your nvapi key to .env or .env.local."
    );
  }

  const base = getApiBase();
  const isNvidia = base.includes("nvidia.com");
  const url = `${base}/chat/completions`;

  const body: Record<string, unknown> = {
    model: params.model ?? getDefaultModel(),
    messages: params.messages,
    tools: params.tools,
    tool_choice: params.tools?.length ? "auto" : undefined,
  };

  if (isNvidia) {
    body.max_tokens = Number(process.env.OPENAI_MAX_TOKENS ?? 4096);
    body.temperature = Number(process.env.OPENAI_TEMPERATURE ?? 0.2);
    body.top_p = Number(process.env.OPENAI_TOP_P ?? 0.7);
  }

  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 60_000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`LLM request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text();
    const provider = isNvidia ? "NVIDIA NIM" : "OpenAI";
    throw new Error(`${provider} API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice?.message) {
    throw new Error("LLM returned an empty response");
  }

  return {
    message: choice.message as ChatMessage,
    finishReason: choice.finish_reason ?? null,
  };
}
