import { NextResponse } from "next/server";
import { getAdminDb } from "./firebaseAdmin";
import * as admin from "firebase-admin";
import { authenticateApiRequest } from "./serverAuth";

// Shared CRUD helpers for a user's per-collection media playlists (music
// "tracks" and background-video "lectures"). Both are stored under
// users/{uid}/{sub} with the same shape: { videoId, title, artist, order }.

// Extract an 11-char YouTube video ID from common URL / share forms.
function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
  }
  return null;
}

function statusFor(message: string): number {
  return message.includes("Firebase Admin") ? 503 : 500;
}

// GET — list a user's items, sorted by their fractional `order`.
export async function listMedia(sub: string) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const snap = await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection(sub)
      .get();

    const items = snap.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => {
      const d = doc.data();
      const createdMs = d.createdAt?.toMillis?.() ?? 0;
      return {
        id: doc.id,
        videoId: d.videoId,
        title: d.title ?? "",
        artist: d.artist ?? "",
        order: typeof d.order === "number" ? d.order : createdMs,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    items.sort((a, b) => a.order - b.order);
    return NextResponse.json(items);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

// POST — add an item from a YouTube link (appended to the end).
export async function createMedia(
  sub: string,
  req: Request,
  defaultArtist: string,
  fallbackTitle: string
) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const { url, title } = await req.json();
    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "A YouTube link is required." }, { status: 400 });
    }

    const videoId = parseYouTubeId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Could not find a YouTube video ID in that link." },
        { status: 400 }
      );
    }

    const order = Date.now();
    const newItem = {
      videoId,
      title: typeof title === "string" && title.trim() ? title.trim() : fallbackTitle,
      artist: defaultArtist,
      order,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection(sub)
      .add(newItem);

    return NextResponse.json({
      id: docRef.id,
      videoId,
      title: newItem.title,
      artist: newItem.artist,
      order,
      createdAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

// PUT — update an item's title and/or order (used for rename and reorder).
export async function updateMedia(sub: string, id: string, req: Request) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (typeof body.title === "string") update.title = body.title.trim() || "Untitled";
    if (typeof body.order === "number" && isFinite(body.order)) update.order = body.order;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection(sub)
      .doc(id)
      .update(update);

    return NextResponse.json({ success: true, ...update });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

// DELETE — remove an item.
export async function deleteMedia(sub: string, id: string) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection(sub)
      .doc(id)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}
