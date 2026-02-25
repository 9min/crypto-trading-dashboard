import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the supabase client before importing the module under test
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect.mockReturnValue({
    eq: mockEq.mockReturnValue({
      single: mockSingle,
    }),
  }),
  upsert: mockUpsert,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { fetchPreferences, upsertPreferences } from './preferencesService';

describe('preferencesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // fetchPreferences
  // ---------------------------------------------------------------------------
  describe('fetchPreferences', () => {
    it('returns parsed preferences for a valid row', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'user-1',
          layout: { lg: [{ i: 'chart', x: 0, y: 0, w: 8, h: 14 }] },
          watchlist_symbols: ['BTCUSDT', 'ETHUSDT'],
          theme: 'light',
          interval: '15m',
          updated_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await fetchPreferences('user-1');

      expect(mockFrom).toHaveBeenCalledWith('user_preferences');
      expect(result).toEqual({
        layout: { lg: [{ i: 'chart', x: 0, y: 0, w: 8, h: 14 }] },
        watchlistSymbols: ['BTCUSDT', 'ETHUSDT'],
        theme: 'light',
        interval: '15m',
      });
    });

    it('returns null when no row exists (PGRST116)', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      const result = await fetchPreferences('user-1');
      expect(result).toBeNull();
    });

    it('throws on non-PGRST116 errors', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'connection refused', code: '500' },
      });

      await expect(fetchPreferences('user-1')).rejects.toThrow('fetchPreferences failed');
    });

    it('returns null when data is null', async () => {
      mockSingle.mockResolvedValue({ data: null, error: null });

      const result = await fetchPreferences('user-1');
      expect(result).toBeNull();
    });

    it('defaults theme to "dark" for invalid theme value', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'user-1',
          layout: null,
          watchlist_symbols: [],
          theme: 'sepia',
          interval: '1m',
          updated_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await fetchPreferences('user-1');
      expect(result?.theme).toBe('dark');
    });

    it('defaults interval to "1m" for invalid interval value', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'user-1',
          layout: null,
          watchlist_symbols: [],
          theme: 'dark',
          interval: '2w',
          updated_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await fetchPreferences('user-1');
      expect(result?.interval).toBe('1m');
    });

    it('returns null layout when JSONB layout is invalid', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'user-1',
          layout: 'not an object',
          watchlist_symbols: [],
          theme: 'dark',
          interval: '1m',
          updated_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await fetchPreferences('user-1');
      expect(result?.layout).toBeNull();
    });

    it('returns empty array for non-array watchlist_symbols', async () => {
      mockSingle.mockResolvedValue({
        data: {
          id: 'user-1',
          layout: null,
          watchlist_symbols: 'not an array',
          theme: 'dark',
          interval: '1m',
          updated_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await fetchPreferences('user-1');
      expect(result?.watchlistSymbols).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // upsertPreferences
  // ---------------------------------------------------------------------------
  describe('upsertPreferences', () => {
    it('calls upsert with mapped fields', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      await upsertPreferences('user-1', {
        theme: 'light',
        interval: '1h',
        watchlistSymbols: ['BTCUSDT'],
      });

      expect(mockFrom).toHaveBeenCalledWith('user_preferences');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-1',
          theme: 'light',
          interval: '1h',
          watchlist_symbols: ['BTCUSDT'],
          updated_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      );
    });

    it('only includes provided fields in the upsert payload', async () => {
      mockUpsert.mockResolvedValue({ error: null });

      await upsertPreferences('user-1', { theme: 'dark' });

      const payload = mockUpsert.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.theme).toBe('dark');
      expect(payload).not.toHaveProperty('interval');
      expect(payload).not.toHaveProperty('watchlist_symbols');
      expect(payload).not.toHaveProperty('layout');
    });

    it('logs error on upsert failure without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockUpsert.mockResolvedValue({ error: { message: 'DB error' } });

      await expect(upsertPreferences('user-1', { theme: 'dark' })).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[preferencesService] Failed to upsert preferences',
        expect.objectContaining({ userId: 'user-1' }),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
