import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const supabaseServer = getSupabaseServer();
    const body = await request.json();
    const mobileNumber = body.mobileNumber;
    const deviceId = body.deviceId;

    if (!mobileNumber || !deviceId) {
      return NextResponse.json({ error: 'Missing mobileNumber or deviceId' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('registrations')
      .select('id, device_id')
      .eq('mobile_number', mobileNumber)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Unbind lookup error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.device_id !== deviceId) {
      return NextResponse.json({ ok: false, message: 'Device does not match the current binding.' }, { status: 400 });
    }

    const update = await supabaseServer
      .from('registrations')
      .update({ device_id: null })
      .eq('id', data.id);

    if (update.error) {
      console.error('Unbind update error', update.error);
      return NextResponse.json({ error: update.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unbind route error', error);
    return NextResponse.json({ error: 'Unbind failed' }, { status: 500 });
  }
}
