import { useEffect, useState } from "react";
import { ChevronRight, Eye, Heart, Newspaper, Share2, X } from "lucide-react";
import { getNewsStories, type NewsStory } from "@/lib/content";
import { sanitizeArticleHtml } from "@/lib/rich-text";

const publications = [
  {
    name: "The Hunyani Times",
    issue: "Community edition · Vol. 04 · No. 18",
    date: "24 September 2026",
    kicker: "FEATURED PUBLICATION",
    headline: "Building a stronger Hunyani, one community at a time",
    summary: "Stories of local leadership, neighbourhood progress, and the people shaping tomorrow.",
    image: "/hunyani_times.png",
    accent: "border-slate-800 bg-[#f5f1e8] text-slate-950",
    masthead: "font-serif tracking-[-0.06em]",
  },
];

export function NewsPage() {
  const [newsStories, setNewsStories] = useState<NewsStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);
  const [activeTab, setActiveTab] = useState<"community" | "all">("community");
  const [communityStories, setCommunityStories] = useState<NewsStory[]>([]);
  const [allStories, setAllStories] = useState<NewsStory[]>([]);
  const [communityName, setCommunityName] = useState("Your community");
  const [engagement, setEngagement] = useState({ likes: 0, views: 0, liked: false });
  const [engagementError, setEngagementError] = useState("");
  const [showPublications, setShowPublications] = useState(false);
  const mobileNumber = typeof window !== "undefined" ? window.localStorage.getItem("zihomweUserPhone") ?? "" : "";

  function getVisitorKey() {
    const existing = window.localStorage.getItem("zihomweVisitorKey");
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem("zihomweVisitorKey", created);
    return created;
  }

  useEffect(() => {
    if (!selectedStory) return;
    const articleId = selectedStory.id;
    let cancelled = false;
    setEngagementError("");
    async function loadEngagement() {
      const query = mobileNumber ? `?mobileNumber=${encodeURIComponent(mobileNumber)}` : "";
      const response = await fetch(`/api/news/${articleId}${query}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Unable to load article activity.");
      if (!cancelled) { setEngagement(payload.engagement); updateFeedEngagement(payload.engagement); }
      const viewResponse = await fetch(`/api/news/${articleId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view", mobileNumber, visitorKey: getVisitorKey() }) });
      const viewPayload = await viewResponse.json();
      if (!viewResponse.ok) throw new Error(viewPayload.message || "Unable to record article view.");
      if (!cancelled) { setEngagement(viewPayload.engagement); updateFeedEngagement(viewPayload.engagement); }
    }
    void loadEngagement().catch((error) => { if (!cancelled) setEngagementError(error instanceof Error ? error.message : "Unable to load article activity."); });
    return () => { cancelled = true; };
  }, [selectedStory, mobileNumber]);

  async function toggleLike() {
    if (!selectedStory) return;
    const response = await fetch(`/api/news/${selectedStory.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "like", mobileNumber }) });
    const payload = await response.json();
    if (!response.ok) { setEngagementError(payload.message || "Unable to like this article."); return; }
    setEngagement(payload.engagement);
    updateFeedEngagement(payload.engagement);
  }

  useEffect(() => {
    async function loadNews() {
      try {
        const mobileNumber = window.localStorage.getItem("zihomweUserPhone") ?? "";
        let constituencyId = "";
        if (mobileNumber) {
          const profileResponse = await fetch(`/api/profile?mobileNumber=${encodeURIComponent(mobileNumber)}`);
          const profilePayload = await profileResponse.json();
          const location = profilePayload?.profile?.assigned_location as { constituencyId?: string; constituency_id?: string; constituency?: string } | string | null;
          if (typeof location === "string") constituencyId = location;
          else {
            constituencyId = location?.constituencyId || location?.constituency_id || "";
            if (location?.constituency) setCommunityName(location.constituency);
          }
        }
        const [community, all] = await Promise.all([constituencyId ? getNewsStories(constituencyId) : Promise.resolve([]), getNewsStories()]);
        setCommunityStories(community);
        setAllStories(all);
        setNewsStories(community.length ? community : all);
        setActiveTab(community.length ? "community" : "all");
      } finally {
        setIsLoading(false);
      }
    }

    void loadNews();
  }, []);

  function selectTab(tab: "community" | "all") {
    setActiveTab(tab);
    setNewsStories(tab === "community" ? communityStories : allStories);
  }

  function updateFeedEngagement(next: { likes: number; views: number }) {
    if (!selectedStory) return;
    const update = (stories: NewsStory[]) => stories.map((story) => story.id === selectedStory.id ? { ...story, likes: next.likes, views: next.views } : story);
    setCommunityStories(update);
    setAllStories(update);
    setNewsStories(update);
  }
  return (
    <div className="pb-40 pt-4 sm:pt-6">
      {showPublications ? (
        <section className="px-4 sm:px-0" aria-label="Publications">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-green-700">The reading room</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Publications</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Browse the latest community editions.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPublications(false)}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-green-600 hover:text-green-700"
            >
              <ChevronRight className="h-4 w-4 rotate-180" aria-hidden="true" />
              News
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            {publications.map((publication) => (
              <article key={publication.name} className="min-w-0">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <img src={publication.image} alt={`${publication.name} cover`} className="aspect-[3/4] w-full object-cover object-top" />
                  <div className="px-3 py-3">
                    <h2 className={`text-sm font-bold leading-tight text-slate-900 ${publication.masthead}`}>{publication.name}</h2>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{publication.date}</p>
                    <p className="mt-2 line-clamp-2 text-xs leading-4 text-slate-600">{publication.headline}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {!showPublications ? (
        <>
      <div className="relative left-1/2 -mt-4 mb-6 flex w-screen -translate-x-1/2 items-center justify-between gap-3 border-y border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:-mt-6 sm:px-6" aria-label="Internal publications">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Internal publications</p>
          <p className="mt-1 text-xs text-amber-900/75">Read the latest edition from your community.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowPublications(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
        >
          <Newspaper className="h-4 w-4" aria-hidden="true" />
          Publications
        </button>
      </div>
      {selectedStory && (
        <div className="fixed inset-0 z-[60] h-screen w-screen overflow-y-auto bg-white">
          <div className="sticky top-0 z-40 border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">{selectedStory.category}</p><p className="text-sm font-semibold text-slate-900">News article</p></div>
              <button type="button" onClick={() => setSelectedStory(null)} className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100" aria-label="Close article"><X size={20} /></button>
            </div>
          </div>
          <main className="mx-auto max-w-3xl">
            {selectedStory.imageUrl ? <div className="h-64 overflow-hidden bg-slate-100 sm:h-80"><img src={selectedStory.imageUrl} alt={selectedStory.title} className="h-full w-full object-cover" /></div> : <div className="h-24 bg-slate-100" aria-hidden="true" />}
            <div className="px-4 sm:px-0">
              <div className="mt-4 flex items-center justify-between border-b border-slate-200 py-3 text-sm text-slate-600">
                <div className="flex gap-6"><button type="button" onClick={() => void toggleLike()} className={`flex items-center gap-2 transition ${engagement.liked ? "text-rose-600" : "hover:text-rose-600"}`}><Heart size={17} fill={engagement.liked ? "currentColor" : "none"} /><span>{engagement.likes}</span></button><span className="flex items-center gap-2"><Eye size={17} /><span>{engagement.views}</span></span></div>
                <span>{selectedStory.time}</span>
              </div>
              {engagementError && <p className="mt-4 text-xs text-rose-600">{engagementError}</p>}
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-green-700">{selectedStory.category}</p>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">{selectedStory.title}</h1>
              <p className="mt-4 text-base leading-7 text-slate-600">{selectedStory.excerpt}</p>
              {selectedStory.body ? <div className="news-article-body mt-7 text-base leading-8 text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(selectedStory.body) }} /> : null}
              <button type="button" className="mt-8 flex items-center gap-2 border-t border-slate-200 py-5 text-sm text-slate-600 hover:text-green-700"><Share2 size={17} /> Share article</button>
            </div>
          </main>
        </div>
      )}

      {/* Page Header */}

      <section className="mb-4 px-4 sm:px-0">

        <p className="text-sm font-semibold uppercase tracking-widest text-green-700">
          Community News
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          Latest updates
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
          Stay informed about development, events, and important announcements
          happening around your community.
        </p>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="News scope">
          <button type="button" role="tab" aria-selected={activeTab === "community"} onClick={() => selectTab("community")} className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition ${activeTab === "community" ? "bg-green-700 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>{communityName} News</button>
          <button type="button" role="tab" aria-selected={activeTab === "all"} onClick={() => selectTab("all")} className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition ${activeTab === "all" ? "bg-green-700 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>All News</button>
        </div>

      </section>



      {/* News Feed */}

      <section className="space-y-0 -mx-4 sm:mx-0">


        {isLoading ? <p className="px-4 py-12 text-sm text-slate-500 sm:px-0">Loading published news...</p> : newsStories.length === 0 ? <p className="px-4 py-12 text-sm text-slate-500 sm:px-0">There are no published news articles yet.</p> : newsStories.map((story) => (

          <article
            key={story.id}
            className="first:pt-2 overflow-hidden border-b border-slate-200 py-8"
          >


            {/* Image */}

            <button type="button" className="block w-full overflow-hidden text-left" onClick={() => setSelectedStory(story)} aria-label={`Open ${story.title}`}>
              {story.imageUrl ? <img src={story.imageUrl} alt={story.title} className="h-56 w-full object-cover transition duration-500 hover:scale-105 sm:h-60" /> : <div className="h-24 w-full bg-slate-100" aria-hidden="true" />}
            </button>



            {/* Content */}

            <div className="px-4 sm:px-0 pt-5">


              <span className="text-xs font-bold uppercase tracking-wider text-green-700">
                {story.category}
              </span>


              <h2 className="mt-3 text-2xl font-bold leading-tight text-slate-900">
                {story.title}
              </h2>


              <p className="mt-3 text-base leading-7 text-slate-600">
                {story.excerpt}
              </p>



              {/* Footer */}

              <div className="mt-5 flex items-center justify-between">


                <div className="flex items-center gap-4 text-sm text-slate-500">

                  <span>
                    {story.time}
                  </span>


                  <span className="flex items-center gap-1"><Heart size={16}/>{story.likes}</span>
                  <span className="flex items-center gap-1"><Eye size={16}/>{story.views}</span>


                  <button className="flex items-center gap-1 hover:text-green-700">
                    <Share2 size={16}/>
                    Share
                  </button>

                </div>



                <button type="button" onClick={() => setSelectedStory(story)} className="flex items-center gap-1 font-semibold text-green-700 hover:text-green-800">
                  Read more
                  <ChevronRight size={18} />
                </button>


              </div>


            </div>


          </article>

        ))}


      </section>
        </>
      ) : null}


    </div>
  );
}