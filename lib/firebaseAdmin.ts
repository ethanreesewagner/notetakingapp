import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

export const FIREBASE_ADMIN_SETUP_HINT =
  process.env.VERCEL === "1"
    ? "On Vercel, open Project Settings → Environment Variables and add FIREBASE_SERVICE_ACCOUNT_JSON with the full service account JSON from Firebase Console → Project settings → Service accounts → Generate new private key. Redeploy after saving."
    : "Set Firebase Admin credentials: FIREBASE_SERVICE_ACCOUNT_JSON (full JSON; recommended on Vercel), FIREBASE_SERVICE_ACCOUNT_PATH (local path to JSON file), or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.";

function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

function fromParsedJson(parsed: Record<string, unknown>): admin.ServiceAccount | null {
  const projectId = (parsed.project_id ?? parsed.projectId) as string | undefined;
  const clientEmail = (parsed.client_email ?? parsed.clientEmail) as
    | string
    | undefined;
  const privateKeyRaw = (parsed.private_key ?? parsed.privateKey) as
    | string
    | undefined;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKeyRaw),
  };
}

function parseServiceAccountJson(raw: string): admin.ServiceAccount | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const attempts = [trimmed];
  if (!trimmed.startsWith("{")) {
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
      if (decoded.startsWith("{")) attempts.push(decoded);
    } catch {
      /* not base64 */
    }
  }

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const account = fromParsedJson(parsed);
      if (account) return account;
    } catch {
      /* try next format */
    }
  }

  return null;
}

function loadFromCredentialsFile(filePath: string): admin.ServiceAccount | null {
  try {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    const parsed = JSON.parse(
      fs.readFileSync(resolved, "utf8")
    ) as Record<string, unknown>;
    return fromParsedJson(parsed);
  } catch (e) {
    console.warn(
      `Could not read Firebase service account file at ${filePath}:`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

function loadDefaultLocalCredentialsFile(): admin.ServiceAccount | null {
  if (process.env.VERCEL === "1") return null;

  const credentialsDir = path.join(process.cwd(), "credentials");
  if (!fs.existsSync(credentialsDir)) return null;

  const jsonFiles = fs
    .readdirSync(credentialsDir)
    .filter((name) => name.endsWith(".json"));
  if (jsonFiles.length !== 1) return null;

  return loadFromCredentialsFile(path.join("credentials", jsonFiles[0]));
}

function loadServiceAccount(): admin.ServiceAccount | null {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    const account = parseServiceAccountJson(jsonEnv);
    if (account) return account;
    console.warn("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (filePath) {
    const account = loadFromCredentialsFile(filePath);
    if (account) return account;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKeyRaw) {
    if (
      !privateKeyRaw.includes("YOUR_KEY_HERE") &&
      privateKeyRaw.includes("BEGIN PRIVATE KEY")
    ) {
      return {
        projectId,
        clientEmail,
        privateKey: normalizePrivateKey(privateKeyRaw),
      };
    }
  }

  return loadDefaultLocalCredentialsFile();
}

let initAttempted = false;
let initError: string | null = null;

function initializeFirebaseAdmin(): void {
  if (admin.apps.length) return;
  if (initAttempted && initError) {
    throw new Error(initError);
  }

  initAttempted = true;
  const serviceAccount = loadServiceAccount();

  if (!serviceAccount) {
    initError = `Firebase Admin credentials are missing or invalid. ${FIREBASE_ADMIN_SETUP_HINT}`;
    throw new Error(initError);
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initError = null;
  } catch (e) {
    initError =
      e instanceof Error
        ? `Firebase Admin failed to initialize: ${e.message}. ${FIREBASE_ADMIN_SETUP_HINT}`
        : `Firebase Admin failed to initialize. ${FIREBASE_ADMIN_SETUP_HINT}`;
    throw new Error(initError);
  }
}

export function isFirebaseAdminConfigured(): boolean {
  try {
    if (admin.apps.length) return true;
    return loadServiceAccount() !== null;
  } catch {
    return false;
  }
}

export function getAdminAuth(): admin.auth.Auth {
  initializeFirebaseAdmin();
  return admin.auth();
}

export function getAdminDb(): admin.firestore.Firestore {
  initializeFirebaseAdmin();
  return admin.firestore();
}

/** @deprecated Use getAdminDb() */
export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(_target, prop) {
    const db = getAdminDb() as admin.firestore.Firestore & Record<string, unknown>;
    const value = db[prop as keyof typeof db];
    return typeof value === "function" ? value.bind(db) : value;
  },
});

/** @deprecated Use getAdminAuth() */
export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_target, prop) {
    const auth = getAdminAuth() as admin.auth.Auth & Record<string, unknown>;
    const value = auth[prop as keyof typeof auth];
    return typeof value === "function" ? value.bind(auth) : value;
  },
});
