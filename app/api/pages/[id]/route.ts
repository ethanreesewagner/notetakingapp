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

// Deleting a page (and all descendants) securely
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const { id: rootId } = await params;
    const db = getAdminDb();
    const pagesRef = db.collection("users").doc(userId).collection("pages");

    // Fetch all pages to find descendants
    const allSnap = await pagesRef.get();
    const allPages = allSnap.docs.map((d) => ({ id: d.id, parentId: d.data().parentId ?? null }));

    // BFS to collect rootId + all descendants
    const toDelete = new Set<string>();
    const queue = [rootId];
    while (queue.length) {
      const current = queue.shift()!;
      toDelete.add(current);
      allPages.filter((p) => p.parentId === current).forEach((p) => queue.push(p.id));
    }

    // Delete in batches of 500
    const ids = [...toDelete];
    for (let i = 0; i < ids.length; i += 500) {
      const batch = db.batch();
      ids.slice(i, i + 500).forEach((id) => batch.delete(pagesRef.doc(id)));
      await batch.commit();
    }

    // Clean up share records for deleted pages
    for (const pageId of ids) {
      const sharesSnap = await db
        .collection("pageShares")
        .where("ownerUid", "==", userId)
        .where("pageId", "==", pageId)
        .get();
      if (!sharesSnap.empty) {
        const batch = db.batch();
        sharesSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    return NextResponse.json({ success: true, deleted: ids });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

