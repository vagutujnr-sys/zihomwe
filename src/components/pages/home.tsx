import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Eye,
  ThumbsUp,
  ArrowUp,
  Store,
  Wrench,
} from "lucide-react";
import { getAnnouncements, getEvents, getNewsStories, getProjects, type Announcement, type EventItem, type NewsStory, type ProjectCard } from "@/lib/content";

const quickActions = [
  { title: "Projects", icon: Wrench, tab: "projects" },
  { title: "Events", icon: CalendarDays, tab: "eventscan" },
  { title: "Business", icon: Store, tab: "project-funding" },
  { title: "Alerts", icon: Bell, tab: "alerts" },
];

export function HomePage({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [news, setNews] = useState<NewsStory[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContent() {
      const [newsData, projectData, announcementData, eventData] = await Promise.all([getNewsStories(), getProjects(), getAnnouncements(), getEvents()]);
      const approvedResponse = await fetch(`/api/projects?mobileNumber=${encodeURIComponent(window.localStorage.getItem("zihomweUserPhone") ?? "")}`);
      const approvedData = approvedResponse.ok ? await approvedResponse.json() : { projects: [] };
      setNews(newsData);
      setProjects([...projectData, ...(approvedData.projects ?? [])]);
      setAnnouncements(announcementData);
      setEvents(eventData);
      setLoading(false);
    }

    loadContent();
  }, []);

  const featuredProject = [...projects].sort((left, right) => (right.votes * 3 + right.comments * 2) - (left.votes * 3 + left.comments * 2))[0];
  const latestNews = news[0];
  const navigate = (tab: string) => {
    if (tab === "alerts") {
      window.dispatchEvent(new Event("zihomwe:open-notifications"));
      return;
    }
    if (onNavigate) {
      onNavigate(tab);
      return;
    }
    router.push(`/main?tab=${tab}`);
  };

  return (
    <div className="space-y-6 pb-40">

      {/* Hero Banner */}

      <section className="relative left-1/2 right-1/2 min-h-[280px] w-screen -ml-[50vw] -mr-[50vw] overflow-hidden rounded-none bg-emerald-900 p-6 text-white">
        {latestNews?.imageUrl && <img src={latestNews.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-emerald-950/65 to-emerald-950/25" />
        <div className="relative flex min-h-[232px] max-w-2xl flex-col justify-end">

        <span className="w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Community Update</span>

        <h2 className="mt-4 text-2xl font-bold leading-tight">
          {loading ? "Loading community updates..." : latestNews?.title || "No published community updates yet"}
        </h2>

        <p className="mt-3 max-w-md text-sm text-green-100">
          {latestNews?.excerpt || "Published news, events and development updates will appear here from the community database."}
        </p>

        {latestNews && (
          <button
            type="button"
            onClick={() => navigate("news")}
            className="mt-6 rounded-full bg-white px-5 py-2 font-semibold text-green-700 transition hover:bg-green-100"
          >
            Read Latest News
          </button>
        )}

        </div>
      </section>

      {/* Quick Actions */}

      <section>

        <h3 className="mb-3 font-semibold text-slate-800">
          Quick Actions
        </h3>

        <div className="grid grid-cols-4 gap-3">

          {quickActions.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                type="button"
                onClick={() => navigate(item.tab)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-green-600 hover:bg-green-50"
              >
                <Icon className="mx-auto h-6 w-6 text-green-700" />

                <p className="mt-2 text-xs font-medium">
                  {item.title}
                </p>
              </button>
            );
          })}

        </div>

      </section>

      {/* Current Projects */}

      <section>

        <div className="mb-3 flex items-center justify-between">

          <h3 className="font-semibold text-slate-800">
            Constituency Projects
          </h3>

          <button type="button" onClick={() => navigate("projects")} className="text-sm text-green-700">
            View All
          </button>

        </div>

        <div className="space-y-4">

          {featuredProject ? [featuredProject].map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate("projects")}
              className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm"
            >
              <div className="flex items-center gap-4 text-left">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-emerald-100 bg-emerald-50">
                  {project.imageUrl ? <img src={project.imageUrl} alt="" className="h-full w-full object-cover" /> : <Wrench className="m-4 h-7 w-7 text-emerald-700" />}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">{project.title}</h4>
                  <p className="mt-1 text-sm text-slate-500">{project.location}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span>Completion</span>
                  <span>{project.progress}%</span>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-green-600"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-slate-500" />
                    <span>{project.votes}</span>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Eye className="h-4 w-4 text-slate-500" />
                    <span>{project.comments}</span>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <ArrowUp className="h-4 w-4 text-slate-500" />
                    <span>{project.progress}%</span>
                  </div>
                </div>
              </div>
            </button>
          )) : <p className="border-y border-slate-200 py-8 text-sm text-slate-500">No community projects are available yet.</p>}

        </div>

      </section>

      {/* Announcements */}

      <section>
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-800">Upcoming events</h3><button type="button" onClick={() => navigate("eventscan")} className="text-sm text-green-700">Open scanner</button></div>
        {events.length ? <div className="space-y-3">{events.slice(0, 3).map((event) => <div key={event.id} className="border-b border-slate-200 py-3"><p className="font-medium text-slate-800">{event.title}</p><p className="mt-1 text-sm text-slate-500">{event.eventDate || "Date to be announced"}{event.location ? ` · ${event.location}` : ""}</p></div>)}</div> : <p className="border-y border-slate-200 py-8 text-sm text-slate-500">No upcoming events are available yet.</p>}
      </section>

      <section>

        <div className="mb-3 flex items-center justify-between">

          <h3 className="font-semibold text-slate-800">
            Announcements
          </h3>

          <button type="button" onClick={() => navigate("alerts")} className="text-green-700">
            View All
          </button>

        </div>

        <div className="space-y-3">

          {announcements.length ? announcements.map((announcement) => (
            <button
              key={announcement.id}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
            >
              <div className="text-left">

                <p className="font-medium text-slate-800">
                  {announcement.title}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {announcement.date}
                </p>

              </div>

              <ChevronRight className="h-5 w-5 text-slate-400" />

            </button>
          )) : <p className="border-y border-slate-200 py-8 text-sm text-slate-500">No alerts are available yet.</p>}

        </div>

      </section>

    </div>
  );
}

