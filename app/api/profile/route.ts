import { NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "../../../lib/firebaseAdmin";
import { authenticateApiRequest } from "../../../lib/serverAuth";

export const dynamic = "force-dynamic";

// Photo is stored as a (small, client-resized) data URL or an image URL in
// Firestore. Cap it so the user document stays well under the 1MB limit.
const MAX_PHOTO_CHARS = 700_000;

// GET — the current user's editable profile.
export async function GET() {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const doc = await getAdminDb().collection("users").doc(auth.userId).get();
    const info = (doc.data()?.info ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      name: (info.name as string) ?? auth.user.displayName ?? "",
      email: auth.user.email ?? (info.email as string) ?? "",
      bio: (info.bio as string) ?? "",
      photoURL: (info.photoURL as string) ?? "",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// PUT — update display name, bio, and/or profile picture.
export async function PUT(req: Request) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const body = await req.json();
    const infoPatch: Record<string, unknown> = {};

    if (typeof body.name === "string") infoPatch.name = body.name.trim().slice(0, 120);
    if (typeof body.bio === "string") infoPatch.bio = body.bio.slice(0, 500);
    if (typeof body.photoURL === "string") {
      if (body.photoURL.length > MAX_PHOTO_CHARS) {
        return NextResponse.json(
          { error: "That image is too large. Please choose a smaller one." },
          { status: 400 }
        );
      }
      infoPatch.photoURL = body.photoURL;
    }

    if (Object.keys(infoPatch).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .set({ info: infoPatch }, { merge: true });

    // Keep the auth display name in sync (skip photoURL — data URLs are too long).
    if (typeof infoPatch.name === "string") {
      try {
        await getAdminAuth().updateUser(auth.userId, {
          displayName: (infoPatch.name as string) || undefined,
        });
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({ success: true, ...infoPatch });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
