import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { ensureConvexUser, listConvexUserDevices } from '@/lib/server/convex';
import { fahrenheitToCelsius } from '@/lib/utils/temperature';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8081';
const FAHRENHEIT_THRESHOLD = 45;

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeTemperatureFields(payload: Record<string, any>) {
  const rawScale =
    typeof payload.temperature_scale === 'string'
      ? payload.temperature_scale.trim().toUpperCase()
      : '';
  const shouldConvert = rawScale === 'F';

  if (rawScale === 'F' || rawScale === 'C') {
    payload.temperature_scale = rawScale;
  } else {
    delete payload.temperature_scale;
  }

  const convertField = (key: string) => {
    if (!(key in payload)) return;
    const numeric = toNumber(payload[key]);
    if (numeric === undefined) {
      delete payload[key];
      return;
    }
    const needsConversion = shouldConvert || (!rawScale && numeric > FAHRENHEIT_THRESHOLD);
    payload[key] = needsConversion ? fahrenheitToCelsius(numeric) : numeric;
  };

  convertField('value');
  convertField('low');
  convertField('high');
  convertField('temp');
  convertField('target_temperature_low');
  convertField('target_temperature_high');
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let email = '';
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const primaryEmailId = user?.primaryEmailAddressId;
      email =
        user?.emailAddresses?.find((address) => address.id === primaryEmailId)?.emailAddress ||
        user?.emailAddresses?.[0]?.emailAddress ||
        '';
    } catch {
      email = '';
    }

    if (email) {
      await ensureConvexUser(userId, email);
    }

    const body = await request.json();

    if (!body.action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    const serial =
      typeof body.serial === 'string' && body.serial.trim().length
        ? body.serial.trim()
        : undefined;

    if (!serial) {
      return NextResponse.json(
        { error: 'Missing required field: serial' },
        { status: 400 }
      );
    }

    const ownedDevices = await listConvexUserDevices(userId);
    if (!ownedDevices.some((device) => device.serial === serial)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const action = String(body.action).toLowerCase();
    const payload: Record<string, any> = {
      ...body,
      action,
      serial,
      user: {
        clerkId: userId,
        email: email || undefined,
      },
    };

    if (typeof payload.mode === 'string') {
      payload.mode = payload.mode.toLowerCase();
    }

    if (action === 'temp' || action === 'temperature') {
      normalizeTemperatureFields(payload);
      if (typeof payload.value !== 'number') {
        return NextResponse.json(
          { error: 'Invalid temperature value' },
          { status: 400 }
        );
      }
    }

    const response = await fetch(`${BACKEND_URL}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Backend returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Failed to send command:', error);
    return NextResponse.json(
      {
        error: 'Failed to send command to thermostat',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
