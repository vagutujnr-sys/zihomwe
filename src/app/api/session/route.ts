import { NextResponse } from "next/server";
import { findRegistrationByAuth } from "@/lib/chat-auth";
import { sessionFromRegistration } from "@/lib/citizen-token";

/** Mint a session after the one-time phone and device check. Chat calls use the token after this. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber.trim() : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
    if (!mobileNumber || !deviceId) {
      return NextResponse.json({ message: "Missing session." }, { status: 400 });
    }

    const me = await findRegistrationByAuth(mobileNumber, deviceId);
    if (!me) return NextResponse.json({ message: "Account not found." }, { status: 404 });

    return NextResponse.json({
      sessionToken: sessionFromRegistration(me),
      me: { id: me.id, handle: me.handle, fullName: me.full_name },
    });
  } catch (error) {
    console.error("Session mint error", error);
    return NextResponse.json({ message: "Could not start session." }, { status: 500 });
  }
}
