import { clerkClient, getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  ensureConvexUser,
  fetchConvexState,
  listConvexUserDevices,
  getWeatherBySerial,
} from '@/lib/server/convex';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8081';

type StateResponse = {
  devices: string[];
  deviceState: Record<string, Record<string, any>>;
};

function emptyState(): StateResponse {
  return { devices: [], deviceState: {} };
}

function sanitizeSerial(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return /^[A-Za-z0-9]+$/.test(trimmed) ? trimmed : undefined;
}

function filterStateBySerials(data: any, serials: string[]): StateResponse {
  if (!data) return emptyState();
  if (!Array.isArray(serials) || serials.length === 0) {
    return emptyState();
  }

  const filteredState: Record<string, Record<string, any>> = {};
  const filteredDevices: string[] = [];

  for (const serial of serials) {
    if (data.deviceState && data.deviceState[serial]) {
      filteredState[serial] = data.deviceState[serial];
      filteredDevices.push(serial);
    }
  }

  return {
    devices: filteredDevices,
    deviceState: filteredState,
  };
}

async function fetchBackendState(serials: string[]): Promise<StateResponse> {
  if (serials.length === 0) return emptyState();

  const lookup = serials.length === 1 ? `?serial=${encodeURIComponent(serials[0])}` : '';

  const response = await fetch(`${BACKEND_URL}/status${lookup}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  const data = await response.json();
  return filterStateBySerials(data, serials);
}

async function injectWeatherData(stateResponse: StateResponse): Promise<StateResponse> {
  for (const serial of stateResponse.devices) {
    try {
      const weatherData = await getWeatherBySerial(serial);
      if (weatherData?.data) {
        const postalCode = weatherData.postalCode || '';
        const country = weatherData.country || '';

        const possibleKeys = [
          `${postalCode},${country}`,
          postalCode,
          `${postalCode}, ${country}`,
        ];

        let locationWeather = null;
        for (const key of possibleKeys) {
          if (weatherData.data[key]) {
            locationWeather = weatherData.data[key];
            break;
          }
        }

        if (locationWeather?.current) {
          if (!stateResponse.deviceState[serial]) {
            stateResponse.deviceState[serial] = {};
          }

          const weatherStateKey = `weather.${serial}`;
          stateResponse.deviceState[serial][weatherStateKey] = {
            object_revision: 0,
            object_timestamp: weatherData.fetchedAt || Date.now(),
            value: {
              current: {
                temperature: locationWeather.current.temp_c,
                temp_c: locationWeather.current.temp_c,
                temp_f: locationWeather.current.temp_f,
              }
            }
          };
        }
      }
    } catch (error) {
      console.error(`[API] Failed to fetch weather for ${serial}:`, error);
    }
  }

  return stateResponse;
}

export async function GET(request: NextRequest) {
  const serializedParam = sanitizeSerial(request.nextUrl.searchParams.get('serial'));

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

    if (serializedParam) {
      serials = serials.filter((serial) => serial === serializedParam);
      if (serials.length === 0) {
        return NextResponse.json(emptyState(), { status: 403 });
      }
    }

    if (serials.length === 0) {
      return NextResponse.json(emptyState());
    }

    for (const serial of serials) {
      try {
        await fetch(`${BACKEND_URL}/status?serial=${encodeURIComponent(serial)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
      } catch {
      }
    }

    const convexData = await fetchConvexState();
    if (convexData) {
      const filteredData = filterStateBySerials(convexData, serials);
      const withWeather = await injectWeatherData(filteredData);
      return NextResponse.json(withWeather);
    }

    const fallback = await fetchBackendState(serials);
    const fallbackWithWeather = await injectWeatherData(fallback);
    return NextResponse.json(fallbackWithWeather);
  } catch (error) {
    console.error('[API] Failed to fetch status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch thermostat status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
