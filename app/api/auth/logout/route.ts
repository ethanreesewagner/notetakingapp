import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminAuth } from "../../../../lib/firebaseAdmin";
import {
  clearSessionCookie,
  SESSION_COOKIE_NAME,
} from "../../../../lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);

    if (session) {
      try {
        const decoded = await getAdminAuth().verifySessionCookie(session);
        await getAdminAuth().revokeRefreshTokens(decoded.sub);
      } catch {
        /* session already invalid */
      }
    }

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Logout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
