import { NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebaseAdmin';
import { getSessionUser } from '../../../../lib/serverAuth';

export const dynamic = 'force-dynamic';

// GET — resolve a share token and return page content if the user has access
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const db = getAdminDb();

    // Look up the share record
    const snap = await db
      .collection('pageShares')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    const shareDoc = snap.docs[0];
    const share = shareDoc.data();

    // Check access for private shares
    if (share.type === 'private') {
      const sessionUser = await getSessionUser();
      if (!sessionUser?.email) {
        return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
      }
      const emails: string[] = share.emails ?? [];
      if (!emails.includes(sessionUser.email)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Fetch the actual page content
    const pageRef = db
      .collection('users')
      .doc(share.ownerUid)
      .collection('pages')
      .doc(share.pageId);

    const pageDoc = await pageRef.get();
    if (!pageDoc.exists) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const data = pageDoc.data()!;
    return NextResponse.json({
      id: pageDoc.id,
      title: data.title ?? 'Untitled',
      content: data.content ?? '[]',
      ownerEmail: share.ownerEmail ?? '',
      shareType: share.type,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
