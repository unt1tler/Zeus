
import { NextResponse } from 'next/server';
import { mutateLicenses } from '@/lib/data';
import { checkAdminApiKey } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('renewLicense');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { key } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }
  const { expiresAt } = body;

  if (!expiresAt) {
    return NextResponse.json({ message: "Invalid expiration date provided." }, { status: 400 });
  }

  try {
    const newExpiryDate = new Date(expiresAt);
    if (isNaN(newExpiryDate.getTime())) {
      return NextResponse.json({ message: "Invalid date format for expiresAt." }, { status: 400 });
    }

    const updatedLicense = await mutateLicenses((licenses) => {
      const licenseIndex = licenses.findIndex((license) => license.key === key);
      if (licenseIndex === -1) {
        return { data: licenses, changed: false, result: null };
      }

      licenses[licenseIndex] = {
        ...licenses[licenseIndex],
        expiresAt: newExpiryDate.toISOString(),
        status: 'active',
        updatedAt: new Date().toISOString(),
      };

      return { data: licenses, changed: true, result: licenses[licenseIndex] };
    });

    if (!updatedLicense) {
      return NextResponse.json({ message: "License not found." }, { status: 404 });
    }

    return NextResponse.json(updatedLicense);
  } catch {
    return NextResponse.json({ message: "Invalid date format for expiresAt." }, { status: 400 });
  }
}
