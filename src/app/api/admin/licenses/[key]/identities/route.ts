
import { NextResponse } from 'next/server';
import { getLicenses, saveLicenses } from '@/lib/data';
import { checkAdminApiKey } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('updateIdentities');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  const { key } = await params;
  const body = await request.json();
  const { ip, hwid } = body;

  if (!ip && !hwid) {
    return NextResponse.json({ message: "IP address or HWID must be provided." }, { status: 400 });
  }

  const licenses = await getLicenses();
  const licenseIndex = licenses.findIndex(l => l.key === key);

  if (licenseIndex === -1) {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }

  const license = licenses[licenseIndex];

  if (ip) {
    if (!license.allowedIps.includes(ip)) {
      if (license.maxIps !== -1 && license.maxIps !== -2 && license.allowedIps.length >= license.maxIps) {
        return NextResponse.json({ message: "Maximum number of IPs already reached for this license." }, { status: 409 });
      }
      license.allowedIps.push(ip);
    }
  }

  if (hwid) {
    if (!license.allowedHwids.includes(hwid)) {
      if (license.maxHwids !== -1 && license.maxHwids !== -2 && license.allowedHwids.length >= license.maxHwids) {
        return NextResponse.json({ message: "Maximum number of HWIDs already reached for this license." }, { status: 409 });
      }
      license.allowedHwids.push(hwid);
    }
  }

  license.updatedAt = new Date().toISOString();
  licenses[licenseIndex] = license;
  await saveLicenses(licenses);

  return NextResponse.json(license);
}
