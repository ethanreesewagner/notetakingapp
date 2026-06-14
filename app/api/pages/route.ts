import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { authenticateApiRequest } from '../../../lib/serverAuth';

export const dynamic = 'force-dynamic';

// Subscribing/Fetching pages securely
export async function GET() {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const snapshot = await getAdminDb().collection('users').doc(userId).collection('pages').orderBy('createdAt', 'desc').get();
    
    const pages = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        parentId: data.parentId ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      };
    });

    return NextResponse.json(pages);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// Creating a page securely
export async function POST(req: Request) {
  try {
    const auth = await authenticateApiRequest();
    if ("response" in auth) return auth.response;
    const userId = auth.userId;

    const { title, parentId } = await req.json();

    if (parentId) {
      const parentRef = getAdminDb()
        .collection("users")
        .doc(userId)
        .collection("pages")
        .doc(parentId);
      const parentDoc = await parentRef.get();
      if (!parentDoc.exists) {
        return NextResponse.json({ error: "Parent page not found" }, { status: 404 });
      }
    }

    const newPage = {
      title: title || "Untitled",
      content: "[]",
      parentId: parentId ?? null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await getAdminDb().collection("users").doc(userId).collection("pages").add(newPage);

    // Fetch correctly populated timestamps if necessary, but returning a generic stub is fine for optimism
    return NextResponse.json({ 
      id: docRef.id, 
      ...newPage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Firebase Admin") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
