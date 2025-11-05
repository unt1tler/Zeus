
import { NextResponse } from 'next/server';
import { getLicenses, saveLicenses, getSettings } from '@/lib/data';
import { headers } from 'next/headers';

async function checkApiKey() {
    const settings = await getSettings();
    if (!settings.adminApiEnabled) {
        return { authorized: false, message: 'Admin API is disabled.' };
    }
    const headersList = headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey || apiKey !== settings.apiKey) {
        return { authorized: false, message: 'Invalid or missing API key.' };
    }
    return { authorized: true };
}


export async function POST(request: Request, { params }: { params: { key: string } }) {
  const auth = await checkApiKey();
  if (!auth.authorized) {
      return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const { key } = params;
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
  
  if (!license.subUserDiscordIds) {
    license.subUserDiscordIds = [];
  }

  if (license.discordId === subUserDiscordId) {
      return NextResponse.json({ message: "Cannot add the owner as a sub-user." }, { status: 400 });
  }

  if (!license.subUserDiscordIds.includes(subUserDiscordId)) {
      license.subUserDiscordIds.push(subUserDiscordId);
  } else {
      return NextResponse.json({ message: "Sub-user already exists on this license." }, { status: 409 });
  }
  
  licenses[licenseIndex] = license;
  license.updatedAt = new Date().toISOString();
  await saveLicenses(licenses);

  return NextResponse.json(license);
}

export async function DELETE(request: Request, { params }: { params: { key: string } }) {
  const auth = await checkApiKey();
  if (!auth.authorized) {
      return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const { key } = params;
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

  if (!license.subUserDiscordIds) {
      return NextResponse.json({ message: "Sub-user not found on this license." }, { status: 404 });
  }

  const initialLength = license.subUserDiscordIds.length;
  
  license.subUserDiscordIds = license.subUserDiscordIds.filter(id => id !== subUserDiscordId);

  if (license.subUserDiscordIds.length === initialLength) {
     return NextResponse.json({ message: "Sub-user not found on this license." }, { status: 404 });
  }

  licenses[licenseIndex] = license;
  license.updatedAt = new Date().toISOString();
  await saveLicenses(licenses);

  return NextResponse.json(license);
}
