"use client";

import { ArrowLeft, Map, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminConstituencyMap from "@/components/admin-constituency-map";

type Point = { id: string; name: string; latitude: number | null; longitude: number | null; districtCount: number; wardCount: number; cellCount: number };

export default function AdminMapPage() {
  const router = useRouter();
  const [points, setPoints] = useState<Point[]>([]);
  const [title, setTitle] = useState("Constituency distribution");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) { router.push("/admin/login"); return; }
    fetch("/api/admin/session", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { if (!response.ok) throw new Error("Session expired"); return response.json(); })
      .then((session) => {
        setTitle(session.admin.role === "super_admin" ? "All constituencies" : session.admin.constituencyName);
        return fetch("/api/admin/overview", { headers: { Authorization: `Bearer ${token}` } });
      })
      .then(async (response) => { if (!response.ok) throw new Error("Unable to load map"); return response.json(); })
      .then((data) => {
        const selectedId = new URLSearchParams(window.location.search).get("constituency");
        const selectedPoints = selectedId
          ? data.directory.constituencies.filter((point: Point) => point.id === selectedId)
          : data.directory.constituencies;
        setPoints(selectedPoints);
      })
      .catch(() => router.push("/admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return <div className="admin-loading">Loading constituency map...</div>;
  return <main className="admin-map-page"><header className="admin-map-page-header"><button className="admin-map-back" onClick={() => router.push("/admin/dashboard")}><ArrowLeft size={18} /> Dashboard</button><div className="admin-map-page-title"><span className="admin-scope-mark"><ShieldCheck size={16} /></span><div><p>Geographic distribution</p><h1>{title}</h1></div></div><span className="admin-map-page-label"><Map size={16} /> Live View</span></header><section className="admin-map-page-body"><AdminConstituencyMap constituencies={points} /></section></main>;
}
