import { NextResponse } from "next/server";
import { getChatMessages } from "../../../../lib/chatHistory";
import { authenticateApiRequest } from "../../../../lib/serverAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;

    const messages = await getChatMessages(auth.userId);
    return NextResponse.json({ messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
