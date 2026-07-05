import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { authenticateApiRequest } from "../../../../lib/serverAuth";
import { parseStoredBlocks, blocksToMarkdown } from "../../../../lib/blockNoteContent";
import { createChatCompletion } from "../../../../lib/openai";
import { initialSrs } from "../../../../lib/srs";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a study assistant that turns a student's notes into flashcards.
Read the notes and produce concise, high-quality flashcards that cover the key facts,
definitions, concepts, and relationships. Each card has:
- "front": a short question or term to prompt recall
- "back": the concise answer or definition

Rules:
- Produce between 4 and 20 cards depending on how much material there is.
- Keep each side short (ideally under 200 characters).
- One idea per card. Do not duplicate cards.
- Return ONLY a raw JSON array, e.g. [{"front":"...","back":"..."}]
- No markdown, no code fences, no commentary before or after the JSON.`;

type RawCard = { front?: unknown; back?: unknown };

function extractCards(text: string): { front: string; back: string }[] {
  // Pull the first JSON array out of the model's response, tolerating fences.
  const match = text.match(/\[[\s\S]*\]/);
  const json = match ? match[0] : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return (parsed as RawCard[])
    .map((c) => ({
      front: typeof c.front === "string" ? c.front.trim() : "",
      back: typeof c.back === "string" ? c.back.trim() : "",
    }))
    .filter((c) => c.front.length > 0)
    .slice(0, 40);
}

export async function POST(req: Request) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const { pageId } = await req.json();
    if (typeof pageId !== "string" || !pageId) {
      return NextResponse.json({ error: "A pageId is required." }, { status: 400 });
    }

    // Load the note.
    const pageRef = getAdminDb()
      .collection("users")
      .doc(userId)
      .collection("pages")
      .doc(pageId);
    const pageDoc = await pageRef.get();
    if (!pageDoc.exists) {
      return NextResponse.json({ error: "Page not found." }, { status: 404 });
    }
    const pageData = pageDoc.data() ?? {};
    const title = pageData.title || "Untitled";
    const markdown = blocksToMarkdown(parseStoredBlocks(pageData.content ?? "[]"));

    if (markdown.trim().length < 20) {
      return NextResponse.json(
        { error: "This note is too short to make flashcards from." },
        { status: 400 }
      );
    }

    // Ask the model to summarize into cards.
    const { message } = await createChatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Notes titled "${title}":\n\n${markdown.slice(0, 12000)}`,
        },
      ],
    });

    const cards = extractCards(message.content ?? "");
    if (cards.length === 0) {
      return NextResponse.json(
        { error: "The AI could not produce cards from this note. Try again." },
        { status: 502 }
      );
    }

    // Create the deck + cards in one batch.
    const db = getAdminDb();
    const deckRef = db.collection("users").doc(userId).collection("decks").doc();
    const batch = db.batch();
    batch.set(deckRef, {
      name: title,
      sourcePageId: pageId,
      sourcePageTitle: title,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const now = Date.now();
    const srs = initialSrs();
    const createdCards = cards.map((c, i) => {
      const cardRef = deckRef.collection("cards").doc();
      batch.set(cardRef, {
        front: c.front,
        back: c.back,
        order: now + i,
        ...srs,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { id: cardRef.id, front: c.front, back: c.back, order: now + i, ...srs };
    });

    await batch.commit();

    return NextResponse.json({
      deck: {
        id: deckRef.id,
        name: title,
        sourcePageId: pageId,
        sourcePageTitle: title,
        cardCount: createdCards.length,
        createdAt: new Date().toISOString(),
      },
      cards: createdCards,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
