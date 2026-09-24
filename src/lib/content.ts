import { supabase } from './supabase';
import { summarizeProjectStats } from './project-stats';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pkbpvgyisrmwooecgyzr.supabase.co';

export function buildNewsImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return '';
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return `${supabaseUrl}/storage/v1/object/public/news-images/${imagePath.replace(/^\/+/, '')}`;
}

export interface NewsStory {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  body?: string;
  time: string;
  imageUrl: string;
  comments: number;
  likes: number;
  views: number;
}

export interface Announcement {
  id: string;
  title: string;
  date: string;
}

export interface EventItem {
  id: string;
  title: string;
  eventDate: string;
  location: string;
}

export interface ProjectCard {
  id: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  votes: number;
  comments: number;
  imageUrl: string;
  category: string;
  location: string;
  team?: Array<{ name: string; role: string; avatar: string }>;
  updates?: Array<{ date: string; text: string }>;
}

export interface LeadershipMember {
  id: string;
  name: string;
  role: string;
  constituency: string;
  image: string | null;
  bio: string;
  isPresident: boolean;
}

function readString(row: Record<string, unknown>, key: string, fallback = ''): string {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
}

function readNumber(row: Record<string, unknown>, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function readBoolean(row: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = row[key];
  return typeof value === 'boolean' ? value : fallback;
}

function readArray<T>(row: Record<string, unknown>, key: string): T[] {
  const value = row[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

export function formatNewsTime(createdAt: string | null | undefined, fallback = 'Recently added'): string {
  if (!createdAt) return fallback;
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return fallback;

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) === 1 ? '' : 's'} ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) === 1 ? '' : 's'} ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) === 1 ? '' : 's'} ago`;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(timestamp));
}

export function normalizeNewsStory(row: Record<string, unknown>): NewsStory {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    title: readString(row, 'title', 'Untitled update'),
    category: readString(row, 'category', 'Community'),
    excerpt: readString(row, 'excerpt', 'No summary provided yet.'),
    body: readString(row, 'body', ''),
    time: formatNewsTime(readString(row, 'created_at'), readString(row, 'time_label', readString(row, 'time', 'Recently added'))),
    imageUrl: buildNewsImageUrl(readString(row, 'image_url')),
    comments: readNumber(row, 'comments_count', 0),
    likes: readNumber(row, 'likes', 0),
    views: readNumber(row, 'views', 0),
  };
}

export function normalizeAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    title: readString(row, 'title', 'New update'),
    date: readString(row, 'date_label', readString(row, 'date', 'Coming soon')),
  };
}

export function normalizeProjectCard(row: Record<string, unknown>): ProjectCard {
  const sourceStatus = readString(row, 'status', 'Planning');
  return {
    id: String(row.id ?? crypto.randomUUID()),
    title: readString(row, 'title', 'Community project'),
    description: readString(row, 'description', 'A project supported by app members.'),
    status: sourceStatus.toLowerCase() === 'approved' ? 'In Progress' : sourceStatus,
    progress: readNumber(row, 'progress', 0),
    votes: readNumber(row, 'votes', 0),
    comments: readNumber(row, 'comments', 0),
    imageUrl: readString(row, 'image_url', 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=80'),
    category: readString(row, 'category', 'Funded Member Project'),
    location: readString(row, 'location', 'Community-led'),
    team: readArray<{ name: string; role: string; avatar: string }>(row, 'team'),
    updates: readArray<{ date: string; text: string }>(row, 'updates'),
  };
}

export function normalizeLeadershipMember(row: Record<string, unknown>): LeadershipMember {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: readString(row, 'name', 'Leadership member'),
    role: readString(row, 'role', 'Community leader'),
    constituency: readString(row, 'constituency', 'Your constituency'),
    image: readString(row, 'image_url', '') || null,
    bio: readString(row, 'bio', 'Committed to serving the community.'),
    isPresident: readBoolean(row, 'is_president', false),
  };
}

export async function getNewsStories(constituencyId?: string | null) {
  let query = supabase.from('news_stories').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(50);
  if (constituencyId) query = query.eq('constituency_id', constituencyId);
  const { data, error } = await query;

  if (error) {
    console.error('Failed to load news stories', error);
    return [];
  }

  const stories = data ?? [];
  const withEngagement = await Promise.all(stories.map(async (story) => {
    const [likes, views] = await Promise.all([
      supabase.from('news_likes').select('id', { count: 'exact', head: true }).eq('news_id', story.id),
      supabase.from('news_views').select('id', { count: 'exact', head: true }).eq('news_id', story.id),
    ]);

    if (likes.error || views.error) {
      console.error('Failed to load news engagement', likes.error ?? views.error);
    }

    return { ...story, likes: likes.count ?? 0, views: views.count ?? 0 };
  }));

  return withEngagement.map(normalizeNewsStory);
}

export async function getAnnouncements() {
  const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5);

  if (error) {
    console.error('Failed to load announcements', error);
    return [];
  }

  return (data ?? []).map(normalizeAnnouncement);
}

export async function getEvents() {
  const { data, error } = await supabase.from('events').select('id, title, event_date, location, status').eq('status', 'published').gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date', { ascending: true }).limit(5);
  if (error) {
    console.error('Failed to load events', error);
    return [];
  }
  return (data ?? []).map((row) => ({ id: String(row.id), title: readString(row, 'title', 'Community event'), eventDate: readString(row, 'event_date', ''), location: readString(row, 'location', '') }));
}

export async function getProjects() {
  const { data, error } = await supabase.from('member_projects').select('*').order('created_at', { ascending: false }).limit(6);

  if (error) {
    console.error('Failed to load projects', error);
    return [];
  }

  const projects = data ?? [];
  const [likes, comments] = await Promise.all([
    supabase.from('project_likes').select('project_id'),
    supabase.from('project_comments').select('project_id'),
  ]);
  const stats = summarizeProjectStats(likes.data ?? [], comments.data ?? []);
  return projects.map((project) => normalizeProjectCard({
    ...project,
    votes: stats[String(project.id)]?.votes ?? 0,
    comments: stats[String(project.id)]?.comments ?? 0,
  }));
}

export async function getLeadership() {
  const { data, error } = await supabase.from('leadership_members').select('*').order('created_at', { ascending: false }).limit(6);

  if (error) {
    console.error('Failed to load leadership', error);
    return [];
  }

  return (data ?? []).map(normalizeLeadershipMember);
}
