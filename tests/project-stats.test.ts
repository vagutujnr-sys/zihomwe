import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeProjectStats } from '../src/lib/project-stats';

test('aggregates real vote and comment counts by project id', () => {
  const stats = summarizeProjectStats(
    [
      { project_id: 'a' },
      { project_id: 'a' },
      { project_id: 'b' },
    ],
    [
      { project_id: 'a' },
      { project_id: 'b' },
      { project_id: 'b' },
      { project_id: 'b' },
    ]
  );

  assert.deepEqual(stats, {
    a: { votes: 2, comments: 1 },
    b: { votes: 1, comments: 3 },
  });
});
