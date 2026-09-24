import { NextResponse } from "next/server";
import { normalizePhoneNumber, phoneLookupCandidates } from "@/lib/registration";
import { getSupabaseServer } from "@/lib/supabase-server";

/**
 * Phone check only. A matching device is not required.
 * The person still has to enter their PIN before a session exists.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber : "";
    const dialCode = typeof body.dialCode === "string" ? body.dialCode : "263";
    const mobileNumber = normalizePhoneNumber(rawMobileNumber, dialCode);
    const candidates = phoneLookupCandidates(rawMobileNumber, dialCode);

    if (!rawMobileNumber) {
      return NextResponse.json({ error: "Missing mobileNumber" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    let { data, error } = await supabase
      .from("registrations")
      .select("id, mobile_number, auth_user_id")
      .in("mobile_number", candidates)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && String(error.message || "").includes("auth_user_id")) {
      const fallback = await supabase
        .from("registrations")
        .select("id, mobile_number")
        .in("mobile_number", candidates)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      if (!fallback.data) return NextResponse.json({ ok: true, exists: false, mobileNumber });
      return NextResponse.json({
        ok: true,
        exists: true,
        hasAuth: false,
        needsPin: true,
        mobileNumber: fallback.data.mobile_number ?? mobileNumber,
        setupMessage: "Run database_schema/11_supabase_auth.sql in the Supabase SQL editor before creating a PIN.",
      });
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ ok: true, exists: false, mobileNumber });
    }

    const hasAuth = Boolean(data.auth_user_id);
    return NextResponse.json({
      ok: true,
      exists: true,
      hasAuth,
      needsPin: !hasAuth,
      mobileNumber: data.mobile_number ?? mobileNumber,
    });
  } catch (error) {
    console.error("Login route error", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
