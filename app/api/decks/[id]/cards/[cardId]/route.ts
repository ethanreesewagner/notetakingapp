import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../../../lib/firebaseAdmin";
import { authenticateApiRequest } from "../../../../../../lib/serverAuth";

export const dynamic = "force-dynamic";

// PUT — update a card's content, order, or SRS state (after a review).
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const { id, cardId } = await params;

    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (typeof body.front === "string") update.front = body.front.trim();
    if (typeof body.back === "string") update.back = body.back.trim();
    for (const key of ["order", "dueAt", "interval", "ease", "reps", "lapses"]) {
      if (typeof body[key] === "number" && isFinite(body[key])) update[key] = body[key];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("decks")
      .doc(id)
      .collection("cards")
      .doc(cardId)
      .update(update);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE — remove a card.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const { id, cardId } = await params;

    await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("decks")
      .doc(id)
      .collection("cards")
      .doc(cardId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
