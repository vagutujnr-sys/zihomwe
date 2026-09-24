"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearCitizenSession, readCitizenUserProfile } from "@/lib/session";
import {
  ChevronRight,
  X,
  User,
  Home,
  Newspaper,
  Compass,
  MessageCircle,
  CalendarDays,
  Users,
  FolderKanban,
  Briefcase,
  Store,
  Bell,
  Bookmark,
  Settings,
  Book,
  Lightbulb,
  Zap,
  TrendingUp,
  Handshake,
  Shield,
  QrCode,
} from "lucide-react";

interface DrawerItem {
  label: string;
  icon: string;
}

interface DrawerMenuProps {
  open: boolean;
  items: DrawerItem[];
  businessItems: {
    label: string;
    description: string;
  }[];
  quickAccessItems: {
    label: string;
    description: string;
  }[];
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

const navigationIcons: Record<string, any> = {
  Home,
  News: Newspaper,
  Manifesto: Book,
  Leadership: Users,
  "Event Scanner": QrCode,
  Initiatives: Lightbulb,
  Entertainment: Zap,
  "Provincial Performance": TrendingUp,
  Discover: Compass,
  Chats: MessageCircle,
  Events: CalendarDays,
  Groups: Users,
  Projects: FolderKanban,
};

const businessIcons: Record<string, any> = {
  "Business Projects": Briefcase,
  "Become an Affiliate": Handshake,
  "Jobs & Employment": Users,
};

const quickAccessIcons: Record<string, any> = {
  "Security & Emergency": Shield,
  "Event Scanner": QrCode,
};

export function DrawerMenu({
  open,
  items,
  businessItems,
  quickAccessItems,
  onClose,
  onNavigate,
}: DrawerMenuProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(readCitizenUserProfile);
  const displayName = currentUser.fullName || "Member";
  const handleLabel = currentUser.handle ? `@${currentUser.handle}` : "No handle yet";

  useEffect(() => {
    if (!open) return;
    setCurrentUser(readCitizenUserProfile());
  }, [open]);

  const handleNavClick = (label: string) => {
    const tabMap: Record<string, string> = {
      News: "news",
      Manifesto: "manifesto",
      Projects: "projects",
      Discover: "discover",
      Chats: "chats",
      Leadership: "leadership",
      "Event Scanner": "eventscan",
      "Business Projects": "project-funding",
      user: "user",
    };

    const tab = tabMap[label];
    if (!tab) return;

    if (onNavigate) {
      onNavigate(tab);
    } else {
      router.push(`/main?tab=${tab}`);
    }
    onClose();
  };
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">

      {/* Overlay */}

      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* Drawer */}

      <aside className="relative flex h-full w-[290px] flex-col bg-white shadow-2xl">

        {/* Header */}

        <div className="relative overflow-hidden bg-gradient-to-br from-green-700 via-green-600 to-green-500 px-6 pb-6 pt-10 text-white">

          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 transition hover:bg-white/30"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">

            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-xl font-bold text-green-700 shadow-lg">
              {currentUser.initials}
            </div>

            <div>

              <h2 className="text-lg font-semibold">
                {displayName}
              </h2>

              <p className="text-sm text-green-100">
                {handleLabel}
              </p>

              <p className="mt-1 text-xs text-green-200">
                Your community profile
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={() => {
              if (onNavigate) {
                onNavigate("user");
              } else {
                router.push("/main?tab=user");
              }
              onClose();
            }}
            className="mt-5 flex items-center gap-2 text-sm font-medium text-white/90 transition hover:text-white"
          >

            View Profile

            <ChevronRight size={16} />

          </button>

        </div>

        {/* Scroll */}

        <div className="flex-1 overflow-y-auto">

          {/* Navigation */}

          <section className="px-4 pt-5">

            <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Navigation
            </h3>

            <div className="mt-3 space-y-1">

              {items.map((item, index) => {
                const Icon =
                  navigationIcons[item.label] ?? User;

                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item.label)}
                    className={`flex h-12 w-full items-center justify-between rounded-xl px-3 transition
                      ${
                        index === 0
                          ? "bg-green-50 text-green-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }
                    `}
                  >
                    <div className="flex items-center gap-4">

                      <Icon size={20} />

                      <span className="font-medium">
                        {item.label}
                      </span>

                    </div>

                    <ChevronRight
                      size={16}
                      className="text-slate-400"
                    />

                  </button>
                );
              })}

            </div>

          </section>

          {/* Divider */}

          <div className="my-6 border-t border-slate-100" />

                    {/* Business */}

          <section className="px-4">

            <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Business
            </h3>

            <div className="mt-3 space-y-1">

              {businessItems.map((item) => {
                const Icon = businessIcons[item.label] ?? Briefcase;

                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item.label)}
                    className="flex w-full items-start justify-between rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                  >

                    <div className="flex gap-4">

                      <div className="text-slate-600">
                        <Icon size={18} />
                      </div>

                      <div>

                        <p className="font-medium text-slate-800">
                          {item.label}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.description}
                        </p>

                      </div>

                    </div>

                    <ChevronRight
                      size={16}
                      className="mt-1 text-slate-400"
                    />

                  </button>
                );
              })}

            </div>

          </section>

          <div className="my-6 border-t border-slate-100" />



          {/* Quick Access */}

          <section className="px-4">

            <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Quick Access
            </h3>

            <div className="mt-3 space-y-1">

              {quickAccessItems.map((item) => {

                const Icon =
                  quickAccessIcons[item.label] ?? Bookmark;

                return (

                  <button
                    key={item.label}
                    className="flex w-full items-start justify-between rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                  >

                    <div className="flex gap-4">

                      <div className="text-slate-600">

                        <Icon size={18} />

                      </div>

                      <div>

                        <p className="font-medium text-slate-800">
                          {item.label}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {item.description}
                        </p>

                      </div>

                    </div>

                    <ChevronRight
                      size={16}
                      className="mt-1 text-slate-400"
                    />

                  </button>

                );

              })}

            </div>

          </section>

          <div className="my-6 border-t border-slate-100" />



          {/* Settings */}

          <section className="px-4">

            <button className="flex h-12 w-full items-center gap-4 rounded-xl px-3 transition hover:bg-slate-50">

              <Settings
                size={20}
                className="text-slate-600"
              />

              <span className="font-medium text-slate-700">
                Settings
              </span>

            </button>

            <button className="flex h-12 w-full items-center gap-4 rounded-xl px-3 transition hover:bg-slate-50">

              <User
                size={20}
                className="text-slate-600"
              />

              <span className="font-medium text-slate-700">
                Help & Support
              </span>

            </button>

          </section>

        </div>



        {/* Footer */}

        <div className="border-t border-slate-100 p-4">

          <button
            type="button"
            onClick={() => {
              clearCitizenSession();
              onClose();
              router.replace("/");
            }}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-red-50 font-medium text-red-600 transition hover:bg-red-100"
          >
            Sign Out
          </button>

          <p className="mt-4 text-center text-xs text-slate-400">
            Zihomwe Community Platform
          </p>

        </div>

      </aside>

    </div>
  );
}