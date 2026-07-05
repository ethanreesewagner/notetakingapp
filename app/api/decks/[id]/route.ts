import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { authenticateApiRequest } from "../../../../lib/serverAuth";

export const dynamic = "force-dynamic";

// PUT — rename a deck.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const { id } = await params;

    const { name } = await req.json();
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "A name is required." }, { status: 400 });
    }

    await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("decks")
      .doc(id)
      .update({ name: name.trim() });

    return NextResponse.json({ success: true, name: name.trim() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// DELETE — remove a deck and all its cards.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const { id } = await params;

    const deckRef = getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("decks")
      .doc(id);

    const cards = await deckRef.collection("cards").get();
    const batch = getAdminDb().batch();
    cards.docs.forEach((c) => batch.delete(c.ref));
    batch.delete(deckRef);
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
