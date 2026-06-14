import * as admin from "firebase-admin";
import { getAdminDb } from "./firebaseAdmin";
import type { OpenAITool } from "./openai";
import {
  BLOCKNOTE_FORMAT_GUIDE,
  blocksToMarkdown,
  buildNoteContent,
  parseStoredBlocks,
} from "./blockNoteContent";

export type NoteUpdate =
  | { type: "content"; pageId: string; content: string }
  | { type: "title"; pageId: string; title: string };

export const AGENT_TOOLS: OpenAITool[] = [
  {
    type: "function",
    function: {
      name: "list_notes",
      description:
        "List all of the user's notes with id, title, parentId (null for top-level), and a short content preview.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_note",
      description:
        "Read a note's title, raw BlockNote JSON, and a Markdown rendering of its formatted content.",
      parameters: {
        type: "object",
        properties: {
          pageId: { type: "string", description: "The note id to read" },
        },
        required: ["pageId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_note",
      description:
        "Write richly formatted note content: headings, lists, checklists, quotes, code blocks, tables, images, videos, audio, files, colors, links, and nested toggle headings. Prefer format markdown. Use mode append to add content without replacing the whole note.",
      parameters: {
        type: "object",
        properties: {
          pageId: { type: "string", description: "The note id to update" },
          content: {
            type: "string",
            description:
              "Markdown (default) or JSON block array. Markdown supports # headings, **bold**, lists, tables, ![images](url), {{video:url|caption}}, {{audio:url}}, {{file:url|name}}, code fences, etc.",
          },
          format: {
            type: "string",
            enum: ["markdown", "blocks"],
            description: "markdown (preferred) or blocks JSON. Default markdown.",
          },
          mode: {
            type: "string",
            enum: ["replace", "append"],
            description: "replace entire note body (default) or append to existing content.",
          },
        },
        required: ["pageId", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_title",
      description: "Change the title of a note.",
      parameters: {
        type: "object",
        properties: {
          pageId: { type: "string", description: "The note id to update" },
          title: { type: "string", description: "The new title" },
        },
        required: ["pageId", "title"],
      },
    },
  },
];

function pagesCollection(userId: string) {
  return getAdminDb().collection("users").doc(userId).collection("pages");
}

export async function listNotes(userId: string) {
  const snapshot = await pagesCollection(userId)
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const content = typeof data.content === "string" ? data.content : "";
    const blocks = parseStoredBlocks(content);
    const preview = blocks.length
      ? blocksToMarkdown(blocks).substring(0, 200)
      : content.substring(0, 200);
    return {
      id: doc.id,
      title: data.title ?? "Untitled",
      parentId: data.parentId ?? null,
      contentPreview: preview,
    };
  });
}

export async function readNote(userId: string, pageId: string) {
  const doc = await pagesCollection(userId).doc(pageId).get();
  if (!doc.exists) {
    return { error: `Note ${pageId} not found` };
  }
  const data = doc.data()!;
  const content = data.content ?? "[]";
  const blocks = parseStoredBlocks(content);
  return {
    id: doc.id,
    title: data.title ?? "Untitled",
    content,
    contentMarkdown: blocks.length ? blocksToMarkdown(blocks) : "",
  };
}

export async function updateNoteContent(
  userId: string,
  pageId: string,
  content: string,
  options: { format?: "markdown" | "blocks"; mode?: "replace" | "append" } = {}
): Promise<NoteUpdate | { error: string }> {
  const ref = pagesCollection(userId).doc(pageId);
  const doc = await ref.get();
  if (!doc.exists) {
    return { error: `Note ${pageId} not found` };
  }

  const existingContent = doc.data()?.content ?? "[]";
  const built = buildNoteContent({
    existingContent,
    content,
    format: options.format,
    mode: options.mode,
  });

  if ("error" in built) {
    return { error: built.error };
  }

  await ref.update({
    content: built.content,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { type: "content", pageId, content: built.content };
}

export async function updateNoteTitle(
  userId: string,
  pageId: string,
  title: string
): Promise<NoteUpdate | { error: string }> {
  const ref = pagesCollection(userId).doc(pageId);
  const doc = await ref.get();
  if (!doc.exists) {
    return { error: `Note ${pageId} not found` };
  }

  await ref.update({
    title,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { type: "title", pageId, title };
}

export async function executeAgentTool(
  userId: string,
  name: string,
  args: Record<string, unknown>
): Promise<{ result: unknown; update?: NoteUpdate }> {
  switch (name) {
    case "list_notes":
      return { result: await listNotes(userId) };
    case "read_note": {
      const pageId = String(args.pageId ?? "");
      return { result: await readNote(userId, pageId) };
    }
    case "update_note": {
      const pageId = String(args.pageId ?? "");
      const content = String(args.content ?? "");
      const format =
        args.format === "blocks" ? "blocks" : args.format === "markdown" ? "markdown" : undefined;
      const mode =
        args.mode === "append" ? "append" : args.mode === "replace" ? "replace" : undefined;
      const outcome = await updateNoteContent(userId, pageId, content, {
        format,
        mode,
      });
      if ("error" in outcome) {
        return { result: outcome };
      }
      return { result: { success: true, pageId }, update: outcome };
    }
    case "update_title": {
      const pageId = String(args.pageId ?? "");
      const title = String(args.title ?? "");
      const outcome = await updateNoteTitle(userId, pageId, title);
      if ("error" in outcome) {
        return { result: outcome };
      }
      return { result: { success: true, pageId }, update: outcome };
    }
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

export { BLOCKNOTE_FORMAT_GUIDE };
