import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../../lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { authenticateApiRequest } from "../../../../../lib/serverAuth";
import { initialSrs } from "../../../../../lib/srs";

export const dynamic = "force-dynamic";

// GET — all cards in a deck, ordered.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const { id } = await params;

    const snap = await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("decks")
      .doc(id)
      .collection("cards")
      .get();

    const cards = snap.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => {
      const d = doc.data();
      const srs = initialSrs();
      return {
        id: doc.id,
        front: d.front ?? "",
        back: d.back ?? "",
        order: typeof d.order === "number" ? d.order : 0,
        dueAt: typeof d.dueAt === "number" ? d.dueAt : srs.dueAt,
        interval: typeof d.interval === "number" ? d.interval : srs.interval,
        ease: typeof d.ease === "number" ? d.ease : srs.ease,
        reps: typeof d.reps === "number" ? d.reps : srs.reps,
        lapses: typeof d.lapses === "number" ? d.lapses : srs.lapses,
      };
    });

    cards.sort((a, b) => a.order - b.order);
    return NextResponse.json(cards);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST — add a card to a deck.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const { id } = await params;

    const { front, back } = await req.json();
    if (typeof front !== "string" || !front.trim()) {
      return NextResponse.json({ error: "A front is required." }, { status: 400 });
    }

    const order = Date.now();
    const srs = initialSrs();
    const card = {
      front: front.trim(),
      back: typeof back === "string" ? back.trim() : "",
      order,
      ...srs,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("decks")
      .doc(id)
      .collection("cards")
      .add(card);

    return NextResponse.json({ id: ref.id, front: card.front, back: card.back, order, ...srs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
