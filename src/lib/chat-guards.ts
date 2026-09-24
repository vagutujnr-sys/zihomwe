import { getSupabaseServer } from "@/lib/supabase-server";

export async function isBlockedEitherWay(a: string, b: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("chat_blocks")
    .select("id")
    .or(`and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`)
    .limit(1)
    .maybeSingle();
  // Table may not exist until 09_chat_calls.sql is applied
  if (error) return false;
  return Boolean(data);
}

export async function assertChatParticipant(chatId: string, registrationId: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("chats")
    .select("id, participant_one_id, participant_two_id, name, chat_request_id")
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (data.participant_one_id !== registrationId && data.participant_two_id !== registrationId) {
    return null;
  }
  if (!data.chat_request_id) return null;

  const { data: approvedRequest, error: requestError } = await supabase
    .from("chat_requests")
    .select("id")
    .eq("id", data.chat_request_id)
    .eq("status", "accepted")
    .or(`from_registration_id.eq.${registrationId},to_registration_id.eq.${registrationId}`)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!approvedRequest) return null;

  return data;
}
