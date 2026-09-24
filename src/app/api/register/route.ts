import { NextResponse } from 'next/server';
import { isSixDigitPin } from '@/lib/auth-pin';
import { normalizePhoneNumber, phoneLookupCandidates } from '@/lib/registration';
import { getSupabaseServer } from '@/lib/supabase-server';
import { sessionFromRegistration } from "@/lib/citizen-token";
import { isValidHandle, sanitizeHandleInput } from '@/lib/handles';
import { deleteAuthUser, ensureEmailAuthUser, linkRegistrationToAuthUser } from '@/lib/supabase-auth';

function distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveNearestCell(client: ReturnType<typeof getSupabaseServer>, latitude: unknown, longitude: unknown) {
  const userLatitude = Number(latitude);
  const userLongitude = Number(longitude);
  if (!Number.isFinite(userLatitude) || !Number.isFinite(userLongitude)) return null;

  const { data: cells, error } = await client
    .from('cells')
    .select('id, name, ward_id, latitude, longitude, radius_km, wards(id, name, ward_number, constituency_id, constituencies(id, name, district_id, province_id, districts(id, name, province_id, provinces(id, name))))')
    .eq('is_active', true)
    .not('ward_id', 'is', null)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  if (error) throw error;

  const nearest = (cells ?? [])
    .map((cell) => ({ ...cell, distance: distanceKm(userLatitude, userLongitude, Number(cell.latitude), Number(cell.longitude)) }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (!nearest) return null;

  const ward = Array.isArray(nearest.wards) ? nearest.wards[0] : nearest.wards;
  const constituency = Array.isArray(ward?.constituencies) ? ward.constituencies[0] : ward?.constituencies;
  const district = Array.isArray(constituency?.districts) ? constituency.districts[0] : constituency?.districts;
  const province = Array.isArray(district?.provinces) ? district.provinces[0] : district?.provinces;
  if (!ward || !constituency || !district || !province) return null;

  return {
    cellId: nearest.id,
    assignedLocation: {
      province: province.name ?? '',
      provinceId: province.id,
      district: district.name,
      districtId: district.id,
      constituency: constituency.name,
      constituencyId: constituency.id,
      ward: ward.name,
      wardId: ward.id,
      wardNumber: ward.ward_number ?? null,
      cell: nearest.name,
      distanceKm: Number(nearest.distance.toFixed(3)),
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dialCode = typeof body.dialCode === "string" ? body.dialCode : "263";
    const mobileNumber = normalizePhoneNumber(String(body.mobileNumber ?? ""), dialCode);
    const candidates = phoneLookupCandidates(String(body.mobileNumber ?? ""), dialCode);

    if (!mobileNumber) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }

    const pin = String(body.pin ?? "");
    const confirmPin = String(body.confirmPin ?? "");
    if (!isSixDigitPin(pin) || pin !== confirmPin) {
      return NextResponse.json({ error: 'Enter the same 6-digit PIN twice.' }, { status: 400 });
    }
    if (!String(body.fullName ?? "").trim()) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }
    const handle = sanitizeHandleInput(String(body.handle ?? ""));
    if (!isValidHandle(handle)) {
      return NextResponse.json(
        { error: "Choose a handle with 3–24 letters, numbers, or underscores." },
        { status: 400 }
      );
    }
    if (!/^\d{4}$/.test(String(body.otpCode ?? ""))) {
      return NextResponse.json({ error: 'Enter the verification code first.' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const existingMobile = await supabase
      .from('registrations')
      .select('id')
      .in('mobile_number', candidates)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingMobile.error) {
      console.error('Supabase mobile lookup error', existingMobile.error);
      return NextResponse.json({ error: existingMobile.error.message }, { status: 500 });
    }

    if (existingMobile.data) {
      return NextResponse.json({ error: 'Phone number already registered' }, { status: 409 });
    }

    const resolvedCell = await resolveNearestCell(supabase, body.latitude, body.longitude);

    const basePayload = {
      full_name: body.fullName || null,
      mobile_number: mobileNumber,
      otp_code: body.otpCode,
      location_consent: Boolean(body.locationConsent),
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      cell_id: resolvedCell?.cellId ?? null,
      assigned_location: resolvedCell?.assignedLocation ?? body.assignedLocation ?? null,
      role: body.role || 'citizen',
      created_at: new Date().toISOString(),
    };

    // Handles require database_schema/08_messaging.sql — register without them if the column is missing.
    let handleSupported = true;
    const { data: taken, error: handleProbeError } = await supabase
      .from('registrations')
      .select('id')
      .ilike('handle', handle)
      .limit(1)
      .maybeSingle();

    if (handleProbeError) {
      const msg = handleProbeError.message || '';
      if (msg.includes("handle") && (msg.includes('schema cache') || msg.includes('column'))) {
        handleSupported = false;
      } else {
        console.error('Handle probe error', handleProbeError);
        return NextResponse.json({ error: 'Could not check that handle.' }, { status: 500 });
      }
    } else if (taken) {
      return NextResponse.json({ error: 'That handle is already taken.' }, { status: 409 });
    }

    const payload = handleSupported ? { ...basePayload, handle } : basePayload;
    let { data, error } = await supabase.from('registrations').insert(payload).select('*').single();

    // Retry without handle if PostgREST schema cache still rejects it
    if (
      error &&
      handleSupported &&
      (error.message?.includes('handle') ?? false) &&
      ((error.message?.includes('schema cache') ?? false) || (error.message?.includes('column') ?? false))
    ) {
      ({ data, error } = await supabase.from('registrations').insert(basePayload).select('*').single());
    }

    if (error || !data) {
      console.error('Supabase insert error', error);
      return NextResponse.json({ error: error?.message || 'Registration failed' }, { status: 500 });
    }

    let authUserId = "";
    try {
      const authUser = await ensureEmailAuthUser(data.mobile_number || mobileNumber, pin, data.id);
      authUserId = authUser.id;
      await linkRegistrationToAuthUser(data.id, authUser.id);
    } catch (authError) {
      if (authUserId) await deleteAuthUser(authUserId).catch(() => undefined);
      await supabase.from("registrations").delete().eq("id", data.id);
      const message = authError instanceof Error ? authError.message : "Could not create the sign-in account.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      data: { ...data, auth_user_id: authUserId },
      sessionToken: sessionFromRegistration({ ...data, device_id: data.device_id || body.deviceId || null }),
    });
  } catch (error) {
    console.error('Registration route error', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
