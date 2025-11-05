
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
      if (license.maxIps !== -1 && license.allowedIps.length >= license.maxIps) {
        return NextResponse.json({ message: "Maximum number of IPs already reached for this license." }, { status: 409 });
      }
      license.allowedIps.push(ip);
    }
  }

  if (hwid) {
    if (!license.allowedHwids.includes(hwid)) {
      if (license.maxHwids !== -1 && license.allowedHwids.length >= license.maxHwids) {
        return NextResponse.json({ message: "Maximum number of HWIDs already reached for this license." }, { status: 409 });
      }
      license.allowedHwids.push(hwid);
    }
  }
  
  licenses[licenseIndex] = license;
  await saveLicenses(licenses);

  return NextResponse.json(license);
}
