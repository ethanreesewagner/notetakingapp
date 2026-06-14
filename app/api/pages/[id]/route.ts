import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { authenticateApiRequest } from '../../../../lib/serverAuth';

export const dynamic = 'force-dynamic';

// Updating a page securely
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const body = await req.json();
    const updateData: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.parentId !== undefined) updateData.parentId = body.parentId;

    const { id } = await params;

    const pageRef = getAdminDb().collection("users").doc(userId).collection("pages").doc(id);
    await pageRef.update(updateData);

    return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
