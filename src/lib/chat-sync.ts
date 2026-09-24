/**
 * Chat delivery.
 *
 * An open thread listens to Supabase Realtime on chat_messages. That only
 * works after the person has a Supabase Auth session (phone + PIN) and after
 * database_schema/11_supabase_auth.sql is applied. Row Level Security lets a
 * signed-in user read a message only when their registration is a participant
 * on that chat. The chat id in the subscription is a hint, not the permission.
 *
 * New rows and read receipts are applied from that channel. The thread
 * asks the server again only while the socket is not subscribed.
 * There is no anon read policy on chats or chat_messages.
 */

/** How often an open thread asks the server while Realtime is disconnected. */
export const OPEN_THREAD_POLL_MS = 4_000;

export type ThreadReply = {
  id: string;
  body: string;
};

export type ThreadMessage = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  system?: boolean;
  readAt?: string | null;
  replyTo?: ThreadReply | null;
};

function isPending(id: string) {
  return id.startsWith("local-");
}

/**
 * Merge a server snapshot into the open thread.
 * Pending optimistic rows stay until the saved copy arrives.
 * Returns the previous array when nothing visible changed, so the list does not remount.
 */
export function mergeThreadMessages(current: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] {
  const server = incoming.filter((row) => !isPending(row.id));
  const pending = current.filter((row) => isPending(row.id));
  const stillPending = pending.filter((local) => {
    const localTime = new Date(local.createdAt).getTime();
    return !server.some((row) => {
      if (!row.mine || row.body !== local.body) return false;
      const delta = Math.abs(new Date(row.createdAt).getTime() - localTime);
      return delta < 120_000;
    });
  });
  const next = [...server, ...stillPending];

  if (
    next.length === current.length &&
    next.every((row, index) => {
      const prev = current[index];
      return (
        prev &&
        prev.id === row.id &&
        prev.body === row.body &&
        Boolean(prev.system) === Boolean(row.system) &&
        (prev.readAt ?? null) === (row.readAt ?? null) &&
        (prev.replyTo?.id ?? null) === (row.replyTo?.id ?? null) &&
        (prev.replyTo?.body ?? null) === (row.replyTo?.body ?? null)
      );
    })
  ) {
    return current;
  }

  return next;
}

export type RealtimeMessageRow = {
  id?: string;
  message?: string;
  created_at?: string;
  sender_registration_id?: string | null;
  read_at?: string | null;
  reply_to_message_id?: string | null;
  reply_excerpt?: string | null;
};

/** Paint one Realtime insert, update, or delete without reloading the thread. */
export function applyRealtimeMessage(
  current: ThreadMessage[],
  eventType: "INSERT" | "UPDATE" | "DELETE",
  row: RealtimeMessageRow,
  myId: string
): ThreadMessage[] {
  if (!row.id) return current;
  if (eventType === "DELETE") {
    const next = current.filter((message) => message.id !== row.id);
    return next.length === current.length ? current : next;
  }

  const nextRow: ThreadMessage = {
    id: row.id,
    body: row.message ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
    mine: row.sender_registration_id === myId,
    system: !row.sender_registration_id,
    readAt: row.read_at ?? null,
    replyTo: row.reply_excerpt ? { id: row.reply_to_message_id || "", body: row.reply_excerpt } : null,
  };

  const server = current.filter((message) => !isPending(message.id) && message.id !== nextRow.id);
  return mergeThreadMessages(current, [...server, nextRow]);
}
