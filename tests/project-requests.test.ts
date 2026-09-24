import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectRequestTimeline, validateProjectRequestInput } from '../src/lib/project-requests';

test('validates a complete funding request', () => {
  const result = validateProjectRequestInput({
    title: 'Solar irrigation pilot',
    category: 'Agriculture',
    description: 'We need support to install a solar pump and drip irrigation.',
    requestedAmount: 24000,
    location: 'Ward 8',
    timeline: '3 months',
  });

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('rejects missing project details and invalid amount', () => {
  const result = validateProjectRequestInput({
    title: '',
    category: '',
    description: 'Short',
    requestedAmount: -20,
    location: '',
    timeline: '',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((message) => message.includes('title')));
  assert.ok(result.errors.some((message) => message.includes('amount')));
});

test('builds a clear approval timeline from the request status', () => {
  const timeline = buildProjectRequestTimeline('approved');

  assert.equal(timeline[0].label, 'Submitted');
  assert.equal(timeline[1].label, 'Review');
  assert.equal(timeline[2].label, 'Approved');
  assert.equal(timeline[2].complete, true);
  assert.equal(timeline[2].active, true);
});
