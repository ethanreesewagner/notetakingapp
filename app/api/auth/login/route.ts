import { NextResponse } from "next/server";
import { getAdminAuth } from "../../../../lib/firebaseAdmin";
import {
  formatFirebaseAuthError,
  getFirebaseApiKey,
  SESSION_EXPIRES_MS,
  setSessionCookie,
} from "../../../../lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const apiKey = getFirebaseApiKey();
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const signInData = await signInRes.json();
    if (!signInRes.ok) {
      const code = signInData?.error?.message ?? "LOGIN_FAILED";
      return NextResponse.json(
        { error: formatFirebaseAuthError(code) },
        { status: 401 }
      );
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(
      signInData.idToken,
      { expiresIn: SESSION_EXPIRES_MS }
    );

    const response = NextResponse.json({
      user: {
        uid: signInData.localId,
        email: signInData.email ?? null,
        displayName: signInData.displayName ?? null,
      },
    });

    setSessionCookie(response, sessionCookie);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Login failed";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
