import test from 'node:test';
import assert from 'node:assert/strict';

import { formatNewsTime, normalizeNewsStory, normalizeAnnouncement, normalizeProjectCard, normalizeLeadershipMember } from '../src/lib/content';

test('normalizes news stories from Supabase rows', () => {
  const story = normalizeNewsStory({
    title: 'Road upgrade',
    category: 'Infrastructure',
    excerpt: 'Repairs are underway',
    time_label: 'Now',
    image_url: 'news/road.jpg',
    comments_count: 12,
  });

  assert.equal(story.title, 'Road upgrade');
  assert.equal(story.category, 'Infrastructure');
  assert.equal(story.comments, 12);
  assert.match(story.imageUrl, /\/storage\/v1\/object\/public\/news-images\/news\/road\.jpg$/);
});

test('uses the article timestamp instead of a stored manual time label', () => {
  const story = normalizeNewsStory({
    title: 'New article',
    time_label: 'Just now',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  });

  assert.equal(story.time, '2 hours ago');
  assert.equal(formatNewsTime(undefined, 'Legacy label'), 'Legacy label');
});

test('normalizes leadership members and project cards', () => {
  const project = normalizeProjectCard({
    title: 'Poultry Coop',
    description: 'Small startup',
    status: 'In Progress',
    progress: 60,
    votes: 22,
    comments: 5,
    image_url: 'https://example.com/poultry.jpg',
    category: 'Agriculture',
    location: 'Ward 8',
  });

  const leader = normalizeLeadershipMember({
    name: 'Hon. Jane Doe',
    role: 'MP',
    constituency: 'Harare Central',
    image_url: 'https://example.com/jane.jpg',
    bio: 'Serving the people',
    is_president: false,
  });

  assert.equal(project.title, 'Poultry Coop');
  assert.equal(project.status, 'In Progress');
  assert.equal(leader.name, 'Hon. Jane Doe');
  assert.equal(leader.constituency, 'Harare Central');
});

test('normalizes announcements with a fallback label', () => {
  const announcement = normalizeAnnouncement({ title: 'Town hall meeting' });
  assert.equal(announcement.title, 'Town hall meeting');
  assert.equal(announcement.date, 'Coming soon');
});
