"use client";

import { useState, useEffect } from "react";
import {
  X,
  ThumbsUp,
  MessageCircle,
  Share2,
  MapPin,
  Eye,
  Send,
  Check,
  Circle,
} from "lucide-react";
import type { ProjectCard } from "@/lib/content";

interface ProjectViewProps {
  project: ProjectCard;
  onBack: () => void;
}

import { buildProfileImageUrl } from "@/lib/profile";

type ProjectComment = { id: string; author: string; role: string; text: string; avatar?: string; createdAt: string };
type Engagement = { likes: number; views: number; comments: ProjectComment[]; liked: boolean; constituencyPeople: number; supportPercent: number };

export function ProjectView({ project, onBack }: ProjectViewProps) {
  const [engagement, setEngagement] = useState<Engagement>({ likes: project.votes, views: 0, comments: [], liked: false, constituencyPeople: 0, supportPercent: 0 });
  const [engagementLoading, setEngagementLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [engagementError, setEngagementError] = useState("");
  const [currentUserAvatar, setCurrentUserAvatar] = useState("/logo_main_second.png");
  const mobileNumber = typeof window !== "undefined" ? window.localStorage.getItem("zihomweUserPhone") ?? "" : "";
  const visitorKey = typeof window !== "undefined" ? window.localStorage.getItem("zihomweVisitorKey") ?? "" : "";

  function getVisitorKey() {
    const existing = window.localStorage.getItem("zihomweVisitorKey");
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem("zihomweVisitorKey", created);
    return created;
  }

  async function loadEngagement() {
    const response = await fetch(`/api/projects/${project.id}?mobileNumber=${encodeURIComponent(mobileNumber)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Unable to load project engagement.");
    setEngagement(payload.engagement);
  }

  useEffect(() => {
    if (!mobileNumber) return;

    const loadCurrentUserProfile = async () => {
      try {
        const response = await fetch(`/api/profile?mobileNumber=${encodeURIComponent(mobileNumber)}`);
        const payload = await response.json();
        if (!response.ok || !payload?.profile?.profile_image_path) return;
        const avatar = buildProfileImageUrl(payload.profile.profile_image_path);
        if (avatar) setCurrentUserAvatar(avatar);
      } catch {
        // ignore profile avatar errors and keep the default fallback
      }
    };

    loadCurrentUserProfile();
  }, [mobileNumber]);

  async function handleEngagement(action: "like" | "view" | "comment", text?: string) {
    const response = await fetch(`/api/projects/${project.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, text, mobileNumber, visitorKey: visitorKey || getVisitorKey() }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Unable to save project activity.");
    setEngagement(payload.engagement);
  }

  const handleVote = async () => {
    try { await handleEngagement("like"); } catch (error) { setEngagementError(error instanceof Error ? error.message : "Unable to like this project."); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try { await handleEngagement("comment", commentText); setCommentText(""); } catch (error) { setEngagementError(error instanceof Error ? error.message : "Unable to post comment."); }
  };

  const communitySupport = engagement.supportPercent;
  const timelineStages = ["Planning", "Funding", "Materials", "Construction", "Completion"];
  const currentStageIndex = timelineStages.findIndex(
    (stage) => stage.toLowerCase().includes(project.status.toLowerCase().split(" ")[0].toLowerCase())
  ) || 2;

  // Disable body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    getVisitorKey();
    Promise.all([loadEngagement(), handleEngagement("view")]).catch((error) => setEngagementError(error instanceof Error ? error.message : "Unable to load project engagement.")).finally(() => setEngagementLoading(false));
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] h-screen w-screen overflow-y-auto bg-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Project</h2>
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition"
          >
            <X size={20} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto">
        {/* Hero Image - Full Width */}
        <div className="h-80 -mx-4 sm:mx-0 overflow-hidden bg-slate-200">
          <img
            src={project.imageUrl}
            alt={project.title}
            className="h-full w-full object-cover hover:scale-105 transition duration-300"
          />
        </div>

        {/* Content Container */}
        <div className="px-4 sm:px-0">
          {/* Engagement Bar */}
          <div className="border-b border-slate-200 py-3 mt-4 flex items-center justify-between text-sm text-slate-600">
            <div className="flex gap-6">
              <button
                onClick={handleVote}
                className={`flex items-center gap-2 transition ${
                  engagement.liked ? "text-green-600" : "hover:text-green-600"
                }`}
              >
                <ThumbsUp size={16} fill={engagement.liked ? "currentColor" : "none"} />
                <span>{engagement.likes}</span>
              </button>
              <button className="flex items-center gap-2 hover:text-green-600 transition">
                <MessageCircle size={16} />
                <span>{engagement.comments.length}</span>
              </button>
              <button className="flex items-center gap-2 hover:text-green-600 transition">
                <Eye size={16} />
                <span>{engagement.views}</span>
              </button>
            </div>
            <div className="text-right">
              <p className="font-medium text-slate-900">{communitySupport}% Support</p>
            </div>
          </div>

          {engagementLoading && <p className="mb-4 text-xs text-slate-500">Loading live project activity...</p>}
          {engagementError && <p className="mb-4 text-xs text-rose-600">{engagementError}</p>}

          {/* Community Support Progress Bar */}
          <div className="mt-2 mb-6">
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-500"
                style={{ width: `${communitySupport}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {communitySupport}% Community Support
            </p>
          </div>

          {/* Project Information Section */}
          <div className="space-y-3 mb-8">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">
              {project.category || "Funded Member Project"}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
              {project.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-slate-600 flex-wrap">
              {project.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={16} className="text-slate-400" />
                  {project.location}
                </span>
              )}
              <span>Updated 2 days ago</span>
            </div>
          </div>

          {/* Description */}
          <div className="mb-8">
            <p className="text-base leading-7 text-slate-700">{project.description}</p>
          </div>

          {/* Project Progress */}
          <div className="mb-8">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-sm font-medium text-slate-900">Project Progress</span>
              <span className="text-2xl font-bold text-green-600">{project.progress}%</span>
            </div>
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-500"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>

          {/* Timeline */}
          {project.status && (
            <div className="mb-8">
              <p className="text-sm font-medium text-slate-900 mb-4">Timeline</p>
              <div className="space-y-3">
                {timelineStages.map((stage, idx) => {
                  const isCompleted = idx < currentStageIndex;
                  const isActive = idx === currentStageIndex;

                  return (
                    <div key={stage} className="flex items-center gap-4">
                      <div className="relative flex-shrink-0">
                        {isCompleted ? (
                          <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                            <Check size={14} className="text-white" />
                          </div>
                        ) : isActive ? (
                          <div className="w-6 h-6 rounded-full bg-green-600" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-slate-300" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          isCompleted || isActive ? "text-slate-900 font-medium" : "text-slate-500"
                        }`}
                      >
                        {stage}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Updates */}
          {project.updates && project.updates.length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-medium text-slate-900 mb-4">Recent Updates</p>
              <div className="space-y-4">
                {project.updates.map((update, idx) => (
                  <div key={idx} className="pb-4 border-b border-slate-200 last:border-b-0">
                    <p className="text-xs font-medium text-slate-600 mb-1">{update.date}</p>
                    <p className="text-sm text-slate-700">{update.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project Team */}
          {project.team && project.team.length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-medium text-slate-900 mb-4">Project Team</p>
              <div className="space-y-3">
                {project.team.map((member, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-200 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-600">{member.role}</p>
                      </div>
                    </div>
                    <button className="text-xs font-medium text-green-600 hover:text-green-700 transition">
                      Follow
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="mb-8 border-t border-slate-200 pt-6">
            <p className="text-sm font-medium text-slate-900 mb-4">Comments</p>

            {/* Add Comment Box */}
            <div className="mb-6 pb-6 border-b border-slate-200">
              <div className="flex gap-3">
                <img
                  src={currentUserAvatar}
                  alt="You"
                  className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share your thoughts..."
                    rows={2}
                    className="w-full text-sm bg-slate-50 rounded-lg border border-slate-200 p-3 placeholder-slate-500 resize-none focus:outline-none focus:border-green-600 focus:bg-white transition"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={handleAddComment}
                      disabled={!commentText.trim()}
                      className="text-sm font-medium text-green-600 hover:text-green-700 disabled:text-slate-400 transition"
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-4">
              {engagement.comments.map((comment) => (
                <div key={comment.id} className="pb-4">
                  <div className="flex gap-3">
                    <img
                      src={comment.avatar || "/logo_main_second.png"}
                      alt={comment.author}
                      className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {comment.author}
                        </p>
                        <p className="text-xs text-slate-600">{comment.role}</p>
                      </div>
                      <p className="text-sm text-slate-700 mt-1 leading-6">
                        {comment.text}
                      </p>
                      <div className="flex gap-4 mt-2">
                        <button className="text-xs text-slate-600 hover:text-green-600 transition font-medium">
                          Like
                        </button>
                        <button className="text-xs text-slate-600 hover:text-green-600 transition font-medium">
                          Reply
                        </button>
                        <span className="text-xs text-slate-500">{new Date(comment.createdAt).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Spacing */}
          <div className="h-12" />
        </div>
      </div>
    </div>
  );
}
