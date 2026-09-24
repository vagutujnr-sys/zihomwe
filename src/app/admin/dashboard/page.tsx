"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlignCenter, AlignLeft, AlignRight, BarChart3, Bold, Building2, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, FileText, Heading2, Italic, LayoutDashboard, Link, List, ListOrdered, LogOut, Map, Menu, Quote, Settings, ShieldCheck, Underline, Users, X, XCircle } from "lucide-react";
import { buildNewsImageUrl } from "@/lib/content";

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<{
    displayName?: string;
    role: "constituency_admin" | "super_admin";
    constituencyName: string;
    themeColor: string;
  } | null>(null);
  const [overview, setOverview] = useState<{
    metrics: { users: number; constituencies: number; wards: number; cells: number };
    recentRegistrations: { id: string; full_name: string | null; mobile_number: string; role: string; created_at: string; cell_id: string | null }[];
    directory: { provinces: { id: string; name: string }[]; districts: { id: string; name: string; province_id: string }[]; constituencies: { id: string; name: string; province_id: string; district_id: string | null; latitude: number | null; longitude: number | null; districtCount: number; wardCount: number; cellCount: number; mp_name: string | null }[]; wards: { id: string; name: string; constituency_id: string; district_id: string | null; ward_number: number | null }[]; cells: { id: string; name: string; constituency_id: string; ward_id: string | null; is_active: boolean | null; memberCount: number }[] };
  } | null>(null);
  const [contentTables, setContentTables] = useState<{ table: string; count: number; rows: Record<string, unknown>[] }[]>([]);
  const [projectView, setProjectView] = useState<"approved" | "requests">("approved");
  const [projectRequestCount, setProjectRequestCount] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      router.push("/admin/login");
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([fetch("/api/admin/session", { headers }), fetch("/api/admin/overview", { headers }), fetch("/api/admin/content", { headers }), fetch("/api/admin/project-requests", { headers })])
      .then(async ([sessionResponse, overviewResponse, contentResponse, requestResponse]) => {
        if (!sessionResponse.ok || !overviewResponse.ok) throw new Error("Session expired");
        return Promise.all([
          sessionResponse.json(),
          overviewResponse.json(),
          contentResponse.ok ? contentResponse.json() : { tables: [] },
          requestResponse.ok ? requestResponse.json() : { requests: [] },
        ]);
      })
      .then(([session, data, content, requestData]) => { setAdmin(session.admin); setOverview(data); setContentTables(content.tables ?? []); setProjectRequestCount((requestData.requests ?? []).length); })
      .catch(() => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminProfile");
        router.push("/admin/login");
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminProfile");
    router.push("/admin/login");
  };

  if (isLoading) return <div className="admin-loading">Loading admin console...</div>;

  if (!admin || !overview) return null;

  const accent = admin.themeColor || "#0f766e";
  const title = admin.role === "super_admin" ? "Global administration" : admin.constituencyName;
  const navigation = [
    ["overview", "Overview", LayoutDashboard], ["people", "People & registrations", Users],
    ["locations", "Locations", Map], ["projects", "Projects", Building2], ["news", "News", FileText], ["events", "Events", ClipboardList], ["chats", "Chats", Users], ["affiliate_requests", "Affiliate requests", Users], ["settings", "Settings", Settings],
  ] as const;
  const activeLabel = navigation.find(([id]) => id === activeSection)?.[1] || "Overview";
  const formatDate = (date: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));

  return (
    <div className="admin-console" style={{ "--admin-accent": accent } as React.CSSProperties}>
      <aside className={`admin-sidebar ${isMenuOpen ? "is-open" : ""}`}>
        <div className="admin-brand"><img src="/logo_main.png" alt="Zihomwe" /><button className="admin-icon-button admin-mobile-close" onClick={() => setIsMenuOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
        <nav className="admin-nav" aria-label="Administration navigation"><span className="admin-nav-label">Workspace</span>{navigation.map(([id, label, Icon]) => <button key={id} className={`admin-nav-item ${activeSection === id ? "is-active" : ""}`} onClick={() => { setActiveSection(id); setIsMenuOpen(false); }}><Icon size={18} /><span>{label}</span>{activeSection === id && <ChevronRight size={15} className="admin-nav-chevron" />}</button>)}</nav>
        <div className="admin-sidebar-footer"><button className="admin-nav-item" onClick={handleLogout}><LogOut size={18} /><span>Sign out</span></button></div>
      </aside>
      {isMenuOpen && <button className="admin-backdrop" onClick={() => setIsMenuOpen(false)} aria-label="Close menu" />}
      <section className="admin-main">
        <header className="admin-topbar"><div className="admin-topbar-title"><button className="admin-icon-button admin-mobile-menu" onClick={() => setIsMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button><div><span>Administration</span><h1>{activeLabel}</h1></div></div><div className="admin-topbar-user"><span className="admin-avatar">{(admin.displayName || "SA").slice(0, 2).toUpperCase()}</span><div><strong>{admin.displayName || "Super Administrator"}</strong><small>{title}</small></div></div></header>
        <main className="admin-content"><div className="admin-page-intro"><div><p className="admin-eyebrow">{admin.role === "super_admin" ? "Platform command centre" : "Constituency workspace"}</p><h2>{title}</h2><p className="admin-muted">A live view of your people, places and programme activity.</p></div><div className="admin-page-actions"><button className="admin-primary-button"><ClipboardList size={17} /> Export overview</button>{activeSection === "projects" && <button className="admin-secondary-button admin-request-button" onClick={() => setProjectView("requests")}><ClipboardList size={16} /> Project requests <span className="admin-count-badge">{projectRequestCount}</span></button>}</div></div>
          {activeSection === "overview" && <><div className="admin-metrics"><Metric label="Registered people" value={overview.metrics.users} icon={Users} color="#2563eb" /><Metric label="Constituencies" value={overview.metrics.constituencies} icon={Building2} color="#0f766e" /><Metric label="Wards" value={overview.metrics.wards} icon={Map} color="#c2410c" /><Metric label="Active cells" value={overview.metrics.cells} icon={ShieldCheck} color="#7c3aed" /></div><div className="admin-grid-main"><section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Latest activity</p><h3>Recent Registrations</h3></div><button className="admin-text-button" onClick={() => setActiveSection("people")}>View all <ChevronRight size={15} /></button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Person</th><th>Role</th><th>Registered</th></tr></thead><tbody>{overview.recentRegistrations.length ? overview.recentRegistrations.map((person) => <tr key={person.id}><td><strong>{person.full_name || "Unnamed resident"}</strong><small>{person.mobile_number}</small></td><td><span className="admin-tag">{person.role.replaceAll("_", " ")}</span></td><td>{formatDate(person.created_at)}</td></tr>) : <tr><td colSpan={3} className="admin-empty">No registrations found.</td></tr>}</tbody></table></div></section><section className="admin-panel admin-health"><p className="admin-eyebrow">System health</p><h3>Everything is operational</h3>{["Supabase connection", "Admin authentication", "Data sync"].map((item) => <div className="health-line" key={item}><span /><strong>{item}</strong><b>Online</b></div>)}<div className="admin-health-note">Reading directly from the live zihomwe database.</div></section></div></>}
          {activeSection === "people" && <PeoplePanel registrations={overview.recentRegistrations} wards={overview.directory.wards} cells={overview.directory.cells} formatDate={formatDate} />}
          {activeSection === "locations" && <>
            <LocationsSection overview={overview} router={router} />
          </>}
          {activeSection === "projects" && <ProjectWorkspace projects={contentTables.find((item) => item.table === "member_projects")?.rows ?? []} requests={contentTables.find((item) => item.table === "project_requests")?.rows ?? []} view={projectView} onViewChange={setProjectView} />}
          {activeSection === "news" && <NewsManagementPanel constituencies={overview.directory.constituencies.map(({ id, name }) => ({ id, name }))} />}
          {contentTables.some((item) => item.table === activeSection) && activeSection !== "projects" && activeSection !== "news" && <ContentManagementPanel table={contentTables.find((item) => item.table === activeSection)!} />}
          {activeSection !== "overview" && activeSection !== "people" && activeSection !== "locations" && activeSection !== "projects" && activeSection !== "news" && !contentTables.some((item) => item.table === activeSection) && <section className="admin-panel admin-coming"><Settings size={30} /><h3>{activeLabel}</h3><p>This workspace is ready for the next management module.</p></section>}
        </main>
      </section>
    </div>
  );
}

function Metric({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Users; color: string }) { return <article className="admin-metric"><span className="admin-metric-icon" style={{ color, background: `${color}14` }}><Icon size={20} /></span><div><p>{label}</p><strong>{value.toLocaleString()}</strong></div><ChevronRight size={17} className="admin-metric-arrow" /></article>; }

function PeoplePanel({ registrations, wards, cells, formatDate }: { registrations: { id: string; full_name: string | null; mobile_number: string; role: string; created_at: string; cell_id: string | null }[]; wards: AdminDashboardProps["directory"]["wards"]; cells: AdminDashboardProps["directory"]["cells"]; formatDate: (date: string) => string }) {
  const [people, setPeople] = useState(registrations);
  const [selectedPerson, setSelectedPerson] = useState<typeof registrations[number] | null>(null);
  const [wardId, setWardId] = useState("");
  const [cellId, setCellId] = useState("");
  const [cellFilter, setCellFilter] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const cellName = (id: string | null) => cells.find((cell) => cell.id === id)?.name ?? "Not assigned";

  async function assignCell(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPerson || !cellId) return;
    setSaving(true);
    setStatus("Saving...");
    const response = await fetch("/api/admin/registrations", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken") ?? ""}` }, body: JSON.stringify({ registrationId: selectedPerson.id, cellId }) });
    const result = await response.json();
    if (!response.ok) { setStatus(result.message || "Unable to assign cell."); setSaving(false); return; }
    const updatedPerson = { ...selectedPerson, cell_id: cellId };
    setPeople((current) => current.map((person) => person.id === updatedPerson.id ? updatedPerson : person));
    setSelectedPerson(updatedPerson);
    setStatus("Cell assignment saved.");
    setSaving(false);
  }

  const openAssignment = (person: typeof registrations[number]) => {
    const assignedCell = cells.find((cell) => cell.id === person.cell_id);
    setSelectedPerson(person);
    setWardId(assignedCell?.ward_id ?? "");
    setCellId(person.cell_id ?? "");
    setCellFilter("");
    setStatus("");
  };
  const availableCells = cells.filter((cell) => cell.ward_id === wardId && cell.name.toLowerCase().includes(cellFilter.toLowerCase()));

  return <><section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Data management</p><h3>People & registrations</h3></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>Cell</th><th>Registered</th><th>Action</th></tr></thead><tbody>{people.length ? people.map((person) => <tr key={person.id}><td><strong>{person.full_name || "Unnamed resident"}</strong></td><td>{person.mobile_number}</td><td>{person.role.replaceAll("_", " ")}</td><td>{cellName(person.cell_id)}</td><td>{formatDate(person.created_at)}</td><td><button className="admin-row-action admin-row-action-text" onClick={() => openAssignment(person)}>{person.cell_id ? "Reassign cell" : "Assign cell"}</button></td></tr>) : <tr><td colSpan={6} className="admin-empty">No registrations found.</td></tr>}</tbody></table></div></section>{selectedPerson && <div className="admin-modal-backdrop"><section className="admin-panel admin-modal"><button className="admin-modal-close" onClick={() => setSelectedPerson(null)} aria-label="Close assignment form">×</button><div className="admin-panel-heading"><div><p className="admin-eyebrow">Member location</p><h3>{selectedPerson.cell_id ? "Reassign member to a Cell" : "Assign member to a Cell"}</h3><p className="admin-muted">Choose the Ward first, then search for the Cell where {selectedPerson.full_name || "this member"} belongs.</p></div></div><form className="admin-setup-form" onSubmit={assignCell}><label className="admin-field"><span>Ward</span><select required value={wardId} onChange={(event) => { setWardId(event.target.value); setCellId(""); setCellFilter(""); }}><option value="">Select the parent Ward</option>{wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}</select><small>Select the Ward before choosing a Cell.</small></label><label className="admin-field"><span>Find Cell by name</span><input type="search" placeholder={wardId ? "Type a Cell name" : "Select a Ward first"} value={cellFilter} onChange={(event) => setCellFilter(event.target.value)} disabled={!wardId} /><small>Filter the Cells belonging to the selected Ward.</small></label><label className="admin-field"><span>Cell</span><select required value={cellId} onChange={(event) => setCellId(event.target.value)} disabled={!wardId}><option value="">{wardId ? (availableCells.length ? "Select a Cell" : "No matching Cells") : "Select a Ward first"}</option>{availableCells.map((cell) => <option key={cell.id} value={cell.id}>{cell.name} ({cell.id})</option>)}</select><small>The member will inherit the Cell's Constituency, District, and Province.</small></label><div className="admin-setup-actions"><button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save Cell assignment"}</button><button type="button" className="admin-secondary-button" onClick={() => setSelectedPerson(null)}>Cancel</button><span>{status}</span></div></form></section></div>}</>;
}

function DirectoryPanel({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) { return <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Data management</p><h3>{title}</h3></div><button className="admin-secondary-button">Add new</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cellIndex === 0 ? <strong>{cell}</strong> : cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="admin-empty">No records found.</td></tr>}</tbody></table></div></section>; }

function ProjectWorkspace({ projects, requests, view, onViewChange }: { projects: Record<string, unknown>[]; requests: Record<string, unknown>[]; view: "approved" | "requests"; onViewChange: (view: "approved" | "requests") => void }) {
  const [requestRows, setRequestRows] = useState(requests);
  const [selectedRequest, setSelectedRequest] = useState<Record<string, unknown> | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;

  useEffect(() => {
    const loadRequests = async () => {
      const response = await fetch("/api/admin/project-requests", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!response.ok) return;
      const result = await response.json();
      setRequestRows(result.requests ?? []);
    };
    void loadRequests();
  }, [token]);

  async function updateStatus(id: string, status: string) {
    setSavingId(id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/project-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to update request.");
      setRequestRows((rows) => rows.map((row) => row.id === id ? { ...row, status: result.request.status, updated_at: result.request.updated_at } : row));
      setSelectedRequest((row) => row && row.id === id ? { ...row, status: result.request.status, updated_at: result.request.updated_at } : row);
      setMessage(`Request moved to ${status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update request.");
    } finally {
      setSavingId(null);
    }
  }

  async function openRequest(request: Record<string, unknown>) {
    setSelectedRequest(request);
    setDocumentUrl(null);
    if (!request.document_path) return;

    setDocumentLoading(true);
    try {
      const response = await fetch(`/api/admin/project-requests?id=${encodeURIComponent(String(request.id))}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const result = await response.json();
      if (response.ok) {
        setDocumentUrl(result.documentUrl ?? null);
        if (result.request) setSelectedRequest(result.request);
      }
      else setMessage(result.message || "Unable to open the submitted document.");
    } finally {
      setDocumentLoading(false);
    }
  }

  async function startReview(request: Record<string, unknown>) {
    await openRequest(request);
    await updateStatus(String(request.id), "reviewing");
  }

  const formatDate = (value: unknown) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(String(value))) : "-";
  const statusLabel = (value: unknown) => String(value ?? "pending").replaceAll("_", " ");
  const nextActions: Record<string, { label: string; status: string; tone: string }[]> = {
    pending: [{ label: "Start review", status: "reviewing", tone: "admin-secondary-button" }, { label: "Reject", status: "rejected", tone: "admin-row-action" }],
    reviewing: [{ label: "Approve", status: "approved", tone: "admin-primary-button" }, { label: "Reject", status: "rejected", tone: "admin-row-action" }],
    approved: [{ label: "Mark completed", status: "completed", tone: "admin-primary-button" }],
    rejected: [],
    completed: [],
  };

  return <>
    {view === "approved" && <section className="admin-panel admin-location-table"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Live catalogue</p><h3>Approved projects</h3><p className="admin-muted">Showing funding requests that have completed approval. Requests remain available through Project requests.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Project</th><th>Category</th><th>Location</th><th>Status</th><th>Requested</th></tr></thead><tbody>{requestRows.filter((request) => String(request.status ?? "").toLowerCase() === "approved").length ? requestRows.filter((request) => String(request.status ?? "").toLowerCase() === "approved").map((request, index) => <tr key={String(request.id ?? index)}><td><button className="admin-tree-toggle" onClick={() => openRequest(request)}><span><strong>{String(request.title ?? "Untitled project")}</strong><small>{String(request.description ?? "").slice(0, 90)}</small></span></button></td><td>{String(request.category ?? "-")}</td><td>{String(request.location ?? "-")}</td><td><span className="admin-tag">Approved</span></td><td>US$ {Number(request.requested_amount ?? 0).toLocaleString()}</td></tr>) : <tr><td colSpan={5} className="admin-empty">No approved projects found.</td></tr>}</tbody></table></div></section>}
    {view === "requests" && <section className="admin-panel"><div className="admin-panel-heading"><div><button className="admin-text-button" onClick={() => onViewChange("approved")}>← Approved projects</button><p className="admin-eyebrow">Approval workflow</p><h3>Project funding requests</h3><p className="admin-muted">{requestRows.length} live requests. Open a request to review its complete dossier.</p></div></div>{message && <p className="admin-health-note">{message}</p>}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Request</th><th>Applicant details</th><th>Submitted</th><th>Status</th><th>Next action</th></tr></thead><tbody>{requestRows.length ? requestRows.map((request, index) => { const id = String(request.id ?? index); const actions = nextActions[String(request.status ?? "pending")] ?? []; return <tr key={id}><td><button className="admin-tree-toggle" onClick={() => openRequest(request)}><span><strong>{String(request.title ?? "Untitled request")}</strong><small>{String(request.category ?? "-")} · US$ {Number(request.requested_amount ?? 0).toLocaleString()}</small></span></button></td><td>{String(request.location ?? "-")}<small>{request.document_path ? "Document attached" : "No document"}</small></td><td>{formatDate(request.created_at)}</td><td><span className="admin-tag">{statusLabel(request.status)}</span></td><td><div className="admin-row-actions">{actions.map((action) => <button key={action.status} className={action.tone} disabled={savingId === id} onClick={() => action.status === "reviewing" ? startReview(request) : updateStatus(id, action.status)}>{action.label}</button>)}</div></td></tr>; }) : <tr><td colSpan={5} className="admin-empty">No project requests found.</td></tr>}</tbody></table></div></section>}
    {selectedRequest && <div className="admin-modal-backdrop"><section className="admin-panel admin-modal"><button className="admin-modal-close" onClick={() => setSelectedRequest(null)} aria-label="Close request details">×</button><div className="admin-panel-heading"><div><p className="admin-eyebrow">Complete project dossier</p><h3>{String(selectedRequest.title ?? "Untitled request")}</h3><p className="admin-muted">Submitted {formatDate(selectedRequest.created_at)} · {statusLabel(selectedRequest.status)}</p></div></div><div className="admin-health"><div className="admin-form-grid"><strong>Category: {String(selectedRequest.category ?? "-")}</strong><strong>Amount: US$ {Number(selectedRequest.requested_amount ?? 0).toLocaleString()}</strong><strong>Location: {String(selectedRequest.location ?? "-")}</strong><strong>Timeline: {String(selectedRequest.timeline ?? "-")}</strong><strong>Bank: {String(selectedRequest.bank_name ?? "Not provided")}</strong><strong>Account: {String(selectedRequest.account_name ?? "Not provided")}</strong><strong>Account no.: {String(selectedRequest.account_number ?? "Not provided")}</strong><strong>Branch: {String(selectedRequest.branch ?? "Not provided")}</strong></div><div className="admin-health-note"><strong>Project proposal</strong><p>{String(selectedRequest.description ?? "No proposal description provided.")}</p></div>{Boolean(selectedRequest.supporting_notes) && <div className="admin-health-note"><strong>Supporting notes</strong><p>{String(selectedRequest.supporting_notes)}</p></div>}{Boolean(selectedRequest.document_path) && <div className="admin-setup-actions"><strong>Project document</strong>{documentLoading ? <span>Preparing secure link...</span> : documentUrl ? <a className="admin-secondary-button" href={documentUrl} target="_blank" rel="noreferrer">View submitted document</a> : <span>No document link available.</span>}</div>}<div className="admin-setup-actions">{(nextActions[String(selectedRequest.status ?? "pending")] ?? []).map((action) => <button key={action.status} className={action.tone} disabled={savingId === String(selectedRequest.id)} onClick={() => updateStatus(String(selectedRequest.id), action.status)}>{action.label}</button>)}</div></div></section></div>}
  </>;
}

function NewsManagementPanel({ constituencies }: { constituencies: { id: string; name: string }[] }) {
  const [articles, setArticles] = useState<Record<string, unknown>[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Record<string, unknown> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", category: "Community", excerpt: "", body: "", status: "published", constituency_id: "" });
  const [image, setImage] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;

  useEffect(() => {
    const loadArticles = async () => {
      const response = await fetch("/api/admin/news", { headers: { Authorization: `Bearer ${token ?? ""}` } });
      if (!response.ok) return;
      const payload = await response.json();
      setArticles(payload.articles ?? []);
    };
    void loadArticles();
  }, [token]);

  const resetForm = () => {
    setForm({ title: "", category: "Community", excerpt: "", body: "", status: "published", constituency_id: "" });
    setImage(null);
    setEditingId(null);
    setError("");
    setIsFormOpen(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Article title is required.");
      return;
    }

    setIsSaving(true);
    setError("");
    const formData = new FormData();
    formData.append("title", form.title);
    formData.append("category", form.category);
    formData.append("excerpt", form.excerpt);
    formData.append("body", form.body);
    formData.append("constituency_id", form.constituency_id);
    formData.append("status", form.status);
    if (image) formData.append("image", image);
    if (editingId) formData.append("id", String(editingId));

    try {
      const response = await fetch("/api/admin/news", {
        method: editingId ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.message || "Unable to save the news article.");
        return;
      }

      const updatedArticles = payload.article ? [payload.article, ...articles.filter((article) => String(article.id) !== String(payload.article.id))] : articles;
      setArticles(updatedArticles);
      resetForm();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to connect to the news service.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeArticle = async (id: string) => {
    const response = await fetch(`/api/admin/news?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token ?? ""}` },
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message || "Unable to delete the article.");
      return;
    }
    setArticles((current) => current.filter((article) => String(article.id) !== id));
    if (selectedArticle?.id === id) setSelectedArticle(null);
  };

  const editArticle = (article: Record<string, unknown>) => {
    setEditingId(String(article.id));
    setForm({
      title: String(article.title ?? ""),
      category: String(article.category ?? "Community"),
      excerpt: String(article.excerpt ?? ""),
      body: String(article.body ?? ""),
      status: String(article.status ?? "published"),
      constituency_id: String(article.constituency_id ?? ""),
    });
    setError("");
    setIsFormOpen(true);
  };

  const startNewArticle = () => {
    setForm({ title: "", category: "Community", excerpt: "", body: "", status: "published", constituency_id: "" });
    setImage(null);
    setEditingId(null);
    setError("");
    setIsFormOpen(true);
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-eyebrow">News management</p>
          <h3>Community news</h3>
          <p className="admin-muted">Create, edit, preview and remove public news articles.</p>
        </div>
        <button type="button" className="admin-primary-button" onClick={startNewArticle}>New article</button>
      </div>

      {error && <p className="admin-health-note error">{error}</p>}

      <div className="admin-table-wrap" style={{ marginTop: 18 }}>
        <table className="admin-table">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Status</th><th>Published</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {articles.length ? articles.map((article) => (
              <tr key={String(article.id)}>
                <td><strong>{String(article.title ?? "Untitled")}</strong><small>{String(article.excerpt ?? "").slice(0, 80)}</small></td>
                <td>{String(article.category ?? "Community")}</td>
                <td><span className="admin-tag">{String(article.status ?? "published")}</span></td>
                <td>{article.created_at ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(String(article.created_at))) : "-"}</td>
                <td>
                  <div className="admin-row-actions">
                    <button className="admin-row-action" onClick={() => setSelectedArticle(article)}>View</button>
                    <button className="admin-row-action" onClick={() => editArticle(article)}>Edit</button>
                    <button className="admin-row-action" onClick={() => void removeArticle(String(article.id))}>Delete</button>
                  </div>
                </td>
              </tr>
            )) : <tr><td colSpan={5} className="admin-empty">No news articles yet. Publish the first one above.</td></tr>}
          </tbody>
        </table>
      </div>

      {isFormOpen && (
        <div className="admin-modal-backdrop">
          <section className="admin-panel admin-modal admin-news-editor" role="dialog" aria-modal="true" aria-labelledby="news-editor-title">
            <button type="button" className="admin-modal-close" onClick={resetForm} aria-label="Close article editor">×</button>
            <div className="admin-panel-heading">
              <div>
                <p className="admin-eyebrow">{editingId ? "Edit publication" : "New publication"}</p>
                <h3 id="news-editor-title">{editingId ? "Update article" : "Publish an article"}</h3>
                <p className="admin-muted">Shape the story, choose its visibility, and add a strong cover image.</p>
              </div>
            </div>
            <form className="admin-setup-form" onSubmit={submit}>
              <div className="admin-form-grid admin-news-form-grid">
                <label className="admin-field admin-form-full"><span>Headline</span><input required placeholder="Write a clear, engaging headline" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} /></label>
                <label className="admin-field"><span>Category</span><input placeholder="Community" value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} /></label>
                <label className="admin-field"><span>Visibility</span><select value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value }))}><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
                <label className="admin-field admin-form-full"><span>Community audience</span><select value={form.constituency_id} onChange={(e) => setForm((current) => ({ ...current, constituency_id: e.target.value }))}><option value="">All communities</option>{constituencies.map((constituency) => <option key={constituency.id} value={constituency.id}>{constituency.name}</option>)}</select><small>Choose a constituency to feature this article in that community&apos;s News tab.</small></label>
                <label className="admin-field admin-form-full"><span>Short summary</span><input placeholder="A concise introduction shown in the news feed" value={form.excerpt} onChange={(e) => setForm((current) => ({ ...current, excerpt: e.target.value }))} /></label>
                <div className="admin-field admin-form-full"><span>Article body</span><RichTextEditor value={form.body} onChange={(body) => setForm((current) => ({ ...current, body }))} /></div>
                <label className="admin-field admin-form-full"><span>Cover image</span><input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} /><small>JPG, PNG or WEBP up to 10 MB. Leave empty to keep the current image.</small></label>
              </div>
              <div className="admin-setup-actions admin-news-editor-actions">
                <button type="button" className="admin-secondary-button" onClick={resetForm}>Cancel</button>
                <button type="submit" className="admin-primary-button" disabled={isSaving}>{isSaving ? "Saving..." : editingId ? "Save changes" : "Publish article"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedArticle && (
        <div className="admin-modal-backdrop">
          <section className="admin-panel admin-modal">
            <button className="admin-modal-close" onClick={() => setSelectedArticle(null)} aria-label="Close article">×</button>
            <div className="admin-panel-heading">
              <div>
                <p className="admin-eyebrow">News article preview</p>
                <h3>{String(selectedArticle.title ?? "Untitled article")}</h3>
                <p className="admin-muted">{String(selectedArticle.category ?? "Community")} · {String(selectedArticle.status ?? "published")}</p>
              </div>
            </div>
            {typeof selectedArticle.image_url === "string" && <img src={buildNewsImageUrl(selectedArticle.image_url)} alt={String(selectedArticle.title ?? "News article")} className="admin-preview-image" />}
            <div className="admin-health-note"><strong>Summary</strong><p>{String(selectedArticle.excerpt ?? "No summary provided.")}</p></div>
            <div className="admin-health-note"><strong>Story</strong><p>{String(selectedArticle.body ?? selectedArticle.excerpt ?? "No content provided.")}</p></div>
          </section>
        </div>
      )}
    </section>
  );
}

function RichTextEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, [value]);

  const command = (name: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? "");
  };

  const link = () => {
    const url = window.prompt("Paste the link URL");
    if (url) command("createLink", url);
  };

  const button = (label: string, Icon: typeof Bold, action: () => void) => (
    <button type="button" className="admin-editor-tool" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={action}><Icon size={16} /></button>
  );

  return <div className="admin-rich-editor">
    <div className="admin-editor-toolbar" aria-label="Article formatting tools">
      {button("Bold", Bold, () => command("bold"))}
      {button("Italic", Italic, () => command("italic"))}
      {button("Underline", Underline, () => command("underline"))}
      <span className="admin-editor-divider" />
      {button("Heading", Heading2, () => command("formatBlock", "h2"))}
      {button("Quote", Quote, () => command("formatBlock", "blockquote"))}
      {button("Bulleted list", List, () => command("insertUnorderedList"))}
      {button("Numbered list", ListOrdered, () => command("insertOrderedList"))}
      <span className="admin-editor-divider" />
      {button("Align left", AlignLeft, () => command("justifyLeft"))}
      {button("Align center", AlignCenter, () => command("justifyCenter"))}
      {button("Align right", AlignRight, () => command("justifyRight"))}
      {button("Add link", Link, link)}
    </div>
    <div ref={editorRef} className="admin-rich-editor-input" contentEditable role="textbox" aria-multiline="true" data-placeholder="Tell the full story..." onInput={() => onChange(editorRef.current?.innerHTML ?? "")} />
  </div>;
}

function ContentManagementPanel({ table }: { table: { table: string; count: number; rows: Record<string, unknown>[] } }) {
  const title = table.table.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const columns = table.rows.length ? Object.keys(table.rows[0]).filter((key) => !["id", "updated_at", "created_at", "team", "updates", "body"].includes(key)).slice(0, 5) : [];
  return <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Database management</p><h3>{title}</h3><p className="admin-muted">{table.count} records currently stored in Supabase.</p></div><button className="admin-secondary-button">Add new</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{table.rows.length ? table.rows.map((row, index) => <tr key={String(row.id ?? index)}>{columns.map((column, columnIndex) => <td key={column}>{columnIndex === 0 ? <strong>{String(row[column] ?? "-")}</strong> : String(row[column] ?? "-")}</td>)}</tr>) : <tr><td colSpan={Math.max(columns.length, 1)} className="admin-empty">No records found. Use Add new when the creation form is connected.</td></tr>}</tbody></table></div></section>;
}

function LocationsSection({ overview, router }: { overview: NonNullable<AdminDashboardProps>; router: ReturnType<typeof useRouter> }) {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showSetup, setShowSetup] = useState(false);
  const [showWardForm, setShowWardForm] = useState(false);
  const [showCellForm, setShowCellForm] = useState(false);
  const [setupTarget, setSetupTarget] = useState<{ id?: string; name?: string; provinceId?: string; districtId?: string } | undefined>();
  const filtered = overview.directory.provinces.filter((province) => {
    const provinceConstituencies = overview.directory.constituencies.filter((item) => item.province_id === province.id);
    return province.name.toLowerCase().includes(filter.toLowerCase()) || provinceConstituencies.some((item) => item.name.toLowerCase().includes(filter.toLowerCase()));
  });
  const visible = filtered.slice((page - 1) * 6, page * 6);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 6));
  return <>
    <section className="admin-panel admin-location-table"><div className="admin-panel-heading"><div><p className="admin-eyebrow">Location hierarchy</p><h3>Provinces</h3><p className="admin-muted">Province → District → Constituency → Ward → Cell.</p></div><div className="admin-location-actions"><input className="admin-filter" placeholder="Filter provinces or constituencies" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} /><button className="admin-secondary-button" onClick={() => { setSetupTarget(undefined); setShowSetup(true); }}>Add constituency</button><button className="admin-secondary-button" onClick={() => setShowWardForm(true)}>Add ward</button><button className="admin-secondary-button" onClick={() => setShowCellForm(true)}>Add cell</button><button className="admin-secondary-button" onClick={() => router.push("/admin/map")}>Open map</button></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Province</th><th>Districts</th><th>Constituencies</th><th>Wards</th><th>Cells</th><th>Actions</th></tr></thead><tbody>{visible.map((province) => <ProvinceTree key={province.id} province={province} overview={overview} router={router} onSetAdmin={(item) => { setSetupTarget({ id: item.id, name: item.name, provinceId: item.province_id, districtId: item.district_id ?? undefined }); setShowSetup(true); }} />)}</tbody></table></div><div className="admin-pagination"><span>Showing {visible.length} of {filtered.length}</span><div><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><strong>Page {page} of {pageCount}</strong><button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div></div></section>
    {showSetup && <ConstituencySetupForm provinces={overview.directory.provinces} districts={overview.directory.districts} initial={setupTarget} onClose={() => setShowSetup(false)} />}
    {showWardForm && <WardForm constituencies={overview.directory.constituencies} onClose={() => setShowWardForm(false)} />}
    {showCellForm && <CellForm wards={overview.directory.wards} onClose={() => setShowCellForm(false)} />}
  </>;
}

function ProvinceTree({ province, overview, router, onSetAdmin }: { province: AdminDashboardProps["directory"]["provinces"][number]; overview: NonNullable<AdminDashboardProps>; router: ReturnType<typeof useRouter>; onSetAdmin: (item: AdminDashboardProps["directory"]["constituencies"][number]) => void }) {
  const [open, setOpen] = useState(false);
  const districts = overview.directory.districts.filter((district) => overview.directory.constituencies.some((item) => item.province_id === province.id && item.district_id === district.id));
  const provinceConstituencies = overview.directory.constituencies.filter((item) => item.province_id === province.id);
  const provinceWards = overview.directory.wards.filter((ward) => provinceConstituencies.some((item) => item.id === ward.constituency_id));
  const provinceCells = overview.directory.cells.filter((cell) => provinceWards.some((ward) => ward.id === cell.ward_id));
  return <>
    <tr className="admin-tree-row" onClick={() => setOpen((value) => !value)}><td><button className="admin-tree-toggle" aria-label={`Expand ${province.name}`}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<span><strong>{province.name}</strong></span></button></td><td>{districts.length}</td><td>{provinceConstituencies.length}</td><td>{provinceWards.length}</td><td>{provinceCells.length}</td><td> </td></tr>
    {open && <tr className="admin-tree-detail"><td colSpan={6}><div className="admin-tree-children">{districts.length ? districts.map((district) => <DistrictTree key={district.id} district={district} overview={overview} router={router} onSetAdmin={onSetAdmin} />) : <p className="admin-tree-empty">No district assignment is linked yet.</p>}</div></td></tr>}
  </>;
}

function DistrictTree({ district, overview, router, onSetAdmin }: { district: AdminDashboardProps["directory"]["districts"][number]; overview: NonNullable<AdminDashboardProps>; router: ReturnType<typeof useRouter>; onSetAdmin: (item: AdminDashboardProps["directory"]["constituencies"][number]) => void }) {
  const [open, setOpen] = useState(false);
  const constituencies = overview.directory.constituencies.filter((item) => item.district_id === district.id);
  return <div className="admin-tree-district"><button className="admin-tree-toggle" onClick={() => setOpen((value) => !value)}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<span><strong>{district.name}</strong><small>{constituencies.length} constituencies</small></span></button>{open && <div className="admin-tree-wards">{constituencies.map((item) => <ConstituencyTree key={item.id} item={item} overview={overview} router={router} onSetAdmin={() => onSetAdmin(item)} />)}</div>}</div>;
}

function ConstituencyTree({ item, overview, router, onSetAdmin }: { item: AdminDashboardProps["directory"]["constituencies"][number]; overview: NonNullable<AdminDashboardProps>; router: ReturnType<typeof useRouter>; onSetAdmin: () => void }) {
  const [open, setOpen] = useState(false);
  const wards = overview.directory.wards.filter((ward) => ward.constituency_id === item.id);
  const cells = overview.directory.cells.filter((cell) => wards.some((ward) => ward.id === cell.ward_id));
  return <div className="admin-tree-constituency"><div className="admin-tree-constituency-header"><button className="admin-tree-toggle" onClick={() => setOpen((value) => !value)}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<span><strong>{item.name}</strong><small>{wards.length} wards · {cells.length} cells</small></span></button><div className="admin-row-actions"><button className="admin-row-action" title="View membership map" onClick={() => router.push(`/admin/map?constituency=${encodeURIComponent(item.id)}`)}><Map size={15} /></button><button className="admin-row-action admin-row-action-text" onClick={onSetAdmin}>Set admin</button></div></div>{open && <div className="admin-tree-ward-list">{wards.map((ward) => <WardTree key={ward.id} ward={ward} cells={overview.directory.cells.filter((cell) => cell.ward_id === ward.id)} />)}</div>}</div>;
}

function WardTree({ ward, cells }: { ward: AdminDashboardProps["directory"]["wards"][number]; cells: AdminDashboardProps["directory"]["cells"] }) {
  const [cellPage, setCellPage] = useState(1);
  const visibleCells = cells.slice((cellPage - 1) * 6, cellPage * 6);
  const cellPageCount = Math.max(1, Math.ceil(cells.length / 6));
  const wardLabel = /^ward\s*\d+/i.test(ward.name.trim()) ? ward.name : `Ward ${ward.ward_number ?? ""} ${ward.name}`;
  return <div className="admin-tree-ward"><strong>{wardLabel}</strong><div className="admin-tree-cell-table-wrap">{cells.length ? <table className="admin-tree-cell-table"><thead><tr><th>Cell</th><th>Members</th><th>Status</th></tr></thead><tbody>{visibleCells.map((cell) => <tr key={cell.id}><td>{cell.name}</td><td>{cell.memberCount ?? 0}</td><td>{cell.is_active === false ? "Inactive" : "Active"}</td></tr>)}</tbody></table> : <p className="admin-tree-empty">No cells assigned.</p>}</div>{cells.length > 6 && <div className="admin-tree-pagination"><span>Showing {(cellPage - 1) * 6 + 1}-{Math.min(cellPage * 6, cells.length)} of {cells.length} cells</span><div><button disabled={cellPage === 1} onClick={() => setCellPage((value) => value - 1)}>Previous</button><strong>Page {cellPage} of {cellPageCount}</strong><button disabled={cellPage === cellPageCount} onClick={() => setCellPage((value) => value + 1)}>Next</button></div></div>}</div>;
}

function LocationForm({ title, children, status, onClose, onSubmit }: { title: string; children: React.ReactNode; status: string; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="admin-modal-backdrop"><section className="admin-panel admin-modal"><button className="admin-modal-close" onClick={onClose} aria-label="Close form">×</button><div className="admin-panel-heading"><div><p className="admin-eyebrow">Location setup</p><h3>Add {title}</h3><p className="admin-muted">Complete the fields below to place this {title.toLowerCase()} in the hierarchy.</p></div></div><form className="admin-setup-form" onSubmit={onSubmit}><div className="admin-form-grid">{children}</div><div className="admin-setup-actions"><button className="admin-primary-button" type="submit">Save {title.toLowerCase()}</button><button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button><span>{status}</span></div></form></section></div>;
}

function WardForm({ constituencies, onClose }: { constituencies: AdminDashboardProps["directory"]["constituencies"]; onClose: () => void }) {
  const [form, setForm] = useState({ id: "", name: "", constituencyId: "", wardNumber: "" });
  const [status, setStatus] = useState("");
  useEffect(() => { void fetchNextLocationId("ward", (id) => setForm((current) => ({ ...current, id }))); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("Saving...");
    const response = await fetch("/api/admin/locations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken") ?? ""}` }, body: JSON.stringify({ type: "ward", name: form.name, constituencyId: form.constituencyId, wardNumber: form.wardNumber }) });
    const result = await response.json();
    if (!response.ok) { setStatus(result.message || "Unable to save ward."); return; }
    window.location.reload();
  }
  return <LocationForm title="Ward" status={status} onClose={onClose} onSubmit={submit}><label className="admin-field"><span>Ward ID</span><input readOnly value={form.id || "Generating..."} /><small>Generated automatically in the standard WARD000001 format.</small></label><div className="admin-ward-details-fields"><label className="admin-field"><span>Constituency</span><select required value={form.constituencyId} onChange={(event) => setForm({ ...form, constituencyId: event.target.value })}><option value="">Select the parent constituency</option>{constituencies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>The District and Province are inherited automatically.</small></label><label className="admin-field"><span>Ward name</span><input required placeholder="Enter the official ward name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><small>Do not repeat the Ward number in the name.</small></label></div><label className="admin-field"><span>Ward number</span><input type="number" min="1" placeholder="Optional official ward number" value={form.wardNumber} onChange={(event) => setForm({ ...form, wardNumber: event.target.value })} /><small>Use a positive number when officially assigned.</small></label></LocationForm>;
}

function CellForm({ wards, onClose }: { wards: AdminDashboardProps["directory"]["wards"]; onClose: () => void }) {
  const [form, setForm] = useState({ id: "", name: "", wardId: "", latitude: "", longitude: "" });
  const [status, setStatus] = useState("");
  useEffect(() => { void fetchNextLocationId("cell", (id) => setForm((current) => ({ ...current, id }))); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("Saving...");
    const response = await fetch("/api/admin/locations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("adminToken") ?? ""}` }, body: JSON.stringify({ type: "cell", name: form.name, wardId: form.wardId, latitude: form.latitude, longitude: form.longitude }) });
    const result = await response.json();
    if (!response.ok) { setStatus(result.message || "Unable to save cell."); return; }
    window.location.reload();
  }
  return <LocationForm title="Cell" status={status} onClose={onClose} onSubmit={submit}><label className="admin-field"><span>Cell ID</span><input readOnly value={form.id || "Generating..."} /><small>Generated automatically in the standard CELL000001 format.</small></label><div className="admin-cell-details-fields"><label className="admin-field"><span>Ward</span><select required value={form.wardId} onChange={(event) => setForm({ ...form, wardId: event.target.value })}><option value="">Select the parent ward</option>{wards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>The Constituency, District, and Province are inherited automatically.</small></label><label className="admin-field"><span>Cell name</span><input required placeholder="Enter the official cell name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><small>Use the official cell name.</small></label></div><div className="admin-coordinate-fields"><label className="admin-field"><span>Latitude</span><input required type="number" step="any" placeholder="For example -17.8252" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /><small>Cell map latitude.</small></label><label className="admin-field"><span>Longitude</span><input required type="number" step="any" placeholder="For example 31.0335" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /><small>Cell map longitude.</small></label></div></LocationForm>;
}

async function fetchNextLocationId(type: "ward" | "cell", setId: (id: string) => void) {
  const response = await fetch(`/api/admin/locations?type=${type}`, { headers: { Authorization: `Bearer ${localStorage.getItem("adminToken") ?? ""}` } });
  if (response.ok) setId((await response.json()).id);
}

async function fetchNextConstituencyId(setId: (id: string) => void) {
  const response = await fetch("/api/admin/constituencies/manage", { headers: { Authorization: `Bearer ${localStorage.getItem("adminToken") ?? ""}` } });
  if (response.ok) setId((await response.json()).id);
}

type AdminDashboardProps = { directory: { provinces: { id: string; name: string }[]; districts: { id: string; name: string; province_id: string }[]; constituencies: { id: string; name: string; province_id: string; district_id: string | null; latitude: number | null; longitude: number | null; districtCount: number; wardCount: number; cellCount: number; mp_name: string | null }[]; wards: { id: string; name: string; constituency_id: string; district_id: string | null; ward_number: number | null }[]; cells: { id: string; name: string; constituency_id: string; ward_id: string | null; is_active: boolean | null; memberCount: number }[] } };

function ConstituencySetupForm({ provinces, districts, initial, onClose }: { provinces: { id: string; name: string }[]; districts: { id: string; name: string; province_id: string }[]; initial?: { id?: string; name?: string; provinceId?: string; districtId?: string }; onClose: () => void }) {
  const [form, setForm] = useState({ id: initial?.id ?? "", name: initial?.name ?? "", provinceId: initial?.provinceId ?? "", districtId: initial?.districtId ?? "", latitude: "", longitude: "", mpName: "", mpPhone: "", mpEmail: "", adminName: "", pin: "", themeColor: "#0f766e" });
  const [mpImage, setMpImage] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const provinceDistricts = districts.filter((district) => district.province_id === form.provinceId);
  useEffect(() => {
    if (!initial?.id) void fetchNextConstituencyId((id) => update("id", id));
  }, [initial?.id]);
  useEffect(() => {
    if (form.districtId && !provinceDistricts.some((district) => district.id === form.districtId)) update("districtId", "");
  }, [form.provinceId]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setStatus("Saving...");
    const token = localStorage.getItem("adminToken");
    const formData = new FormData();
    Object.entries({ ...form, latitude: form.latitude ? Number(form.latitude) : "", longitude: form.longitude ? Number(form.longitude) : "" }).forEach(([key, value]) => formData.append(key, String(value)));
    if (mpImage) formData.append("mpImage", mpImage);
    const response = await fetch("/api/admin/constituencies/manage", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
    setStatus(response.ok ? "Constituency and admin saved. Refresh to view it." : (await response.json()).message || "Unable to save.");
  }
  return <div className="admin-modal-backdrop"><section className="admin-panel admin-modal"><button className="admin-modal-close" onClick={onClose}>×</button><div className="admin-panel-heading"><div><p className="admin-eyebrow">Super admin setup</p><h3>Constituency administration</h3><p className="admin-muted">Create or update the constituency, MP profile, and themed admin account.</p></div></div><form className="admin-setup-form" onSubmit={submit}><div className="admin-form-grid"><label className="admin-field admin-form-full"><span>MP profile image</span><input type="file" accept="image/*" onChange={(e) => setMpImage(e.target.files?.[0] ?? null)} /><small>Upload a clear portrait, up to 10 MB.</small></label><div className="admin-constituency-row"><label className="admin-field"><span>Constituency ID</span><input required readOnly placeholder="Generating..." value={form.id} /><small>Generated automatically in the standard CONS000001 format.</small></label><label className="admin-field"><span>Constituency name</span><input required placeholder="Enter the constituency name" value={form.name} onChange={(e) => update("name", e.target.value)} /></label></div><div className="admin-constituency-row"><label className="admin-field"><span>Province</span><select required value={form.provinceId} onChange={(e) => update("provinceId", e.target.value)}><option value="">Select province</option>{provinces.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Select the parent Province first.</small></label><label className="admin-field"><span>District</span><select required value={form.districtId} onChange={(e) => update("districtId", e.target.value)} disabled={!form.provinceId}><option value="">{form.provinceId ? "Select district" : "Select a province first"}</option>{provinceDistricts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><small>Only Districts in the selected Province are shown.</small></label></div><div className="admin-constituency-row"><label className="admin-field"><span>Latitude</span><input type="number" step="any" placeholder="Enter latitude" value={form.latitude} onChange={(e) => update("latitude", e.target.value)} /></label><label className="admin-field"><span>Longitude</span><input type="number" step="any" placeholder="Enter longitude" value={form.longitude} onChange={(e) => update("longitude", e.target.value)} /></label></div><div className="admin-constituency-row"><label className="admin-field"><span>Member of Parliament</span><input placeholder="Enter MP name" value={form.mpName} onChange={(e) => update("mpName", e.target.value)} /></label><label className="admin-field"><span>MP phone</span><input placeholder="Enter MP phone" value={form.mpPhone} onChange={(e) => update("mpPhone", e.target.value)} /></label></div><div className="admin-constituency-row"><label className="admin-field"><span>MP email</span><input type="email" placeholder="Enter MP email" value={form.mpEmail} onChange={(e) => update("mpEmail", e.target.value)} /></label><label className="admin-field"><span>Constituency admin name</span><input placeholder="Enter admin name" value={form.adminName} onChange={(e) => update("adminName", e.target.value)} /></label></div><div className="admin-constituency-row"><label className="admin-field"><span>Admin 4-digit PIN</span><input required pattern="[0-9]{4}" maxLength={4} inputMode="numeric" placeholder="Enter 4 digits" value={form.pin} onChange={(e) => update("pin", e.target.value.replace(/\D/g, "").slice(0, 4))} /></label><label className="admin-color-field">Theme color<input type="color" value={form.themeColor} onChange={(e) => update("themeColor", e.target.value)} /></label></div></div><div className="admin-setup-actions"><button className="admin-primary-button" type="submit">Save constituency admin</button><button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button><span>{status}</span></div></form></section></div>; }
