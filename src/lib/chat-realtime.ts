import { supabase } from "@/lib/supabase";

function watch(channelName: string, tables: string[], onChange: () => void, onLive?: (live: boolean) => void) {
  let channel = supabase.channel(channelName);
  for (const table of tables) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => onChange()
    );
  }
  channel.subscribe((status) => {
    onLive?.(status === "SUBSCRIBED");
  });
  return () => {
    void supabase.removeChannel(channel);
  };
}

export type ChatMessageRealtime = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  row: {
    id?: string;
    message?: string;
    created_at?: string;
    sender_registration_id?: string | null;
    read_at?: string | null;
    reply_to_message_id?: string | null;
    reply_excerpt?: string | null;
  };
};

/** Open thread. The chat id is only a hint. RLS still hides every other conversation. */
export function subscribeChatThread(
  chatId: string,
  onChange: (change: ChatMessageRealtime) => void,
  onLive?: (live: boolean) => void
) {
  let stopped = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  void supabase.auth.getSession().then(({ data }) => {
    if (stopped) return;
    const token = data.session?.access_token;
    if (token) supabase.realtime.setAuth(token);
    channel = supabase
      .channel(`thread:${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const eventType = payload.eventType;
          if (eventType !== "INSERT" && eventType !== "UPDATE" && eventType !== "DELETE") return;
          const row = (eventType === "DELETE" ? payload.old : payload.new) as ChatMessageRealtime["row"];
          onChange({ eventType, row });
        }
      )
      .subscribe((status) => {
        onLive?.(status === "SUBSCRIBED");
      });
  });

  return () => {
    stopped = true;
    if (channel) void supabase.removeChannel(channel);
  };
}

/** Chat list. No client filter is treated as permission — the participant policy is. */
export function subscribeInbox(onChange: () => void) {
  let timer: number | undefined;
  const notify = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(onChange, 300);
  };
  const stop = watch("inbox", ["chats", "chat_messages"], notify);
  return () => {
    if (timer) window.clearTimeout(timer);
    stop();
  };
}
