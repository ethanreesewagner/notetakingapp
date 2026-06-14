import {
  AGENT_TOOLS,
  BLOCKNOTE_FORMAT_GUIDE,
  executeAgentTool,
  type NoteUpdate,
} from "../../../lib/agentTools";
import {
  createChatCompletion,
  type ChatMessage,
} from "../../../lib/openai";
import {
  getChatMessages,
  saveChatMessages,
  toLlmMessages,
  type StoredChatMessage,
} from "../../../lib/chatHistory";
import { getSessionUser } from "../../../lib/serverAuth";

export const maxDuration = 60;

const MAX_TOOL_ROUNDS = 8;

function buildSystemPrompt(activePageId: string | null): string {
  return `You are an AI assistant for a note-taking app. You can read and edit any of the user's notes with rich formatting.

Use tools to list, read, and update notes. When writing note content, use update_note with format "markdown" (preferred) so you can insert headings, styled text, lists, checklists, quotes, code blocks, tables, images, videos, audio, files, dividers, and toggle headings — the same blocks users create with slash commands.

Use mode "append" to add content to a note without erasing existing content. Use mode "replace" only when rewriting the whole note.

The user may refer to "this note" or "the current note" — that means page id: ${activePageId ?? "(none selected)"}.

Notes can be nested (parent/child pages). list_notes includes parentId when present.

You have access to the conversation history. Use prior messages for context when answering follow-up questions.

${BLOCKNOTE_FORMAT_GUIDE}

Be concise and helpful. After making edits, briefly confirm what you changed.`;
}

function getReplyText(message: ChatMessage): string | null {
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { message, activePageId } = await req.json();

    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const text = typeof message === "string" ? message.trim() : "";
    if (!text) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const userId = sessionUser.uid;

    const history = await getChatMessages(userId);
    const userMessage: StoredChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const pendingMessages = [...history, userMessage];

    const conversation: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(activePageId ?? null) },
      ...toLlmMessages(pendingMessages),
    ];

    const updates: NoteUpdate[] = [];
    let lastToolRound = -1;
    let reply = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const { message: assistantMessage, finishReason } =
        await createChatCompletion({
          messages: conversation,
          tools: AGENT_TOOLS,
        });

      const toolCalls = assistantMessage.tool_calls ?? [];

      if (toolCalls.length > 0) {
        lastToolRound = round;
        conversation.push({
          role: "assistant",
          content: assistantMessage.content,
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            args = {};
          }

          const { result, update } = await executeAgentTool(
            userId,
            toolCall.function.name,
            args
          );

          if (update) {
            updates.push(update);
          }

          conversation.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        const replyAfterTools = getReplyText(assistantMessage);
        if (replyAfterTools && finishReason !== "tool_calls") {
          reply = replyAfterTools;
          break;
        }

        continue;
      }

      const nextReply = getReplyText(assistantMessage);
      if (nextReply) {
        reply = nextReply;
        break;
      }

      if (finishReason === "stop" || finishReason === "length") {
        break;
      }
    }

    if (!reply && lastToolRound >= 0) {
      const { message: finalMessage } = await createChatCompletion({
        messages: conversation,
      });
      reply = getReplyText(finalMessage) ?? "";
    }

    if (!reply) {
      reply =
        updates.length > 0
          ? "I've updated your notes."
          : "I couldn't finish that request. Please try again.";
    }

    const assistantMessage: StoredChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: reply,
      createdAt: new Date().toISOString(),
    };

    const savedMessages = await saveChatMessages(userId, [
      ...pendingMessages,
      assistantMessage,
    ]);

    return Response.json({ reply, updates, messages: savedMessages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Chat route error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
