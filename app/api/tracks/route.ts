import { NextResponse } from "next/server";
import { getAdminDb } from "../../../lib/firebaseAdmin";
import * as admin from "firebase-admin";
import { authenticateApiRequest } from "../../../lib/serverAuth";

export const dynamic = "force-dynamic";

// Extract an 11-char YouTube video ID from any common YouTube URL/share form.
function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  // Already a bare video ID.
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

// GET — the current user's personal saved tracks.
export async function GET() {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const snapshot = await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("tracks")
      .orderBy("createdAt", "asc")
      .get();

    const tracks = snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: doc.id,
        videoId: data.videoId,
        title: data.title ?? "",
        artist: data.artist ?? "",
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      };
    });

    return NextResponse.json(tracks);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST — add a YouTube link to the personal playlist.
export async function POST(req: Request) {
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

    const newTrack = {
      videoId,
      title: typeof title === "string" && title.trim() ? title.trim() : "My Track",
      artist: "Added by you",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("tracks")
      .add(newTrack);

    return NextResponse.json({
      id: docRef.id,
      videoId: newTrack.videoId,
      title: newTrack.title,
      artist: newTrack.artist,
      createdAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
