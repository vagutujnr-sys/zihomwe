import { NextResponse } from 'next/server';
import { normalizePhoneNumber, phoneLookupCandidates } from '@/lib/registration';
import { getSupabaseServer } from '@/lib/supabase-server';
import { sessionFromRegistration } from '@/lib/citizen-token';

export async function POST(request: Request) {
  try {
    const supabaseServer = getSupabaseServer();
    const body = await request.json();
    const rawMobileNumber = typeof body.mobileNumber === "string" ? body.mobileNumber : "";
    const dialCode = typeof body.dialCode === "string" ? body.dialCode : "263";
    const mobileNumber = normalizePhoneNumber(rawMobileNumber, dialCode);
    const candidates = phoneLookupCandidates(rawMobileNumber, dialCode);
    const deviceId = body.deviceId;

    if (!rawMobileNumber || !deviceId) {
      return NextResponse.json({ error: 'Missing mobileNumber or deviceId' }, { status: 400 });
    }

    const { data: existingUser, error: lookupError } = await supabaseServer
      .from('registrations')
      .select('id, device_id, mobile_number')
      .in('mobile_number', candidates)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error('Change device lookup error', lookupError);
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (!existingUser) {
      return NextResponse.json({ error: 'Registration not found for this phone number.' }, { status: 404 });
    }

    if (existingUser.device_id === deviceId) {
      return NextResponse.json({
        ok: true,
        message: 'Already bound to this device.',
        sessionToken: sessionFromRegistration({
          id: existingUser.id,
          mobile_number: existingUser.mobile_number,
          device_id: deviceId,
        }),
      });
    }

    const { data: deviceOwner, error: deviceLookupError } = await supabaseServer
      .from('registrations')
      .select('id')
      .eq('device_id', deviceId)
      .limit(1)
      .maybeSingle();

    if (deviceLookupError) {
      console.error('Change device device lookup error', deviceLookupError);
      return NextResponse.json({ error: deviceLookupError.message }, { status: 500 });
    }

    if (deviceOwner && deviceOwner.id !== existingUser.id) {
      return NextResponse.json({ error: 'This device is already linked to another account.' }, { status: 409 });
    }

    const patch: Record<string, string> = { device_id: deviceId };
    if (mobileNumber && existingUser.mobile_number !== mobileNumber) {
      patch.mobile_number = mobileNumber;
    }

    const { data: updatedData, error: updateError } = await supabaseServer
      .from('registrations')
      .update(patch)
      .eq('id', existingUser.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Change device update error', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: updatedData,
      sessionToken: sessionFromRegistration({ ...updatedData, device_id: deviceId }),
    });
  } catch (error) {
    console.error('Change device route error', error);
    return NextResponse.json({ error: 'Unable to change device binding.' }, { status: 500 });
  }
}
