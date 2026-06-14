import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminAuth } from "./firebaseAdmin";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_EXPIRES_MS = 60 * 60 * 24 * 5 * 1000;

export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export function getFirebaseApiKey(): string {
  const key =
    process.env.FIREBASE_API_KEY ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) {
    throw new Error(
      "FIREBASE_API_KEY is not set. Add it to .env (server-only, no NEXT_PUBLIC_ prefix)."
    );
  }
  return key;
}

export function formatFirebaseAuthError(code: string): string {
  switch (code) {
    case "EMAIL_NOT_FOUND":
    case "INVALID_LOGIN_CREDENTIALS":
    case "INVALID_PASSWORD":
      return "Invalid email or password.";
    case "USER_DISABLED":
      return "This account has been disabled.";
    case "EMAIL_EXISTS":
      return "An account with this email already exists.";
    case "WEAK_PASSWORD":
      return "Password must be at least 6 characters.";
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return "Too many attempts. Please try again later.";
    default:
      return code.replace(/_/g, " ").toLowerCase();
  }
}

function useSecureCookies(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
  );
}

export function setSessionCookie(
  response: NextResponse,
  sessionCookie: string
): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax",
    maxAge: SESSION_EXPIRES_MS / 1000,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      displayName: decoded.name ?? null,
    };
  } catch {
    return null;
  }
}

export async function authenticateApiRequest(): Promise<
  { userId: string; user: SessionUser } | { response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { userId: user.uid, user };
}
