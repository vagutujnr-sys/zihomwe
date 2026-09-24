"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ThumbsUp, MessageCircle } from "lucide-react";
import { ProjectView } from "./projectview";
import { getProjects, type ProjectCard } from "@/lib/content";

const statusColors: Record<string, { bg: string; text: string; badge: string }> = {
  Planning: { bg: "bg-blue-100", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" },
  "In Progress": { bg: "bg-yellow-100", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
  Completed: { bg: "bg-green-100", text: "text-green-700", badge: "bg-green-100 text-green-700" },
};

const filterTabs = ["All", "In Progress", "Completed", "Planning"];

export function ProjectsPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectCard | null>(null);

  useEffect(() => {
    async function loadProjects() {
      const [memberProjects, approvedResponse] = await Promise.all([
        getProjects(),
        fetch(`/api/projects?mobileNumber=${encodeURIComponent(window.localStorage.getItem("zihomweUserPhone") ?? "")}`).then((response) => response.ok ? response.json() : { projects: [] }),
      ]);
      setProjects([...memberProjects, ...(approvedResponse.projects ?? [])]);
      setLoading(false);
    }

    loadProjects();
  }, []);

  const filteredProjects = activeFilter === "All"
    ? projects
    : projects.filter((p) => p.status === activeFilter);

  return (
    <div className="space-y-6 pb-40 pt-2">
      {/* Render ProjectView if a project is selected */}
      {selectedProject && (
        <ProjectView
          project={selectedProject}
          onBack={() => setSelectedProject(null)}
        />
      )}

      {/* Header Card */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-green-600 to-green-700 p-4 text-white shadow-lg">
        <div>
          <h2 className="text-xl font-bold">Funded Member Projects</h2>
          <p className="mt-1 text-xs text-green-100">See projects from app members who were granted support</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/40 backdrop-blur-sm">
          <TrendingUp size={24} />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filterTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`whitespace-nowrap rounded-full px-6 py-2.5 text-sm font-medium transition ${
              activeFilter === tab
                ? "bg-green-700 text-white shadow-md"
                : "border border-green-200 bg-green-50 text-green-700 hover:border-green-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      <div className="space-y-0 -mx-4 sm:mx-0">
        {loading && <p className="px-4 py-10 text-center text-sm text-slate-500">Loading live projects...</p>}
        {!loading && filteredProjects.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No live projects are available yet.</p>}
        {!loading && filteredProjects.map((project) => {
          const colors = statusColors[project.status] || statusColors.Planning;
          
          return (
            <div
              key={project.id}
              onClick={() => setSelectedProject(project)}
              className="cursor-pointer overflow-hidden bg-white border-b border-slate-200 transition hover:shadow-md"
            >
              {/* Progress Bar at Top */}
              <div className="h-1 bg-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-green-600 to-green-500 transition-all duration-300"
                  style={{ width: `${project.progress}%` }}
                />
              </div>

              {/* Image */}
              <div className="relative h-48 overflow-hidden bg-slate-200">
                <div className="absolute right-4 top-4 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-900 shadow-md">
                  {project.progress}%
                </div>
                <img
                  src={project.imageUrl}
                  alt={project.title}
                  className="h-full w-full object-cover transition duration-300 hover:scale-105"
                />
              </div>

              {/* Content */}
              <div className="space-y-3 px-4 sm:px-4 py-4">
                {/* Status Badge */}
                <div className="inline-flex">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colors.badge}`}>
                    {project.status}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-slate-900">{project.title}</h3>

                {/* Description */}
                <p className="text-sm leading-6 text-slate-600">{project.description}</p>

                {/* Footer Stats */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-sm text-slate-600">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={16} className="text-green-700" />
                      {project.votes} votes
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={16} className="text-slate-500" />
                      {project.comments} comments
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
