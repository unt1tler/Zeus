
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


export async function PATCH(request: Request, { params }: { params: { key: string } }) {
  const auth = await checkApiKey();
  if (!auth.authorized) {
      return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const { key } = params;
  const body = await request.json();
  const { status } = body;

  if (!status || (status !== 'active' && status !== 'inactive')) {
    return NextResponse.json({ message: "Invalid status provided. Must be 'active' or 'inactive'." }, { status: 400 });
  }

  const licenses = await getLicenses();
  const licenseIndex = licenses.findIndex(l => l.key === key);

  if (licenseIndex === -1) {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }

  licenses[licenseIndex].status = status;
  licenses[licenseIndex].updatedAt = new Date().toISOString();
  await saveLicenses(licenses);

  return NextResponse.json(licenses[licenseIndex]);
}

export async function DELETE(request: Request, { params }: { params: { key: string } }) {
  const auth = await checkApiKey();
  if (!auth.authorized) {
      return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const { key } = params;
  let licenses = await getLicenses();
  const initialLength = licenses.length;
  
  licenses = licenses.filter(l => l.key !== key);

  if (licenses.length === initialLength) {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }

  await saveLicenses(licenses);

  return new NextResponse(null, { status: 204 });
}
