
import { NextResponse } from 'next/server';
import { getLicenses, saveLicenses } from '@/lib/data';
import { checkAdminApiKey } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('addSubUser');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const { key } = await params;
  const body = await request.json();
  const { subUserDiscordId } = body;

  if (!subUserDiscordId) {
    return NextResponse.json({ message: "subUserDiscordId must be provided." }, { status: 400 });
  }

  const licenses = await getLicenses();
  const licenseIndex = licenses.findIndex(l => l.key === key);

  if (licenseIndex === -1) {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }

  const license = licenses[licenseIndex];

  if (!license.subUserDiscordIds) license.subUserDiscordIds = [];

  if (license.discordId === subUserDiscordId) {
    return NextResponse.json({ message: "Cannot add the owner as a sub-user." }, { status: 400 });
  }

  if (license.subUserDiscordIds.includes(subUserDiscordId)) {
    return NextResponse.json({ message: "Sub-user already exists on this license." }, { status: 409 });
  }

  license.subUserDiscordIds.push(subUserDiscordId);
  license.updatedAt = new Date().toISOString();
  licenses[licenseIndex] = license;
  await saveLicenses(licenses);

  return NextResponse.json(license);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('removeSubUser');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const { key } = await params;
  const body = await request.json();
  const { subUserDiscordId } = body;

  if (!subUserDiscordId) {
    return NextResponse.json({ message: "subUserDiscordId must be provided." }, { status: 400 });
  }

  const licenses = await getLicenses();
  const licenseIndex = licenses.findIndex(l => l.key === key);

  if (licenseIndex === -1) {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }

  const license = licenses[licenseIndex];

  if (!license.subUserDiscordIds?.includes(subUserDiscordId)) {
    return NextResponse.json({ message: "Sub-user not found on this license." }, { status: 404 });
  }

  license.subUserDiscordIds = license.subUserDiscordIds.filter(id => id !== subUserDiscordId);
  license.updatedAt = new Date().toISOString();
  licenses[licenseIndex] = license;
  await saveLicenses(licenses);

  return NextResponse.json(license);
}
