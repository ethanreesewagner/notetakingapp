import { isFirebaseAdminConfigured } from "../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const firebaseApiKey = Boolean(
    process.env.FIREBASE_API_KEY ?? process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  );
  const llmConfigured = Boolean(
    process.env.OPENAI_API_KEY ?? process.env.NVIDIA_API_KEY
  );

  return Response.json({
    ok: firebaseApiKey && isFirebaseAdminConfigured(),
    checks: {
      firebaseApiKey,
      firebaseAdmin: isFirebaseAdminConfigured(),
      llm: llmConfigured,
    },
  });
}
