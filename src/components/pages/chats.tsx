"use client";

import { FormEvent, PointerEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  MessageSquarePlus,
  Phone,
  Search,
  Send,
  Smile,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { formatHandle } from "@/lib/handles";
import { applyRealtimeMessage, mergeThreadMessages, OPEN_THREAD_POLL_MS, type ThreadMessage } from "@/lib/chat-sync";
import { subscribeChatThread, subscribeInbox } from "@/lib/chat-realtime";
import { readSessionToken } from "@/lib/session";

type Person = {
  id: string;
  fullName: string | null;
  handle: string | null;
  avatarUrl: string | null;
};

type ChatItem = {
  id: string;
  lastMessage: string;
  timeLabel: string;
  unreadCount?: number;
  other: Person;
};

type ChatRequest = {
  id: string;
  note: string | null;
  createdAt: string;
  other: Person | null;
};

type Message = ThreadMessage;

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "😢", "😭", "😡", "👍", "👎", "🙏", "👏",
  "🔥", "❤️", "💚", "✨", "🎉", "✅", "💯", "🤝",
];

function authQuery() {
  const sessionToken = readSessionToken();
  return `sessionToken=${encodeURIComponent(sessionToken)}`;
}

function authBody() {
  return { sessionToken: readSessionToken() };
}

function initials(name: string | null | undefined, handle: string | null | undefined) {
  const source = (name || handle || "?").trim();
  return source
    .replace(/^@/, "")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ person, size = 40 }: { person: Pick<Person, "fullName" | "handle" | "avatarUrl">; size?: number }) {
  if (person.avatarUrl) {
    return (
      <img
        src={person.avatarUrl}
        alt=""
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800"
      style={{ width: size, height: size }}
    >
      {initials(person.fullName, person.handle)}
    </div>
  );
}

interface ChatsPageProps {
  onChatViewChange?: (isOpen: boolean) => void;
  onNavigateHome?: () => void;
  /** Bumps when the chats tab is re-selected so the list refreshes */
  refreshToken?: number;
  /** Open this thread when provided (from notification deep-link) */
  focusChatId?: string | null;
  /** Start on requests tab */
  initialTab?: "chats" | "requests";
}

export function ChatsPage({
  onChatViewChange,
  onNavigateHome,
  refreshToken = 0,
  focusChatId = null,
  initialTab = "chats",
}: ChatsPageProps) {
  const [tab, setTab] = useState<"chats" | "requests">(initialTab);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listFilter, setListFilter] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(focusChatId);

  const listLoaded = useRef(false);
  const listRequestRef = useRef<Promise<void> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (listRequestRef.current) return listRequestRef.current;
    if (!silent) setLoading(true);
    const request = (async () => {
      try {
        const query = authQuery();
        const [chatsRes, reqRes] = await Promise.all([
          fetch(`/api/chats?${query}`),
          fetch(`/api/chat/requests?${query}&box=inbox`),
        ]);
        const chatsPayload = await chatsRes.json().catch(() => ({}));
        const reqPayload = await reqRes.json().catch(() => ({}));
        if (Array.isArray(chatsPayload.chats)) setChats(chatsPayload.chats);
        if (chatsPayload.me?.handle !== undefined) setMyHandle(chatsPayload.me?.handle ?? null);
        if (Array.isArray(reqPayload.requests)) setRequests(reqPayload.requests);
      } catch {
        // Keep previous list on transient failures — never wipe conversations
      } finally {
        setLoading(false);
      }
    })();
    listRequestRef.current = request;
    try {
      await request;
    } finally {
      if (listRequestRef.current === request) listRequestRef.current = null;
    }
  }, []);

  useEffect(() => {
    const silent = listLoaded.current;
    listLoaded.current = true;
    void load(silent);
  }, [load, refreshToken]);

  useEffect(() => {
    if (focusChatId) {
      setTab("chats");
      setActiveChatId(focusChatId);
    }
  }, [focusChatId, refreshToken]);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab, refreshToken]);

  useEffect(() => {
    return subscribeInbox(() => void load(true));
  }, [load]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void load(true);
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("zihomwe:inbox-changed", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("zihomwe:inbox-changed", onVisible);
    };
  }, [load]);

  useEffect(() => {
    onChatViewChange?.(Boolean(activeChatId));
  }, [activeChatId, onChatViewChange]);

  const filteredChats = useMemo(() => {
    const q = listFilter.trim().toLowerCase().replace(/^@/, "");
    if (!q) return chats;
    return chats.filter((chat) => {
      const name = (chat.other.fullName || "").toLowerCase();
      const handle = (chat.other.handle || "").toLowerCase();
      return name.includes(q) || handle.includes(q) || chat.lastMessage.toLowerCase().includes(q);
    });
  }, [chats, listFilter]);

  async function respondToRequest(requestId: string, action: "accept" | "reject") {
    const response = await fetch("/api/chat/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...authBody(), requestId, action }),
    });
    const payload = await response.json();
    if (!response.ok) return;
    await load();
    if (action === "accept" && payload.chatId) {
      setTab("chats");
      setActiveChatId(payload.chatId);
    }
  }

  if (activeChatId) {
    return (
      <ChatThread
        chatId={activeChatId}
        initialOther={chats.find((chat) => chat.id === activeChatId)?.other ?? null}
        onBack={() => {
          setActiveChatId(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <header className="border-b border-slate-200 px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigateHome?.()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-slate-900">Chats</h1>
            {myHandle ? <p className="truncate text-xs text-slate-500">{formatHandle(myHandle)}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
            aria-label="New message"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex rounded-lg bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("chats")}
            className={`flex-1 rounded-md py-1.5 font-medium ${tab === "chats" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Messages
          </button>
          <button
            type="button"
            onClick={() => setTab("requests")}
            className={`flex-1 rounded-md py-1.5 font-medium ${tab === "requests" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Requests{requests.length > 0 ? ` (${requests.length})` : ""}
          </button>
        </div>

        {tab === "chats" ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={listFilter}
              onChange={(event) => setListFilter(event.target.value)}
              placeholder="Search"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto">
        {loading ? <p className="px-4 py-10 text-center text-sm text-slate-500">Securing Encrypted Channel ..</p> : null}

        {!loading && tab === "chats" && filteredChats.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <UserPlus className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-800">No conversations yet</p>
            <p className="mt-1 text-sm text-slate-500">Search someone’s @handle and send a request.</p>
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Find people
            </button>
          </div>
        ) : null}

        {tab === "chats"
          ? filteredChats.map((chat) => (
              <button
                key={chat.id}
                type="button"
                onClick={() => setActiveChatId(chat.id)}
                className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
              >
                <Avatar person={chat.other} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`truncate text-sm ${
                        (chat.unreadCount ?? 0) > 0 ? "font-bold text-slate-900" : "font-semibold text-slate-900"
                      }`}
                    >
                      {chat.other.fullName || formatHandle(chat.other.handle) || "Member"}
                    </p>
                    <span className="shrink-0 text-[11px] text-slate-400">{chat.timeLabel}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p
                      className={`min-w-0 flex-1 truncate text-sm ${
                        (chat.unreadCount ?? 0) > 0 ? "font-medium text-slate-800" : "text-slate-600"
                      }`}
                    >
                      {chat.lastMessage || "No messages yet"}
                    </p>
                    {(chat.unreadCount ?? 0) > 0 ? (
                      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">
                        {chat.unreadCount! > 99 ? "99+" : chat.unreadCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          : null}

        {tab === "requests" && requests.length === 0 && !loading ? (
          <p className="px-4 py-16 text-center text-sm text-slate-500">No pending requests.</p>
        ) : null}

        {tab === "requests"
          ? requests.map((request) => (
              <div key={request.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <Avatar person={request.other || { fullName: "?", handle: null, avatarUrl: null }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {request.other?.fullName || formatHandle(request.other?.handle) || "Member"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{formatHandle(request.other?.handle)}</p>
                  {request.note ? <p className="mt-1 text-sm text-slate-600">{request.note}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void respondToRequest(request.id, "reject")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                    aria-label="Decline"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void respondToRequest(request.id, "accept")}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white"
                    aria-label="Accept"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          : null}
      </div>

      {composeOpen ? (
        <ComposeSheet
          onClose={() => setComposeOpen(false)}
          onConnected={(chatId) => {
            setComposeOpen(false);
            setTab("chats");
            void load();
            if (chatId) setActiveChatId(chatId);
          }}
          onRequestSent={() => {
            setComposeOpen(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function ComposeSheet({
  onClose,
  onConnected,
  onRequestSent,
}: {
  onClose: () => void;
  onConnected: (chatId?: string) => void;
  onRequestSent: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const q = query.trim().replace(/^@/, "");
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/handles?q=${encodeURIComponent(q)}&${authQuery()}`);
      const payload = await response.json();
      if (response.ok) setResults(payload.users ?? []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function sendRequest(person: Person) {
    if (!person.handle) return;
    setBusyId(person.id);
    setMessage("");
    try {
      const response = await fetch("/api/chat/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...authBody(), toHandle: person.handle, note }),
      });
      const payload = await response.json();
      if (response.ok && payload.alreadyConnected) {
        onConnected(payload.chatId);
        return;
      }
      if (!response.ok) {
        setMessage(payload.message || "Could not send request.");
        return;
      }
      onRequestSent();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-slate-950/40 sm:items-center sm:justify-center sm:p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">New message</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
            <span className="text-sm text-slate-400">@</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search handle"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional note"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          {message ? <p className="text-sm text-rose-600">{message}</p> : null}
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {results.map((person) => (
            <button
              key={person.id}
              type="button"
              disabled={busyId === person.id}
              onClick={() => void sendRequest(person)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-60"
            >
              <Avatar person={person} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{person.fullName || formatHandle(person.handle)}</p>
                <p className="truncate text-xs text-slate-500">{formatHandle(person.handle)}</p>
              </div>
              <span className="text-xs font-semibold text-emerald-700">
                {busyId === person.id ? "…" : "Request"}
              </span>
            </button>
          ))}
          {query.trim().length >= 2 && results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">No users found.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SwipeMessage({
  mine,
  onReply,
  children,
}: {
  mine: boolean;
  onReply: () => void;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const delta = event.clientX - startX.current;
    const next = Math.max(0, Math.min(72, delta));
    offsetRef.current = next;
    setOffset(next);
  }

  function finish(commit: boolean) {
    if (commit && offsetRef.current > 48) onReply();
    dragging.current = false;
    offsetRef.current = 0;
    setOffset(0);
  }

  return (
    <div className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className="relative max-w-[78%] touch-pan-y"
        style={{ transform: `translateX(${offset}px)`, transition: dragging.current ? "none" : "transform 160ms ease" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => finish(true)}
        onPointerCancel={() => finish(false)}
      >
        {offset > 12 ? (
          <span className="absolute -left-7 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-700">Reply</span>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function ChatThread({ chatId, initialOther, onBack }: { chatId: string; initialOther: Person | null; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [other, setOther] = useState<Person | null>(initialOther);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const pullRequestRef = useRef<Promise<void> | null>(null);
  const meIdRef = useRef<string | null>(null);

  function rememberScroll() {
    const node = scrollerRef.current;
    if (!node) return;
    stickToBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
  }

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    const pull = async (initial: boolean) => {
      if (pullRequestRef.current) return pullRequestRef.current;
      const request = (async () => {
        try {
          const response = await fetch(
            `/api/chats/${chatId}?${authQuery()}&markRead=1&profile=${initial ? "1" : "0"}`
          );
          const payload = await response.json().catch(() => ({}));
          if (cancelled) return;
          if (!response.ok) {
            if (initial) setError(payload.message || "Could not load this chat.");
            setLoading(false);
            return;
          }
          setError("");
          if (payload.meId) meIdRef.current = payload.meId;
          if (payload.chat?.other) setOther(payload.chat.other);
          const incoming = Array.isArray(payload.messages) ? (payload.messages as Message[]) : [];
          setMessages((current) => mergeThreadMessages(current, incoming));
          setLoading(false);
        } catch {
          if (!cancelled) setLoading(false);
        }
      })();
      pullRequestRef.current = request;
      try {
        await request;
      } finally {
        if (pullRequestRef.current === request) pullRequestRef.current = null;
      }
    };

    const onInbox = () => void pull(false);
    const liveRef = { current: false };
    void pull(true);
    window.addEventListener("zihomwe:inbox-changed", onInbox);
    const stopRealtime = subscribeChatThread(
      chatId,
      (change) => {
        if (cancelled) return;
        const myId = meIdRef.current;
        if (!myId) {
          void pull(false);
          return;
        }
        setMessages((current) => applyRealtimeMessage(current, change.eventType, change.row, myId));
        if (change.eventType === "INSERT" && change.row.sender_registration_id && change.row.sender_registration_id !== myId) {
          void fetch(`/api/chats/${chatId}?${authQuery()}&markRead=1&profile=0`);
        }
      },
      (live) => {
        liveRef.current = live;
      }
    );
    const timer = window.setInterval(() => {
      if (liveRef.current) return;
      void pull(false);
    }, OPEN_THREAD_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stopRealtime();
      window.removeEventListener("zihomwe:inbox-changed", onInbox);
    };
  }, [chatId]);

  function startCall(type: "audio" | "video") {
    window.dispatchEvent(
      new CustomEvent("zihomwe:outgoing-call", {
        detail: { chatId, callType: type, other },
      })
    );
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    const quoted = replyTo;
    stickToBottomRef.current = true;
    setSending(true);
    setDraft("");
    setReplyTo(null);
    setEmojiOpen(false);
    setError("");
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      body: text,
      createdAt: new Date().toISOString(),
      mine: true,
      readAt: null,
      replyTo: quoted ? { id: quoted.id, body: quoted.body } : null,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...authBody(),
          message: text,
          replyToId: quoted && !quoted.id.startsWith("local-") ? quoted.id : undefined,
          replyExcerpt: quoted?.body,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.message) {
        const saved = payload.message as Message;
        setMessages((prev) => {
          const server = prev.filter((row) => !row.id.startsWith("local-") && row.id !== saved.id);
          return mergeThreadMessages(prev, [...server, saved]);
        });
      } else {
        setMessages((prev) => prev.filter((row) => row.id !== optimistic.id));
        setDraft(text);
        if (quoted) setReplyTo(quoted);
        setError(payload.message || "Message failed to send.");
      }
    } catch {
      setMessages((prev) => prev.filter((row) => row.id !== optimistic.id));
      setDraft(text);
      if (quoted) setReplyTo(quoted);
      setError("Message failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5">
        <button type="button" onClick={onBack} className="rounded-full p-2 hover:bg-slate-100" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-slate-700" />
        </button>
        {other ? <Avatar person={other} size={36} /> : <div className="h-9 w-9 rounded-full bg-slate-200" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {other?.fullName || formatHandle(other?.handle) || "Chat"}
          </p>
          <p className="truncate text-xs text-slate-500">{formatHandle(other?.handle)}</p>
        </div>
        <button
          type="button"
          onClick={() => startCall("audio")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          aria-label="Start voice call"
          title="Voice call"
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => startCall("video")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          aria-label="Start video call"
          title="Video call"
        >
          <Video className="h-5 w-5" />
        </button>
      </header>

      <div
        ref={scrollerRef}
        onScroll={rememberScroll}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-4"
      >
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6" role="status" aria-label="Securing Encrypted Channel" aria-live="polite">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-600 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-600" />
            </div>
            <p className="text-sm text-slate-500">Securing Encrypted Channel ..</p>
          </div>
        ) : null}
        {error && messages.length === 0 ? <p className="text-center text-sm text-rose-600">{error}</p> : null}
        {!loading && !error && messages.length === 0 ? (
          <p className="text-center text-sm text-slate-500">No messages yet. Say hello.</p>
        ) : null}
        {messages.map((message) => {
          if (message.system) {
            return (
              <p key={message.id} className="px-6 text-center text-[11px] text-slate-400">
                {message.body}
              </p>
            );
          }
          const timeLabel = message.createdAt
            ? new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit" }).format(
                new Date(message.createdAt)
              )
            : "";
          return (
            <SwipeMessage key={message.id} mine={message.mine} onReply={() => setReplyTo(message)}>
              <div
                className={`w-fit max-w-full rounded-2xl px-3 py-2 text-sm leading-5 ${
                  message.mine
                    ? "rounded-br-md bg-emerald-600 text-white"
                    : "rounded-bl-md bg-white text-slate-800 shadow-sm"
                }`}
              >
                {message.replyTo?.body ? (
                  <div
                    className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${
                      message.mine ? "border-emerald-200 bg-emerald-700/50 text-emerald-50" : "border-emerald-600 bg-slate-50 text-slate-600"
                    }`}
                  >
                    <p className="line-clamp-2">{message.replyTo.body}</p>
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.body}</p>
                <div
                  className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                    message.mine ? "text-emerald-100" : "text-slate-400"
                  }`}
                >
                  {timeLabel ? <span>{timeLabel}</span> : null}
                  {message.mine ? (
                    message.readAt ? (
                      <CheckCheck className="h-3.5 w-3.5 text-sky-200" aria-label="Read" />
                    ) : (
                      <Check className="h-3.5 w-3.5 opacity-80" aria-label="Sent" />
                    )
                  ) : null}
                </div>
              </div>
            </SwipeMessage>
          );
        })}
      </div>

      <form onSubmit={sendMessage} className="border-t border-slate-200 bg-white px-3 py-2">
        {error && messages.length > 0 ? <p className="mb-2 text-xs text-rose-600">{error}</p> : null}
        {replyTo ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl border-l-4 border-emerald-600 bg-slate-50 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-emerald-700">Replying</p>
              <p className="line-clamp-2 text-xs text-slate-600">{replyTo.body}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="text-slate-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {emojiOpen ? (
          <div className="mb-2 grid grid-cols-8 gap-1 rounded-2xl bg-slate-50 p-2">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setDraft((current) => `${current}${emoji}`)}
                className="rounded-lg py-1 text-xl hover:bg-white"
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setEmojiOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Emoji"
          >
            <Smile className="h-5 w-5" />
          </button>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message"
            className="min-h-10 flex-1 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white disabled:bg-slate-300"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
