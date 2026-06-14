import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebaseAdmin";
import {
  formatFirebaseAuthError,
  getFirebaseApiKey,
  SESSION_EXPIRES_MS,
  setSessionCookie,
} from "../../../../lib/serverAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const userRecord = await getAdminAuth().createUser({
      email,
      password,
      displayName: name || undefined,
    });

    await getAdminDb().collection("users").doc(userRecord.uid).set({
      info: {
        name: name || null,
        email,
        createdAt: new Date().toISOString(),
      },
    });

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
      const code = signInData?.error?.message ?? "SIGNUP_FAILED";
      return NextResponse.json(
        { error: formatFirebaseAuthError(code) },
        { status: 400 }
      );
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(
      signInData.idToken,
      { expiresIn: SESSION_EXPIRES_MS }
    );

    const response = NextResponse.json({
      user: {
        uid: userRecord.uid,
        email: userRecord.email ?? null,
        displayName: name || userRecord.displayName || null,
      },
    });

    setSessionCookie(response, sessionCookie);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Signup failed";
    if (message.includes("auth/email-already-exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 400 }
      );
    }
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
