import { NextResponse } from "next/server";
import { getAdminDb } from "../../../lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { authenticateApiRequest } from "../../../lib/serverAuth";

export const dynamic = "force-dynamic";

// GET — list the user's flashcard decks (with card counts).
export async function GET() {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const decksRef = getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("decks");
    const snap = await decksRef.orderBy("createdAt", "desc").get();

    const decks = await Promise.all(
      snap.docs.map(async (doc: admin.firestore.QueryDocumentSnapshot) => {
        const d = doc.data();
        const count = await doc.ref.collection("cards").count().get();
        return {
          id: doc.id,
          name: d.name ?? "Untitled deck",
          sourcePageId: d.sourcePageId ?? null,
          sourcePageTitle: d.sourcePageTitle ?? null,
          cardCount: count.data().count,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
        };
      })
    );

    return NextResponse.json(decks);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST — create an empty deck.
export async function POST(req: Request) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const { name } = await req.json();
    const deck = {
      name: typeof name === "string" && name.trim() ? name.trim() : "New deck",
      sourcePageId: null,
      sourcePageTitle: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("decks")
      .add(deck);

    return NextResponse.json({
      id: ref.id,
      name: deck.name,
      sourcePageId: null,
      sourcePageTitle: null,
      cardCount: 0,
      createdAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
