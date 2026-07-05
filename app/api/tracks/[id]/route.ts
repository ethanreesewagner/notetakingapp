import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/firebaseAdmin";
import { authenticateApiRequest } from "../../../../lib/serverAuth";

export const dynamic = "force-dynamic";

// DELETE — remove one of the user's personal tracks.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const { id } = await params;

    await getAdminDb()
      .collection("users")
      .doc(auth.userId)
      .collection("tracks")
      .doc(id)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
