import { createHmac, timingSafeEqual } from "crypto";

export type CitizenClaims = {
  id: string;
  phone: string;
  deviceId: string;
  fullName: string | null;
  handle: string | null;
  exp: number;
};

function secret() {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-zihomwe-session-secret";
}

function signBody(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Decode a base64url JWT body in the browser, where Node Buffer is unavailable. */
export function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(padded, "base64").toString("utf8");
}

export function parseCitizenToken(token: string | null | undefined): CitizenClaims | null {
  if (!token || !token.includes(".")) return null;
  const [body] = token.split(".");
  if (!body) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(body)) as CitizenClaims;
    if (!payload?.id || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signCitizenSession(
  input: Omit<CitizenClaims, "exp">,
  ttlSeconds = 60 * 60 * 24 * 30
) {
  const payload: CitizenClaims = {
    ...input,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function readCitizenToken(token: string | null | undefined): CitizenClaims | null {
  const payload = parseCitizenToken(token);
  if (!payload) return null;

  const [body, sig] = (token ?? "").split(".");
  if (!body || !sig) return null;

  const hasConfiguredSecret = Boolean(process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasConfiguredSecret) {
    return payload;
  }

  const expected = signBody(body);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return payload;
}

export function sessionFromRegistration(row: {
  id: string;
  mobile_number?: string | null;
  full_name?: string | null;
  handle?: string | null;
  device_id?: string | null;
}) {
  return signCitizenSession({
    id: row.id,
    phone: row.mobile_number || "",
    deviceId: row.device_id || "",
    fullName: row.full_name ?? null,
    handle: row.handle ?? null,
  });
}
