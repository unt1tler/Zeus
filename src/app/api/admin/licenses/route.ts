
import { NextResponse } from 'next/server';
import { getLicenses, mutateLicenses, getProducts, fetchDiscordUser } from '@/lib/data';
import { checkAdminApiKey } from '@/lib/auth';
import type { License } from '@/lib/types';
import { z } from 'zod';

const createLicenseSchema = z.object({
  productId: z.string().min(1),
  discordId: z.string().regex(/^\d{15,22}$/),
  discordUsername: z.string().trim().min(1).max(64).optional(),
  email: z.string().email().optional().or(z.literal("")),
  expiresAt: z.string().datetime().optional().or(z.literal("")),
  maxIps: z.coerce.number().int().min(-2).max(1000).default(1),
  maxHwids: z.coerce.number().int().min(-2).max(1000).default(1),
  platform: z.string().trim().min(1).max(64).default('custom'),
  platformUserId: z.string().trim().max(255).optional().or(z.literal("")),
  subUserDiscordIds: z.array(z.string().regex(/^\d{15,22}$/)).max(100).default([]),
}).strict();

export async function GET() {
  const auth = await checkAdminApiKey('getLicenses');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const [licenses, products] = await Promise.all([getLicenses(), getProducts()]);
  const productMap = new Map(products.map(p => [p.id, p]));

  const populatedLicenses = licenses.map(license => ({
    ...license,
    productName: productMap.get(license.productId)?.name || 'N/A',
  }));

  return NextResponse.json(populatedLicenses);
}

export async function POST(request: Request) {
  const auth = await checkAdminApiKey('createLicense');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = createLicenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid license payload.", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    let {
      productId,
      discordId,
      discordUsername,
      email,
      expiresAt,
      maxIps,
      maxHwids,
      platform,
      platformUserId,
      subUserDiscordIds,
    } = parsed.data;

    const products = await getProducts();
    if (!products.some(p => p.id === productId)) {
      return NextResponse.json({ message: "Product not found." }, { status: 404 });
    }

    if (!discordUsername) {
      const user = await fetchDiscordUser(discordId);
      if (user) discordUsername = user.username;
    }

    const newLicense: License = {
      id: crypto.randomUUID(),
      key: `LF-${crypto.randomUUID().toUpperCase()}`,
      productId,
      discordId,
      discordUsername,
      email: email || undefined,
      platform,
      platformUserId: platformUserId || undefined,
      subUserDiscordIds,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      status: 'active',
      allowedIps: [],
      maxIps,
      allowedHwids: [],
      maxHwids,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validations: 0,
      source: 'zeus',
    };

    await mutateLicenses((licenses) => {
      licenses.unshift(newLicense);
      return { data: licenses, changed: true, result: undefined };
    });

    return NextResponse.json(newLicense, { status: 201 });
  } catch {
    return NextResponse.json({ message: "An internal server error occurred." }, { status: 500 });
  }
}
