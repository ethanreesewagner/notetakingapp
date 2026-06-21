import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import { authenticateApiRequest } from '../../../lib/serverAuth';

export const dynamic = 'force-dynamic';

// GET — list all pages privately shared with the current user
export async function GET(req: Request) {
  try {
    const auth = await authenticateApiRequest();
    if ('response' in auth) return auth.response;
    const user = auth.user;

    if (!user.email) {
      return NextResponse.json([]);
    }

    const db = getAdminDb();

    // Private shares where the user's email is in the emails array
    const snap = await db
      .collection('pageShares')
      .where('type', '==', 'private')
      .where('emails', 'array-contains', user.email)
      .get();

    const host = req.headers.get('host') ?? 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') ?? 'http';
    const base = `${proto}://${host}`;

    const shares = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        shareId: doc.id,
        pageId: data.pageId,
        pageTitle: data.pageTitle ?? 'Untitled',
        ownerUid: data.ownerUid,
        ownerEmail: data.ownerEmail ?? '',
        token: data.token,
        url: `${base}/shared/${data.token}`,
      };
    });

    return NextResponse.json(shares);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
