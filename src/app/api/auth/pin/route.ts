import { NextResponse } from "next/server";
import { isSixDigitPin } from "@/lib/auth-pin";
import { normalizePhoneNumber, phoneLookupCandidates } from "@/lib/registration";
import { deleteAuthUser, ensureEmailAuthUser, linkRegistrationToAuthUser } from "@/lib/supabase-auth";
import { getSupabaseServer } from "@/lib/supabase-server";

/** One-time PIN for a profile that already exists but has no Supabase Auth user yet. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dialCode = typeof body.dialCode === "string" ? body.dialCode : "263";
    const mobileNumber = normalizePhoneNumber(String(body.mobileNumber ?? ""), dialCode);
    const pin = String(body.pin ?? "");
    const confirmPin = String(body.confirmPin ?? "");
    const candidates = phoneLookupCandidates(String(body.mobileNumber ?? ""), dialCode);

    if (!mobileNumber) {
      return NextResponse.json({ error: "Mobile number is required." }, { status: 400 });
    }
    if (!isSixDigitPin(pin) || pin !== confirmPin) {
      return NextResponse.json({ error: "Enter the same 6-digit PIN twice." }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const existing = await supabase
      .from("registrations")
      .select("id, mobile_number, auth_user_id")
      .in("mobile_number", candidates)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      const missing = String(existing.error.message || "").includes("auth_user_id");
      return NextResponse.json(
        {
          error: missing
            ? "Run database_schema/11_supabase_auth.sql in the Supabase SQL editor, then try again."
            : existing.error.message,
        },
        { status: 500 }
      );
    }

    if (!existing.data) {
      return NextResponse.json({ error: "Phone number is not registered." }, { status: 404 });
    }
    if (existing.data.auth_user_id) {
      return NextResponse.json({ error: "This phone already has a PIN. Enter it to sign in." }, { status: 409 });
    }

    let authUserId = "";
    try {
      const authUser = await ensureEmailAuthUser(existing.data.mobile_number, pin, existing.data.id);
      authUserId = authUser.id;
      await linkRegistrationToAuthUser(existing.data.id, authUser.id);
    } catch (error) {
      if (authUserId) await deleteAuthUser(authUserId).catch(() => undefined);
      const message = error instanceof Error ? error.message : "Could not save the PIN.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, mobileNumber: existing.data.mobile_number });
  } catch (error) {
    console.error("PIN setup error", error);
    return NextResponse.json({ error: "Could not save the PIN." }, { status: 500 });
  }
}
