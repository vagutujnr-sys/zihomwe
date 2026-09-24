import { NextResponse } from "next/server";
import { sessionFromRegistration } from "@/lib/citizen-token";
import { getSupabaseServer } from "@/lib/supabase-server";

/** Turn a Supabase Auth session into the app session. No phone or device lookup. */
export async function POST(request: Request) {
  try {
    const header = request.headers.get("authorization") || "";
    const jwt = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (!jwt) return NextResponse.json({ message: "Sign in with your PIN first." }, { status: 401 });

    const supabase = getSupabaseServer();
    const verified = await supabase.auth.getUser(jwt);
    if (verified.error || !verified.data.user) {
      return NextResponse.json({ message: "Sign in with your PIN first." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("registrations")
      .select("*")
      .eq("auth_user_id", verified.data.user.id)
      .maybeSingle();

    if (error) {
      const missing = String(error.message || "").includes("auth_user_id");
      return NextResponse.json(
        {
          message: missing
            ? "Run database_schema/11_supabase_auth.sql in the Supabase SQL editor, then sign in again."
            : error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ message: "This sign-in is not linked to a ZiHomwe profile." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      mobileNumber: data.mobile_number,
      sessionToken: sessionFromRegistration(data),
    });
  } catch (error) {
    console.error("Auth session error", error);
    return NextResponse.json({ message: "Could not start the session." }, { status: 500 });
  }
}
