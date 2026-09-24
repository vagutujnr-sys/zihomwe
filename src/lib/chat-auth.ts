import { getSupabaseServer } from "@/lib/supabase-server";
import { phoneLookupCandidates, normalizePhoneNumber } from "@/lib/registration";
import { readCitizenToken } from "@/lib/citizen-token";

export type RegistrationRow = {
  id: string;
  full_name: string | null;
  mobile_number: string;
  handle: string | null;
  profile_image_path: string | null;
  device_id: string | null;
  role?: string;
  cell_id?: string | null;
  assigned_location?: unknown;
  created_at?: string;
};

const REG_SELECT =
  "id, full_name, mobile_number, handle, profile_image_path, device_id, role, cell_id, assigned_location, created_at";

const authCache = new Map<string, { at: number; row: RegistrationRow }>();
const AUTH_TTL_MS = 20_000;

/** Identity from the login session. No database call. */
export function registrationFromSessionToken(token: string | null | undefined): RegistrationRow | null {
  const claims = readCitizenToken(token);
  if (!claims) return null;
  return {
    id: claims.id,
    full_name: claims.fullName,
    mobile_number: claims.phone,
    handle: claims.handle,
    profile_image_path: null,
    device_id: claims.deviceId,
  };
}

function readAuthCache(key: string) {
  const hit = authCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > AUTH_TTL_MS) {
    authCache.delete(key);
    return null;
  }
  return hit.row;
}

/**
 * Resolve the logged-in registration.
 * Phone is the primary identity. Never return another account solely because
 * it shares a browser device_id — that broke multi-account chat testing.
 */
export async function findRegistrationByAuth(
  mobileNumber: string,
  deviceId?: string | null
): Promise<RegistrationRow | null> {
  const cacheKey = `${mobileNumber}|${deviceId || ""}`;
  const cached = readAuthCache(cacheKey);
  if (cached) return cached;

  const supabase = getSupabaseServer();
  const candidates = phoneLookupCandidates(mobileNumber).filter(Boolean);

  const remember = (row: RegistrationRow | null) => {
    if (row) authCache.set(cacheKey, { at: Date.now(), row });
    return row;
  };

  if (candidates.length) {
    if (deviceId) {
      const { data: matched, error: matchError } = await supabase
        .from("registrations")
        .select(REG_SELECT)
        .in("mobile_number", candidates)
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (matchError) {
        // handle column may be missing on older DBs — retry without it
        if (String(matchError.message || "").includes("handle")) {
          const { data: fallback } = await supabase
            .from("registrations")
            .select(
              "id, full_name, mobile_number, profile_image_path, device_id, role, cell_id, assigned_location, created_at"
            )
            .in("mobile_number", candidates)
            .eq("device_id", deviceId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (fallback) return { ...fallback, handle: null } as RegistrationRow;
        } else {
          throw matchError;
        }
      } else if (matched) {
        return remember(matched as RegistrationRow);
      }
    }

    const { data, error } = await supabase
      .from("registrations")
      .select(REG_SELECT)
      .in("mobile_number", candidates)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (String(error.message || "").includes("handle")) {
        const { data: fallback, error: fallbackError } = await supabase
          .from("registrations")
          .select(
            "id, full_name, mobile_number, profile_image_path, device_id, role, cell_id, assigned_location, created_at"
          )
          .in("mobile_number", candidates)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallbackError) throw fallbackError;
        return remember(fallback ? ({ ...fallback, handle: null } as RegistrationRow) : null);
      }
      throw error;
    }
    return remember((data as RegistrationRow | null) ?? null);
  }

  // No phone provided — only then allow device-only lookup
  if (deviceId) {
    const { data, error } = await supabase
      .from("registrations")
      .select(REG_SELECT)
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (String(error.message || "").includes("handle")) {
        const { data: fallback } = await supabase
          .from("registrations")
          .select(
            "id, full_name, mobile_number, profile_image_path, device_id, role, cell_id, assigned_location, created_at"
          )
          .eq("device_id", deviceId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return fallback ? ({ ...fallback, handle: null } as RegistrationRow) : null;
      }
      throw error;
    }
    return remember((data as RegistrationRow | null) ?? null);
  }

  void normalizePhoneNumber;
  return null;
}

export function authFromRequest(request: Request) {
  const url = new URL(request.url);
  const mobileNumber = url.searchParams.get("mobileNumber")?.trim() || "";
  const deviceId = url.searchParams.get("deviceId")?.trim() || "";
  const sessionToken = url.searchParams.get("sessionToken")?.trim() || "";
  return { mobileNumber, deviceId, sessionToken };
}

export async function authFromBody(body: Record<string, unknown>) {
  const mobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber.trim() : "";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";
  return { mobileNumber, deviceId, sessionToken };
}

export function userFromAuth(sessionToken: string | null | undefined) {
  return registrationFromSessionToken(sessionToken);
}
