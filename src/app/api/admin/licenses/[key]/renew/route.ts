
import { NextResponse } from 'next/server';
import { getLicenses, saveLicenses } from '@/lib/data';
import { checkAdminApiKey } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('renewLicense');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const { key } = await params;
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
    if (isNaN(newExpiryDate.getTime())) {
      return NextResponse.json({ message: "Invalid date format for expiresAt." }, { status: 400 });
    }

    licenses[licenseIndex].expiresAt = newExpiryDate.toISOString();
    licenses[licenseIndex].status = 'active';
    licenses[licenseIndex].updatedAt = new Date().toISOString();

    await saveLicenses(licenses);
    return NextResponse.json(licenses[licenseIndex]);
  } catch {
    return NextResponse.json({ message: "Invalid date format for expiresAt." }, { status: 400 });
  }
}
