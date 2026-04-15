
import { NextResponse } from 'next/server';
import { mutateLicenses } from '@/lib/data';
import { checkAdminApiKey } from '@/lib/auth';
import { normalizeIp } from '@/lib/utils';
import type { License } from '@/lib/types';

const MAX_HWID_LEN = 512;
const HWID_FORMAT_RE = /^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/;
type IdentityMutationResult =
  | { status: 200; license: License }
  | { status: 404 }
  | { status: 409; message: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await checkAdminApiKey('updateIdentities');
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { key } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const ip = typeof body.ip === "string" && body.ip.trim() ? normalizeIp(body.ip) : undefined;
  const hwid = typeof body.hwid === "string" && body.hwid.trim() ? body.hwid.trim() : undefined;

  if (!ip && !hwid) {
    return NextResponse.json({ message: "IP address or HWID must be provided." }, { status: 400 });
  }

  if (hwid && (hwid.length > MAX_HWID_LEN || !HWID_FORMAT_RE.test(hwid))) {
    return NextResponse.json({ message: "Invalid HWID provided." }, { status: 400 });
  }

  const result = await mutateLicenses<IdentityMutationResult>((licenses) => {
    const licenseIndex = licenses.findIndex((license) => license.key === key);
    if (licenseIndex === -1) {
      return { data: licenses, changed: false, result: { status: 404 as const } };
    }

    const license = {
      ...licenses[licenseIndex],
      allowedIps: [...licenses[licenseIndex].allowedIps],
      allowedHwids: [...licenses[licenseIndex].allowedHwids],
    };
    let changed = false;

    if (ip) {
      const allowedIps = new Set(license.allowedIps.map(normalizeIp));
      if (!allowedIps.has(ip)) {
        if (license.maxIps !== -1 && license.maxIps !== -2 && license.allowedIps.length >= license.maxIps) {
          return { data: licenses, changed: false, result: { status: 409 as const, message: "Maximum number of IPs already reached for this license." } };
        }

        license.allowedIps.push(ip);
        changed = true;
      }
    }

    if (hwid && !license.allowedHwids.includes(hwid)) {
      if (license.maxHwids !== -1 && license.maxHwids !== -2 && license.allowedHwids.length >= license.maxHwids) {
        return { data: licenses, changed: false, result: { status: 409 as const, message: "Maximum number of HWIDs already reached for this license." } };
      }

      license.allowedHwids.push(hwid);
      changed = true;
    }

    if (!changed) {
      return { data: licenses, changed: false, result: { status: 200 as const, license: licenses[licenseIndex] } };
    }

    license.updatedAt = new Date().toISOString();
    licenses[licenseIndex] = license;
    return { data: licenses, changed: true, result: { status: 200 as const, license } };
  });

  if (result.status === 404) {
    return NextResponse.json({ message: "License not found." }, { status: 404 });
  }

  if (result.status === 409) {
    return NextResponse.json({ message: result.message }, { status: 409 });
  }

  return NextResponse.json(result.license);
}
