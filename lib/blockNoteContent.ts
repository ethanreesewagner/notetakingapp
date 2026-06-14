type InlineContent =
  | { type: "text"; text: string; styles: Record<string, boolean | string> }
  | {
      type: "link";
      href: string;
      content: Array<{ type: "text"; text: string; styles: Record<string, never> }>;
    };

export type BlockNoteBlock = {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
  children?: BlockNoteBlock[];
};

const DEFAULT_PROPS = {
  backgroundColor: "default",
  textColor: "default",
  textAlignment: "left",
};

const SUPPORTED_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "toggleListItem",
  "codeBlock",
  "divider",
  "image",
  "video",
  "audio",
  "file",
  "table",
]);

export const BLOCKNOTE_FORMAT_GUIDE = `
BlockNote content can be written as Markdown (preferred) or as a JSON block array.

## Markdown (use format: "markdown")
Supports everything available via slash commands:
- Headings: # H1 through ###### H6
- Bold **text**, italic *text*, \`inline code\`, ~~strikethrough~~
- Links: [label](https://example.com)
- Bullet list: - item
- Numbered list: 1. item
- Checklist: - [ ] todo or - [x] done
- Quote: > quoted text
- Divider: --- on its own line
- Code block:
  \`\`\`javascript
  const x = 1;
  \`\`\`
- Table:
  | Col A | Col B |
  | --- | --- |
  | one | two |
- Image: ![caption](https://image-url)
- Video: {{video:https://video-url|optional caption}}
- Audio: {{audio:https://audio-url}}
- File: {{file:https://file-url|display name.pdf}}
- Toggle heading: {{toggle:Section title}} or {{toggle:2:Section title}} for level 2

Use colors sparingly with inline HTML-style markers in text:
- {{color:red:colored text}}
- {{bg:yellow:highlighted text}}

## JSON blocks (use format: "blocks")
Each block: { "type": "...", "props": {...}, "content": "..." or inline array, "children": [] }
Block types: paragraph, heading, quote, bulletListItem, numberedListItem, checkListItem,
toggleListItem, codeBlock, divider, image, video, audio, file, table.

Inline styled text example:
{ "type": "paragraph", "content": [
  { "type": "text", "text": "Bold", "styles": { "bold": true } },
  { "type": "text", "text": " link", "styles": {} },
  { "type": "link", "href": "https://example.com", "content": [{ "type": "text", "text": "here", "styles": {} }] }
]}

Image: { "type": "image", "props": { "url": "https://...", "caption": "...", "name": "photo.png" } }
Video/audio/file: same pattern with type "video" | "audio" | "file"
Table: { "type": "table", "content": { "type": "tableContent", "rows": [{ "cells": ["A","B"] }, { "cells": ["C","D"] }] } }
Heading: { "type": "heading", "props": { "level": 2 }, "content": "Title" }
Checklist: { "type": "checkListItem", "props": { "checked": false }, "content": "Task" }
`.trim();

function createId(): string {
  return crypto.randomUUID();
}

function defaultProps(extra: Record<string, unknown> = {}) {
  return { ...DEFAULT_PROPS, ...extra };
}

function parseInlineMarkdown(text: string): InlineContent[] {
  if (!text) return [];

  const nodes: InlineContent[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\([^)]+\)|\{\{color:[^:]+:[^}]+\}\}|\{\{bg:[^:]+:[^}]+\}\})/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({
        type: "text",
        text: text.slice(lastIndex, match.index),
        styles: {},
      });
    }

    const token = match[0];

    if (token.startsWith("**")) {
      nodes.push({
        type: "text",
        text: token.slice(2, -2),
        styles: { bold: true },
      });
    } else if (token.startsWith("*")) {
      nodes.push({
        type: "text",
        text: token.slice(1, -1),
        styles: { italic: true },
      });
    } else if (token.startsWith("~~")) {
      nodes.push({
        type: "text",
        text: token.slice(2, -2),
        styles: { strike: true },
      });
    } else if (token.startsWith("`")) {
      nodes.push({
        type: "text",
        text: token.slice(1, -1),
        styles: { code: true },
      });
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push({
          type: "link",
          href: linkMatch[2],
          content: [{ type: "text", text: linkMatch[1], styles: {} }],
        });
      }
    } else if (token.startsWith("{{color:")) {
      const colorMatch = token.match(/^\{\{color:([^:]+):([^}]+)\}\}$/);
      if (colorMatch) {
        nodes.push({
          type: "text",
          text: colorMatch[2],
          styles: { textColor: colorMatch[1] },
        });
      }
    } else if (token.startsWith("{{bg:")) {
      const bgMatch = token.match(/^\{\{bg:([^:]+):([^}]+)\}\}$/);
      if (bgMatch) {
        nodes.push({
          type: "text",
          text: bgMatch[2],
          styles: { backgroundColor: bgMatch[1] },
        });
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex), styles: {} });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text, styles: {} }];
}

function inlineBlock(
  type: string,
  content: string,
  props: Record<string, unknown> = {}
): BlockNoteBlock {
  return {
    id: createId(),
    type,
    props: defaultProps(props),
    content: parseInlineMarkdown(content),
    children: [],
  };
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s\-:|]+\|?$/.test(line.trim());
}

export function markdownToBlocks(markdown: string): BlockNoteBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockNoteBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push(
        inlineBlock("heading", headingMatch[2], {
          level: headingMatch[1].length,
        })
      );
      i++;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push({ id: createId(), type: "divider", props: {}, children: [] });
      i++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      blocks.push(inlineBlock("quote", trimmed.replace(/^>\s?/, "")));
      i++;
      continue;
    }

    const toggleMatch = trimmed.match(/^\{\{toggle:(?:(\d):)?([^}]+)\}\}$/);
    if (toggleMatch) {
      blocks.push(
        inlineBlock("heading", toggleMatch[2], {
          level: Number(toggleMatch[1] ?? 1),
          isToggleable: true,
        })
      );
      i++;
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      blocks.push({
        id: createId(),
        type: "image",
        props: {
          ...defaultProps(),
          url: imageMatch[2],
          caption: imageMatch[1],
          name: imageMatch[1] || "image",
          showPreview: true,
        },
        children: [],
      });
      i++;
      continue;
    }

    const videoMatch = trimmed.match(/^\{\{video:([^|}]+)(?:\|([^}]+))?\}\}$/);
    if (videoMatch) {
      blocks.push({
        id: createId(),
        type: "video",
        props: {
          ...defaultProps(),
          url: videoMatch[1].trim(),
          caption: videoMatch[2]?.trim() ?? "",
          name: videoMatch[2]?.trim() || "video",
          showPreview: true,
        },
        children: [],
      });
      i++;
      continue;
    }

    const audioMatch = trimmed.match(/^\{\{audio:([^|}]+)(?:\|([^}]+))?\}\}$/);
    if (audioMatch) {
      blocks.push({
        id: createId(),
        type: "audio",
        props: {
          ...defaultProps(),
          url: audioMatch[1].trim(),
          caption: audioMatch[2]?.trim() ?? "",
          name: audioMatch[2]?.trim() || "audio",
        },
        children: [],
      });
      i++;
      continue;
    }

    const fileMatch = trimmed.match(/^\{\{file:([^|}]+)(?:\|([^}]+))?\}\}$/);
    if (fileMatch) {
      blocks.push({
        id: createId(),
        type: "file",
        props: {
          ...defaultProps(),
          url: fileMatch[1].trim(),
          caption: fileMatch[2]?.trim() ?? "",
          name: fileMatch[2]?.trim() || "file",
        },
        children: [],
      });
      i++;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        id: createId(),
        type: "codeBlock",
        props: { language },
        content: codeLines.join("\n"),
        children: [],
      });
      i++;
      continue;
    }

    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = parseTableRow(trimmed);
      i += 2;
      const rows: Array<{ cells: string[] }> = [{ cells: headerCells }];
      while (i < lines.length && lines[i].trim().includes("|")) {
        rows.push({ cells: parseTableRow(lines[i]) });
        i++;
      }
      blocks.push({
        id: createId(),
        type: "table",
        props: defaultProps(),
        content: { type: "tableContent", rows },
        children: [],
      });
      continue;
    }

    const checkMatch = trimmed.match(/^-\s+\[( |x|X)\]\s+(.+)$/);
    if (checkMatch) {
      blocks.push({
        id: createId(),
        type: "checkListItem",
        props: {
          ...defaultProps(),
          checked: checkMatch[1].toLowerCase() === "x",
        },
        content: parseInlineMarkdown(checkMatch[2]),
        children: [],
      });
      i++;
      continue;
    }

    if (/^-\s+/.test(trimmed)) {
      blocks.push(inlineBlock("bulletListItem", trimmed.replace(/^-\s+/, "")));
      i++;
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      blocks.push(inlineBlock("numberedListItem", numberedMatch[1]));
      i++;
      continue;
    }

    blocks.push(inlineBlock("paragraph", trimmed));
    i++;
  }

  return blocks.length > 0
    ? blocks
    : [{ id: createId(), type: "paragraph", props: defaultProps(), content: "", children: [] }];
}

function inlineToMarkdown(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((node) => {
      if (!node || typeof node !== "object") return "";
      if (node.type === "text") {
        let text = String(node.text ?? "");
        const styles = node.styles ?? {};
        if (styles.code) text = `\`${text}\``;
        if (styles.bold) text = `**${text}**`;
        if (styles.italic) text = `*${text}*`;
        if (styles.strike) text = `~~${text}~~`;
        if (styles.textColor && styles.textColor !== "default") {
          text = `{{color:${styles.textColor}:${text}}}`;
        }
        if (styles.backgroundColor && styles.backgroundColor !== "default") {
          text = `{{bg:${styles.backgroundColor}:${text}}}`;
        }
        return text;
      }
      if (node.type === "link") {
        const label = inlineToMarkdown(node.content);
        return `[${label || node.href}](${node.href})`;
      }
      return "";
    })
    .join("");
}

export function blocksToMarkdown(blocks: BlockNoteBlock[]): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const text = inlineToMarkdown(block.content);

    switch (block.type) {
      case "heading": {
        const level = Number(block.props?.level ?? 1);
        if (block.props?.isToggleable) {
          lines.push(`{{toggle:${level > 1 ? `${level}:` : ""}${text}}}`);
        } else {
          lines.push(`${"#".repeat(Math.min(Math.max(level, 1), 6))} ${text}`);
        }
        break;
      }
      case "quote":
        lines.push(`> ${text}`);
        break;
      case "bulletListItem":
        lines.push(`- ${text}`);
        break;
      case "numberedListItem":
        lines.push(`1. ${text}`);
        break;
      case "checkListItem":
        lines.push(`- [${block.props?.checked ? "x" : " "}] ${text}`);
        break;
      case "toggleListItem":
        lines.push(`- ${text}`);
        break;
      case "codeBlock":
        lines.push(`\`\`\`${block.props?.language ?? "text"}`);
        lines.push(text);
        lines.push("```");
        break;
      case "divider":
        lines.push("---");
        break;
      case "image":
        lines.push(`![${block.props?.caption ?? ""}](${block.props?.url ?? ""})`);
        break;
      case "video":
        lines.push(
          `{{video:${block.props?.url ?? ""}${block.props?.caption ? `|${block.props.caption}` : ""}}}`
        );
        break;
      case "audio":
        lines.push(
          `{{audio:${block.props?.url ?? ""}${block.props?.caption ? `|${block.props.caption}` : ""}}}`
        );
        break;
      case "file":
        lines.push(
          `{{file:${block.props?.url ?? ""}|${block.props?.name ?? block.props?.caption ?? "file"}}}`
        );
        break;
      case "table": {
        const rows = (block.content as { rows?: Array<{ cells: unknown[] }> })?.rows ?? [];
        if (rows.length === 0) break;
        const rendered = rows.map((row) => {
          const cells = row.cells.map((cell) =>
            typeof cell === "string" ? cell : inlineToMarkdown(cell)
          );
          return `| ${cells.join(" | ")} |`;
        });
        lines.push(rendered[0]);
        lines.push(`| ${Array(rows[0].cells.length).fill("---").join(" | ")} |`);
        lines.push(...rendered.slice(1));
        break;
      }
      default:
        if (text) lines.push(text);
    }

    if (block.children?.length) {
      lines.push(blocksToMarkdown(block.children));
    }
  }

  return lines.join("\n\n").trim();
}

function normalizeBlock(block: unknown): BlockNoteBlock | null {
  if (!block || typeof block !== "object") return null;
  const raw = block as BlockNoteBlock;
  if (!raw.type || !SUPPORTED_BLOCK_TYPES.has(raw.type)) return null;

  const normalized: BlockNoteBlock = {
    id: raw.id || createId(),
    type: raw.type,
    props: { ...defaultProps(), ...(raw.props ?? {}) },
    children: Array.isArray(raw.children)
      ? raw.children.map(normalizeBlock).filter(Boolean) as BlockNoteBlock[]
      : [],
  };

  if (raw.type === "divider") {
    delete normalized.content;
  } else if (raw.type === "table") {
    normalized.content = raw.content ?? {
      type: "tableContent",
      rows: [{ cells: ["", ""] }, { cells: ["", ""] }],
    };
  } else if (
    ["image", "video", "audio", "file"].includes(raw.type)
  ) {
    normalized.props = {
      ...defaultProps(),
      url: raw.props?.url ?? "",
      caption: raw.props?.caption ?? "",
      name: raw.props?.name ?? "",
      showPreview: raw.props?.showPreview ?? true,
      ...(raw.props ?? {}),
    };
  } else if (raw.type === "codeBlock") {
    normalized.props = { language: raw.props?.language ?? "text" };
    normalized.content =
      typeof raw.content === "string"
        ? raw.content
        : inlineToMarkdown(raw.content);
  } else if (typeof raw.content === "string") {
    normalized.content = parseInlineMarkdown(raw.content);
  } else if (Array.isArray(raw.content)) {
    normalized.content = raw.content;
  } else {
    normalized.content = "";
  }

  return normalized;
}

export function normalizeBlocks(input: unknown): BlockNoteBlock[] {
  if (!Array.isArray(input)) return [];
  return input.map(normalizeBlock).filter(Boolean) as BlockNoteBlock[];
}

export function parseStoredBlocks(content: string): BlockNoteBlock[] {
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    return normalizeBlocks(parsed);
  } catch {
    return [];
  }
}

export function serializeBlocks(blocks: BlockNoteBlock[]): string {
  return JSON.stringify(normalizeBlocks(blocks));
}

export type ContentFormat = "markdown" | "blocks";
export type ContentMode = "replace" | "append";

export function buildNoteContent(params: {
  existingContent: string;
  content: string;
  format?: ContentFormat;
  mode?: ContentMode;
}): { content: string } | { error: string } {
  const format = params.format ?? "markdown";
  const mode = params.mode ?? "replace";

  let incomingBlocks: BlockNoteBlock[];
  if (format === "markdown") {
    incomingBlocks = markdownToBlocks(params.content);
  } else {
    try {
      incomingBlocks = normalizeBlocks(JSON.parse(params.content));
    } catch {
      return { error: "content must be valid JSON when format is blocks" };
    }
  }

  if (incomingBlocks.length === 0) {
    return { error: "content produced no blocks" };
  }

  if (mode === "append") {
    const existing = parseStoredBlocks(params.existingContent);
    incomingBlocks = [...existing, ...incomingBlocks];
  }

  return { content: serializeBlocks(incomingBlocks) };
}
