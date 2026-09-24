"use client";

import { Newspaper, Home, Briefcase, Compass, MessageSquare } from "lucide-react";

const navItems = [
  { key: "home", label: "Home", icon: Home },
  { key: "projects", label: "Projects", icon: Briefcase },
  { key: "discover", label: "Discover", icon: Compass },
  { key: "news", label: "News", icon: Newspaper },
  { key: "chats", label: "Chats", icon: MessageSquare },
];

interface BottomNavProps {
  activeTab: string;
  onChangeTab: (key: string) => void;
}

export function BottomNav({ activeTab, onChangeTab }: BottomNavProps) {
  return (
    <nav className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-3xl rounded-[34px] border border-emerald-800 bg-yellow-400/95 p-2 shadow-2xl shadow-slate-950/20 backdrop-blur-sm">
      <div className="grid grid-cols-5 gap-2 px-1 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChangeTab(item.key)}
              className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition ${
                active
                  ? "bg-emerald-700 text-white shadow-lg shadow-emerald-900/20"
                  : "text-slate-800 hover:bg-white/80"
              }`}
            >
              <Icon className={active ? "h-7 w-7" : "h-5 w-5"} />
              <span className="sr-only">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
