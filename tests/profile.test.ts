import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProfileImageUrl } from '../src/lib/profile';
import { resolveLocationFromCell } from '../src/lib/location';
import { decodeBase64Url, parseCitizenToken, signCitizenSession } from '../src/lib/citizen-token';
import { readCitizenUserProfile } from '../src/lib/session';

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';

test('builds a public profile image URL from a stored path', () => {
  const url = buildProfileImageUrl('user-uploads/abc123/profile.jpg');

  assert.equal(
    url,
    'https://pkbpvgyisrmwooecgyzr.supabase.co/storage/v1/object/public/profile-pictures/user-uploads/abc123/profile.jpg'
  );
});

test('returns null when there is no profile image path', () => {
  assert.equal(buildProfileImageUrl(''), null);
  assert.equal(buildProfileImageUrl(null), null);
});

test('decodes the session token name without Node Buffer', () => {
  const token = signCitizenSession({
    id: 'user-123',
    phone: '+263771234567',
    deviceId: 'device-abc',
    fullName: 'Lloyd Gutu',
    handle: 'lloydgutu',
  });
  const body = token.split('.')[0];
  const decoded = JSON.parse(decodeBase64Url(body));
  assert.equal(decoded.fullName, 'Lloyd Gutu');
  assert.equal(parseCitizenToken(token)?.fullName, 'Lloyd Gutu');
});

test('reads the logged-in user profile from the citizen session token', () => {
  const previousWindow = (globalThis as any).window;
  const storage = new Map<string, string>();
  const previousSecret = process.env.SESSION_SECRET;
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  };

  try {
    process.env.SESSION_SECRET = 'test-session-secret';
    const token = signCitizenSession({
      id: 'user-123',
      phone: '+263771234567',
      deviceId: 'device-abc',
      fullName: 'Lloyd Gutu',
      handle: 'lloydgutu',
    });
    storage.set('zihomweSessionToken', token);

    assert.deepEqual(readCitizenUserProfile(), {
      fullName: 'Lloyd Gutu',
      handle: 'lloydgutu',
      initials: 'LG',
    });

    delete process.env.SESSION_SECRET;
    storage.set('zihomweSessionToken', token);
    assert.deepEqual(readCitizenUserProfile(), {
      fullName: 'Lloyd Gutu',
      handle: 'lloydgutu',
      initials: 'LG',
    });
  } finally {
    if (previousSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = previousSecret;
    }
    if (previousWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = previousWindow;
    }
  }
});

test('resolves the full location hierarchy from a cell id', async () => {
  const rows = {
    cells: [{ id: 'cell-1', name: 'Harare', ward_id: 'ward-1', constituency_id: null, district_id: null, province_id: null }],
    wards: [{ id: 'ward-1', name: 'Ward 1', ward_number: 1, constituency_id: 'constituency-1', district_id: null, province_id: null }],
    constituencies: [{ id: 'constituency-1', name: 'Central', district_id: 'district-1', province_id: null }],
    districts: [{ id: 'district-1', name: 'Harare', province_id: 'province-1' }],
    provinces: [{ id: 'province-1', name: 'Harare Metropolitan' }],
  };
  const client = {
    from(table: keyof typeof rows) {
      return {
        select() {
          return {
            eq(_: string, id: string) {
              return { maybeSingle: async () => ({ data: rows[table].find((row) => row.id === id) ?? null, error: null }) };
            },
          };
        },
      };
    },
  };

  assert.deepEqual(await resolveLocationFromCell(client, 'cell-1'), {
    province: 'Harare Metropolitan',
    provinceId: 'province-1',
    district: 'Harare',
    districtId: 'district-1',
    constituency: 'Central',
    constituencyId: 'constituency-1',
    ward: 'Ward 1',
    wardId: 'ward-1',
    wardNumber: 1,
    cell: 'Harare',
    cellId: 'cell-1',
  });
});
