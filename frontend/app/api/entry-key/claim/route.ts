import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { claimConvexEntryKey, ensureConvexUser } from '@/lib/server/convex';

export async function POST(request: NextRequest) {
  try {
    let { userId } = await auth();
    let email: string | undefined;

    if (!userId) {
      const user = await currentUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
      email =
        user.primaryEmailAddress?.emailAddress ||
        user.emailAddresses?.[0]?.emailAddress ||
        undefined;
    } else {
      const user = await currentUser();
      email =
        user?.primaryEmailAddress?.emailAddress ||
        user?.emailAddresses?.[0]?.emailAddress ||
        undefined;
    }

    const body = await request.json().catch(() => null);
    const code: string | undefined = body?.code;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Entry key is required' }, { status: 400 });
    }

    const normalizedCode = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (normalizedCode.length !== 7) {
      return NextResponse.json({ error: 'Entry key must be 7 alphanumeric characters' }, { status: 400 });
    }

    await ensureConvexUser(userId, email ?? '');

    const result = await claimConvexEntryKey(normalizedCode, userId);

    return NextResponse.json({ success: true, serial: result?.serial });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Failed to claim entry key:', message);
    return NextResponse.json(
      {
        error: 'Failed to claim entry key',
        message,
      },
      { status: 400 }
    );
  }
}
