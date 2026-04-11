import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type HeaderSource = {
  get(name: string): string | null
}

export function normalizeIp(raw: string): string {
  let ip = raw.trim().replace(/^::ffff:/, '');
  if (ip.includes(':')) {
    try {
      const halves = ip.split('::');
      let groups: string[];
      if (halves.length === 2) {
        const left = halves[0] ? halves[0].split(':') : [];
        const right = halves[1] ? halves[1].split(':') : [];
        const fill = 8 - left.length - right.length;
        groups = [...left, ...Array(fill).fill('0'), ...right];
      } else {
        groups = ip.split(':');
      }
      ip = groups.map(g => g.padStart(4, '0')).join(':').toLowerCase();
    } catch {}
  }
  return ip;
}

function shouldTrustForwardedFor(): boolean {
  return process.env.TRUST_X_FORWARDED_FOR === "true";
}

export function extractClientIp(
  headers: HeaderSource,
  options: { trustInternalHeader?: boolean } = {}
): string {
  const candidates: Array<string | null | undefined> = [];

  if (options.trustInternalHeader) {
    candidates.push(headers.get("x-zeus-client-ip"));
  }

  candidates.push(headers.get("cf-connecting-ip"));
  candidates.push(headers.get("x-real-ip"));

  if (shouldTrustForwardedFor()) {
    candidates.push(headers.get("x-forwarded-for")?.split(",")[0]?.trim());
  }

  for (const value of candidates) {
    if (value && value.trim()) {
      return normalizeIp(value);
    }
  }

  return "0.0.0.0";
}

export function hexToHsl(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
}
