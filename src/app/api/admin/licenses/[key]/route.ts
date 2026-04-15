
import { NextResponse } from 'next/server';
import { mutateLicenses } from '@/lib/data';
import { checkAdminApiKey } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('updateLicense');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { key } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }
  const { status } = body;

  if (!status || (status !== 'active' && status !== 'inactive')) {
    return NextResponse.json({ message: "Invalid status provided. Must be 'active' or 'inactive'." }, { status: 400 });
  }

  const updatedLicense = await mutateLicenses((licenses) => {
    const licenseIndex = licenses.findIndex((license) => license.key === key);
    if (licenseIndex === -1) {
      return { data: licenses, changed: false, result: null };
    }

    licenses[licenseIndex] = {
      ...licenses[licenseIndex],
      status,
      updatedAt: new Date().toISOString(),
    };

    return { data: licenses, changed: true, result: licenses[licenseIndex] };
  });

  if (!updatedLicense) {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }

  return NextResponse.json(updatedLicense);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('deleteLicense');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { key } = await params;
  const deleted = await mutateLicenses((licenses) => {
    const initialLength = licenses.length;
    const remaining = licenses.filter((license) => license.key !== key);
    return {
      data: remaining,
      changed: remaining.length !== initialLength,
      result: remaining.length !== initialLength,
    };
  });

  if (!deleted) {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
