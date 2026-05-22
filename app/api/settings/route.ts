import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { userSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { encrypt } from '@/lib/encryption';

type SettingsResponse = {
  monthlySpendCapUsd: number;
  defaultMaxWebSearches: number;
  hasApiKey: boolean;
};

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  if (!settings) {
    return NextResponse.json<SettingsResponse>({
      monthlySpendCapUsd: 50,
      defaultMaxWebSearches: 3,
      hasApiKey: false,
    });
  }

  return NextResponse.json<SettingsResponse>({
    monthlySpendCapUsd: Number(settings.monthlySpendCapUsd),
    defaultMaxWebSearches: settings.defaultMaxWebSearches,
    hasApiKey: settings.anthropicApiKeyEncrypted !== null,
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  let body: { monthlySpendCapUsd?: number; defaultMaxWebSearches?: number; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    if (body.monthlySpendCapUsd !== undefined) {
      if (typeof body.monthlySpendCapUsd !== 'number' || body.monthlySpendCapUsd < 0) {
        return NextResponse.json({ error: 'monthlySpendCapUsd must be a non-negative number' }, { status: 400 });
      }
    }
    if (body.defaultMaxWebSearches !== undefined) {
      if (!Number.isInteger(body.defaultMaxWebSearches) || body.defaultMaxWebSearches < 0 || body.defaultMaxWebSearches > 20) {
        return NextResponse.json({ error: 'defaultMaxWebSearches must be an integer 0–20' }, { status: 400 });
      }
    }

    const updates: {
      monthlySpendCapUsd?: string;
      defaultMaxWebSearches?: number;
      anthropicApiKeyEncrypted?: string | null;
    } = {};

    if (body.monthlySpendCapUsd !== undefined) {
      updates.monthlySpendCapUsd = String(body.monthlySpendCapUsd);
    }
    if (body.defaultMaxWebSearches !== undefined) {
      updates.defaultMaxWebSearches = body.defaultMaxWebSearches;
    }
    if (body.apiKey !== undefined) {
      if (body.apiKey === '') {
        updates.anthropicApiKeyEncrypted = null;
      } else {
        updates.anthropicApiKeyEncrypted = encrypt(body.apiKey);
      }
    }

    await db
      .insert(userSettings)
      .values({ userId, ...updates })
      .onConflictDoUpdate({ target: userSettings.userId, set: updates });

    const [updated] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!updated) {
      return NextResponse.json<SettingsResponse>({
        monthlySpendCapUsd: 50,
        defaultMaxWebSearches: 3,
        hasApiKey: false,
      });
    }

    return NextResponse.json<SettingsResponse>({
      monthlySpendCapUsd: Number(updated.monthlySpendCapUsd),
      defaultMaxWebSearches: updated.defaultMaxWebSearches,
      hasApiKey: updated.anthropicApiKeyEncrypted !== null,
    });
  } catch (err) {
    console.error('Settings PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
