import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureConvexUser,
  listConvexUserDevices,
  getScheduleBySerial,
} from '@/lib/server/convex';

function sanitizeSerial(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return /^[A-Za-z0-9]+$/.test(trimmed) ? trimmed : undefined;
}

export async function GET(request: NextRequest) {
  const serialParam = sanitizeSerial(request.nextUrl.searchParams.get('serial'));

  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const primaryEmailId = user?.primaryEmailAddressId;
      const primaryEmail =
        user?.emailAddresses?.find((address) => address.id === primaryEmailId)?.emailAddress ??
        user?.emailAddresses?.[0]?.emailAddress ??
        '';
      if (primaryEmail) {
        await ensureConvexUser(userId, primaryEmail);
      }
    } catch {
    }

    const deviceRecords = await listConvexUserDevices(userId);
    let serials = deviceRecords
      .map((record) => record?.serial)
      .filter((serial): serial is string => Boolean(serial));

    if (!serialParam) {
      return NextResponse.json({ error: 'Serial parameter required' }, { status: 400 });
    }

    if (!serials.includes(serialParam)) {
      return NextResponse.json({ error: 'Device not found or unauthorized' }, { status: 403 });
    }

    const scheduleData = await getScheduleBySerial(serialParam);

    if (!scheduleData) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json(scheduleData);
  } catch (error) {
    console.error('[API] Failed to fetch schedule:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch schedule',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
