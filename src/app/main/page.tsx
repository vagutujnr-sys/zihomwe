"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MainHeader } from "@/components/main-header";
import { BottomNav } from "@/components/bottom-nav";
import { DrawerMenu } from "@/components/drawer-menu";
import { NotificationRuntime } from "@/components/notification-runtime";
import { CallRuntime } from "@/components/call-runtime";
import {
  HomePage,
  ProjectsPage,
  DiscoverPage,
  ChatsPage,
  UserPage,
  NewsPage,
  LeadershipPage,
  ManifestoPage,
  EventScannerPage,
  FundingRequestsPage,
} from "@/components/pages";
import { hasCitizenSession, hasSeenWelcome, markWelcomeSeen, ensureCitizenToken } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const drawerItems = [
  { label: "News", icon: "M2 6h20M2 12h20M2 18h20" },
  { label: "Manifesto", icon: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" },
  { label: "Leadership", icon: "M12 12c2.21 0 4-1.79 4-4S14.21 4 12 4 8 5.79 8 8s1.79 4 4 4zM6 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" },
  { label: "Event Scanner", icon: "M9 6.75h6M9 12h6m-6 5.25h6M4.5 6.75h.008v.008H4.5V6.75zm0 5.25h.008v.008H4.5v-.008zm0 5.25h.008v.008H4.5v-.008z" },
  { label: "Entertainment", icon: "M4 6h16M4 18h16M8 6v12M16 6v12" },
  { label: "Provincial Performance", icon: "M3 3v18h18" },
];

const businessItems = [
  { label: "Business Projects", description: "Submit & view income-generating projects" },
  { label: "Become an Affiliate", description: "Join our business partnership program" },
  { label: "Jobs & Employment", description: "Find job opportunities" },
];

const quickAccessItems = [
  { label: "Security & Emergency", description: "Emergency services & crime reporting" },
  { label: "Event Scanner", description: "Scan events and verify entry" },
];

const VALID_TABS = [
  "home",
  "projects",
  "discover",
  "chats",
  "user",
  "news",
  "leadership",
  "manifesto",
  "eventscan",
  "project-funding",
] as const;

type AppTab = (typeof VALID_TABS)[number];

function getValidTab(tab: string | null | undefined): AppTab | null {
  if (tab && (VALID_TABS as readonly string[]).includes(tab)) {
    return tab as AppTab;
  }
  return null;
}

function syncTabUrl(tab: AppTab) {
  const next = tab === "home" ? "/main" : `/main?tab=${tab}`;
  if (typeof window === "undefined") return;
  if (`${window.location.pathname}${window.location.search}` === next) return;
  // Avoid Next soft-navigation remounts that cause tab flicker.
  window.history.replaceState(window.history.state, "", next);
}

export default function MainPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <MainPageContent />
    </Suspense>
  );
}

function MainPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [showChatView, setShowChatView] = useState(false);
  const [mountedTabs, setMountedTabs] = useState<Set<AppTab>>(() => new Set(["home"]));
  const [chatsRefreshToken, setChatsRefreshToken] = useState(0);
  const [focusChatId, setFocusChatId] = useState<string | null>(null);
  const [chatsInitialTab, setChatsInitialTab] = useState<"chats" | "requests">("chats");

  useEffect(() => {
    if (!hasCitizenSession()) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        window.location.replace("/?pin=1");
        return;
      }
      await ensureCitizenToken();
      if (cancelled) return;
      const initialTab = getValidTab(searchParams?.get("tab")) ?? "home";
      setActiveTab(initialTab);
      setMountedTabs(new Set<AppTab>(["home", initialTab]));
      setShowWelcome(!hasSeenWelcome());
      setReady(true);
    })();
    // Only boot once from the URL — later tab changes use local state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Fail-safe so a blank slate never sticks forever (only if session exists)
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(() => {
      void supabase.auth.getSession().then(async ({ data }) => {
        if (!data.session) {
          window.location.replace("/?pin=1");
          return;
        }
        await ensureCitizenToken();
        if (hasCitizenSession()) setReady(true);
      });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [ready]);

  const goToTab = useCallback((tab: string) => {
    const next = getValidTab(tab) ?? "home";
    setShowChatView(false);
    setActiveTab(next);
    if (next === "chats") setChatsRefreshToken((value) => value + 1);
    setMountedTabs((prev) => {
      if (prev.has(next)) return prev;
      const copy = new Set(prev);
      copy.add(next);
      return copy;
    });
    syncTabUrl(next);
  }, []);

  const openChats = useCallback(
    (chatId?: string | null) => {
      setChatsInitialTab("chats");
      setFocusChatId(chatId ?? null);
      setShowChatView(Boolean(chatId));
      goToTab("chats");
      setChatsRefreshToken((value) => value + 1);
    },
    [goToTab]
  );

  const openRequests = useCallback(() => {
    setChatsInitialTab("requests");
    setFocusChatId(null);
    goToTab("chats");
    setChatsRefreshToken((value) => value + 1);
  }, [goToTab]);

  function closeWelcome() {
    markWelcomeSeen();
    setShowWelcome(false);
  }

  if (!ready) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  const hideChrome = showChatView || activeTab === "eventscan" || activeTab === "chats";
  const useFullBleed = activeTab === "eventscan" || activeTab === "manifesto" || activeTab === "chats";

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <NotificationRuntime onOpenChats={openChats} onOpenRequests={openRequests} />
      <CallRuntime />

      {!hideChrome && (
        <MainHeader
          onOpenDrawer={() => setDrawerOpen(true)}
          onGoHome={() => goToTab("home")}
          onOpenChats={openChats}
          onOpenRequests={openRequests}
        />
      )}

      {/* Keep tabs mounted so switching does not reload/flicker content */}
      <div className={useFullBleed ? "hidden" : "block px-0 pt-20 sm:px-0"}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <main className="space-y-6">
            {mountedTabs.has("home") && (
              <div className={activeTab === "home" ? "block" : "hidden"}>
                <HomePage onNavigate={goToTab} />
              </div>
            )}
            {mountedTabs.has("projects") && (
              <div className={activeTab === "projects" ? "block" : "hidden"}>
                <ProjectsPage />
              </div>
            )}
            {mountedTabs.has("project-funding") && (
              <div className={activeTab === "project-funding" ? "block" : "hidden"}>
                <FundingRequestsPage />
              </div>
            )}
            {mountedTabs.has("discover") && (
              <div className={activeTab === "discover" ? "block" : "hidden"}>
                <DiscoverPage />
              </div>
            )}
            {mountedTabs.has("user") && (
              <div className={activeTab === "user" ? "block" : "hidden"}>
                <UserPage />
              </div>
            )}
            {mountedTabs.has("news") && (
              <div className={activeTab === "news" ? "block" : "hidden"}>
                <NewsPage />
              </div>
            )}
            {mountedTabs.has("leadership") && (
              <div className={activeTab === "leadership" ? "block" : "hidden"}>
                <LeadershipPage />
              </div>
            )}
          </main>
        </div>
      </div>

      {activeTab === "eventscan" && <EventScannerPage onBack={() => goToTab("home")} />}
      {mountedTabs.has("manifesto") && (
        <div className={activeTab === "manifesto" ? "block" : "hidden"}>
          <ManifestoPage />
        </div>
      )}
      {mountedTabs.has("chats") && (
        <div className={activeTab === "chats" ? "block" : "hidden"}>
          <ChatsPage
            onChatViewChange={setShowChatView}
            onNavigateHome={() => goToTab("home")}
            refreshToken={chatsRefreshToken}
            focusChatId={focusChatId}
            initialTab={chatsInitialTab}
          />
        </div>
      )}

      <DrawerMenu
        open={drawerOpen}
        items={drawerItems}
        businessItems={businessItems}
        quickAccessItems={quickAccessItems}
        onClose={() => setDrawerOpen(false)}
        onNavigate={goToTab}
      />

      {!hideChrome && <BottomNav activeTab={activeTab} onChangeTab={goToTab} />}

      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-[32px] bg-emerald-600 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-center rounded-full bg-emerald-500 p-4 shadow-inner shadow-emerald-900/30">
              <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <h1 className="mt-6 text-center text-2xl font-bold">Welcome to ZIHOMWE</h1>
            <p className="mt-4 text-center text-sm leading-6 text-emerald-100">
              You’re now connected to the party network. Stay informed, engaged, and empowered.
            </p>
            <button
              className="mt-6 inline-flex w-full justify-center rounded-full bg-yellow-400 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-yellow-500/30 transition hover:bg-yellow-300"
              onClick={closeWelcome}
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
