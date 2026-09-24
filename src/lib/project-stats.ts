export type ProjectStatRow = { project_id: string };

export function summarizeProjectStats(likes: ProjectStatRow[], comments: ProjectStatRow[]) {
  const voteCounts = new Map<string, number>();
  const commentCounts = new Map<string, number>();

  for (const like of likes) {
    const projectId = String(like.project_id ?? '');
    if (!projectId) continue;
    voteCounts.set(projectId, (voteCounts.get(projectId) ?? 0) + 1);
  }

  for (const comment of comments) {
    const projectId = String(comment.project_id ?? '');
    if (!projectId) continue;
    commentCounts.set(projectId, (commentCounts.get(projectId) ?? 0) + 1);
  }

  const projectIds = new Set([...voteCounts.keys(), ...commentCounts.keys()]);
  const stats: Record<string, { votes: number; comments: number }> = {};

  for (const projectId of projectIds) {
    stats[projectId] = {
      votes: voteCounts.get(projectId) ?? 0,
      comments: commentCounts.get(projectId) ?? 0,
    };
  }

  return stats;
}
