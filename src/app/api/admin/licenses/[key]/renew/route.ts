
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
  const { expiresAt } = body;

  if (!expiresAt) {
    return NextResponse.json({ message: "Invalid expiration date provided." }, { status: 400 });
  }

  const licenses = await getLicenses();
  const licenseIndex = licenses.findIndex(l => l.key === key);

  if (licenseIndex === -1) {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }
  
  try {
    const newExpiryDate = new Date(expiresAt);
    licenses[licenseIndex].expiresAt = newExpiryDate.toISOString();
    licenses[licenseIndex].status = 'active';
    licenses[licenseIndex].updatedAt = new Date().toISOString();
    
    await saveLicenses(licenses);
    
    return NextResponse.json(licenses[licenseIndex]);
  } catch (error) {
    return NextResponse.json({ message: "Invalid date format for expiresAt." }, { status: 400 });
  }
}
