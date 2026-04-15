
import { NextResponse } from 'next/server';
import { mutateLicenses } from '@/lib/data';
import { checkAdminApiKey } from '@/lib/auth';
import type { License } from '@/lib/types';

const DISCORD_ID_RE = /^\d{15,22}$/;
type AddSubUserMutationResult =
  | { code: "ok"; license: License }
  | { code: "license_not_found" }
  | { code: "owner_conflict"; message: string }
  | { code: "duplicate"; message: string };

type RemoveSubUserMutationResult =
  | { code: "ok"; license: License }
  | { code: "license_not_found" }
  | { code: "sub_user_not_found"; message: string };

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('addSubUser');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { key } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }
  const subUserDiscordId = typeof body.subUserDiscordId === "string" ? body.subUserDiscordId.trim() : "";

  if (!subUserDiscordId) {
    return NextResponse.json({ message: "subUserDiscordId must be provided." }, { status: 400 });
  }

  if (!DISCORD_ID_RE.test(subUserDiscordId)) {
    return NextResponse.json({ message: "Invalid subUserDiscordId provided." }, { status: 400 });
  }

  const result = await mutateLicenses<AddSubUserMutationResult>((licenses) => {
    const licenseIndex = licenses.findIndex((license) => license.key === key);
    if (licenseIndex === -1) {
      return { data: licenses, changed: false, result: { code: "license_not_found" as const } };
    }

    const license = {
      ...licenses[licenseIndex],
      subUserDiscordIds: [...(licenses[licenseIndex].subUserDiscordIds || [])],
    };

    if (license.discordId === subUserDiscordId) {
      return { data: licenses, changed: false, result: { code: "owner_conflict" as const, message: "Cannot add the owner as a sub-user." } };
    }

    if (license.subUserDiscordIds.includes(subUserDiscordId)) {
      return { data: licenses, changed: false, result: { code: "duplicate" as const, message: "Sub-user already exists on this license." } };
    }

    license.subUserDiscordIds.push(subUserDiscordId);
    license.updatedAt = new Date().toISOString();
    licenses[licenseIndex] = license;
    return { data: licenses, changed: true, result: { code: "ok" as const, license } };
  });

  if (result.code === "license_not_found") {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }

  if (result.code === "owner_conflict") {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  if (result.code === "duplicate") {
    return NextResponse.json({ message: result.message }, { status: 409 });
  }

  return NextResponse.json(result.license);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('removeSubUser');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { key } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }
  const subUserDiscordId = typeof body.subUserDiscordId === "string" ? body.subUserDiscordId.trim() : "";

  if (!subUserDiscordId) {
    return NextResponse.json({ message: "subUserDiscordId must be provided." }, { status: 400 });
  }

  if (!DISCORD_ID_RE.test(subUserDiscordId)) {
    return NextResponse.json({ message: "Invalid subUserDiscordId provided." }, { status: 400 });
  }

  const result = await mutateLicenses<RemoveSubUserMutationResult>((licenses) => {
    const licenseIndex = licenses.findIndex((license) => license.key === key);
    if (licenseIndex === -1) {
      return { data: licenses, changed: false, result: { code: "license_not_found" as const } };
    }

    const license = {
      ...licenses[licenseIndex],
      subUserDiscordIds: [...(licenses[licenseIndex].subUserDiscordIds || [])],
    };

    if (!license.subUserDiscordIds.includes(subUserDiscordId)) {
      return { data: licenses, changed: false, result: { code: "sub_user_not_found" as const, message: "Sub-user not found on this license." } };
    }

    license.subUserDiscordIds = license.subUserDiscordIds.filter((id) => id !== subUserDiscordId);
    license.updatedAt = new Date().toISOString();
    licenses[licenseIndex] = license;
    return { data: licenses, changed: true, result: { code: "ok" as const, license } };
  });

  if (result.code === "license_not_found") {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }

  if (result.code === "sub_user_not_found") {
    return NextResponse.json({ message: result.message }, { status: 404 });
  }

  return NextResponse.json(result.license);
}
