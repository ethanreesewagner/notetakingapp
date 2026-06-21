import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../../lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import { authenticateApiRequest } from '../../../../../lib/serverAuth';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

function generateToken(): string {
  return randomBytes(18).toString('base64url');
}

function getBaseUrl(req: Request): string {
  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

// GET — fetch current share settings for a page
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ('response' in auth) return auth.response;
    const userId = auth.userId;
    const { id: pageId } = await params;

    // Verify the page belongs to the user
    const pageRef = getAdminDb()
      .collection('users')
      .doc(userId)
      .collection('pages')
      .doc(pageId);
    const pageDoc = await pageRef.get();
    if (!pageDoc.exists) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const sharesSnap = await getAdminDb()
      .collection('pageShares')
      .where('ownerUid', '==', userId)
      .where('pageId', '==', pageId)
      .limit(1)
      .get();

    if (sharesSnap.empty) {
      return NextResponse.json(null);
    }

    const doc = sharesSnap.docs[0];
    const data = doc.data();
    const base = getBaseUrl(req);
    return NextResponse.json({
      shareId: doc.id,
      type: data.type,
      emails: data.emails ?? [],
      token: data.token,
      url: `${base}/shared/${data.token}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — create or update share
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ('response' in auth) return auth.response;
    const userId = auth.userId;
    const user = auth.user;
    const { id: pageId } = await params;

    const { type, emails } = (await req.json()) as {
      type: 'public' | 'private';
      emails?: string[];
    };

    // Verify ownership
    const pageRef = getAdminDb()
      .collection('users')
      .doc(userId)
      .collection('pages')
      .doc(pageId);
    const pageDoc = await pageRef.get();
    if (!pageDoc.exists) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }
    const pageTitle: string = pageDoc.data()?.title ?? 'Untitled';

    const db = getAdminDb();
    const sharesRef = db.collection('pageShares');

    // Check if a share already exists
    const existing = await sharesRef
      .where('ownerUid', '==', userId)
      .where('pageId', '==', pageId)
      .limit(1)
      .get();

    let shareId: string;
    let token: string;

    if (!existing.empty) {
      const docRef = existing.docs[0].ref;
      token = existing.docs[0].data().token as string;
      shareId = existing.docs[0].id;
      await docRef.update({
        type,
        emails: type === 'private' ? (emails ?? []) : [],
        pageTitle,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      token = generateToken();
      const newShare = {
        ownerUid: userId,
        ownerEmail: user.email ?? '',
        pageId,
        pageTitle,
        type,
        emails: type === 'private' ? (emails ?? []) : [],
        token,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const docRef = await sharesRef.add(newShare);
      shareId = docRef.id;
    }

    const base = getBaseUrl(req);
    return NextResponse.json({
      shareId,
      token,
      url: `${base}/shared/${token}`,
      type,
      emails: type === 'private' ? (emails ?? []) : [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — revoke share
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest();
    if ('response' in auth) return auth.response;
    const userId = auth.userId;
    const { id: pageId } = await params;

    const db = getAdminDb();
    const snap = await db
      .collection('pageShares')
      .where('ownerUid', '==', userId)
      .where('pageId', '==', pageId)
      .get();

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
