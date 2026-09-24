import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const phones = ["263777888999", "263785323166"];
const chatId = "c4aab585-3ddc-406c-8731-620ed5dc7863";

const users = {};
for (const phone of phones) {
  const { data, error } = await sb
    .from("registrations")
    .select("id, full_name, mobile_number, handle, device_id")
    .eq("mobile_number", phone)
    .maybeSingle();
  console.log("USER", phone, error?.message || data);
  if (data) users[phone] = data;
}

const { data: chat, error: chatErr } = await sb
  .from("chats")
  .select("*")
  .eq("id", chatId)
  .maybeSingle();
console.log("CHAT", chatErr?.message || chat);

const { data: msgs, error: msgErr } = await sb
  .from("chat_messages")
  .select("id, sender_registration_id, message, created_at, read_at")
  .eq("chat_id", chatId)
  .order("created_at", { ascending: true });
console.log("MESSAGES", msgErr?.message || `count=${msgs?.length}`);
for (const m of msgs ?? []) {
  console.log(" -", m.created_at, m.sender_registration_id, JSON.stringify(m.message).slice(0, 80));
}

for (const phone of phones) {
  const me = users[phone];
  if (!me) continue;
  const { data: threads, error } = await sb
    .from("chats")
    .select("id, name, last_message, participant_one_id, participant_two_id, is_group")
    .eq("is_group", false)
    .or(`participant_one_id.eq.${me.id},participant_two_id.eq.${me.id}`);
  console.log("THREADS FOR", phone, error?.message || threads?.map((t) => ({
    id: t.id,
    p1: t.participant_one_id,
    p2: t.participant_two_id,
    last: t.last_message,
    mine: t.participant_one_id === me.id || t.participant_two_id === me.id,
  })));
}

const { data: reqs } = await sb
  .from("chat_requests")
  .select("id, from_registration_id, to_registration_id, status, created_at")
  .order("created_at", { ascending: false })
  .limit(10);
console.log("RECENT REQUESTS", reqs);
