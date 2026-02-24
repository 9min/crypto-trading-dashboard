// =============================================================================
// formatTime Utility Unit Tests
// =============================================================================

import { formatTime, formatDate, formatDateTime } from './formatTime';

// Use a fixed timestamp for deterministic tests.
// 2024-01-15T10:30:45.000Z = 1705311045000
// Note: The actual formatted output depends on the local timezone of the test
// environment (jsdom defaults). We test structural patterns rather than exact
// locale-dependent strings where timezone could vary.

describe('formatTime', () => {
  it('returns a string with HH:MM:SS format', () => {
    const timestamp = 1705311045000; // 2024-01-15T10:30:45Z
    const result = formatTime(timestamp);

    // Should match a 24-hour time pattern like "10:30:45" or "05:30:45"
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('returns different times for different timestamps', () => {
    const t1 = 1705311045000; // 10:30:45 UTC
    const t2 = 1705314645000; // 11:30:45 UTC (1 hour later)

    const r1 = formatTime(t1);
    const r2 = formatTime(t2);

    expect(r1).not.toBe(r2);
  });

  it('handles midnight timestamp', () => {
    // 2024-01-15T00:00:00.000Z
    const midnight = 1705276800000;
    const result = formatTime(midnight);

    // Should be a valid time string
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe('formatDate', () => {
  it('returns a string containing month abbreviation, day, and year', () => {
    const timestamp = 1705311045000; // 2024-01-15
    const result = formatDate(timestamp);

    // en-US format: "Jan 15, 2024"
    expect(result).toContain('2024');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('returns different dates for different days', () => {
    const day1 = 1705311045000; // Jan 15
    const day2 = 1705397445000; // Jan 16

    const r1 = formatDate(day1);
    const r2 = formatDate(day2);

    expect(r1).not.toBe(r2);
  });
});

describe('formatDateTime', () => {
  it('combines date and time into a single string', () => {
    const timestamp = 1705311045000;
    const result = formatDateTime(timestamp);

    // Should contain both the date part and the time part
    const datePart = formatDate(timestamp);
    const timePart = formatTime(timestamp);

    expect(result).toBe(`${datePart} ${timePart}`);
  });

  it('returns a string with both date and time components', () => {
    const timestamp = 1705311045000;
    const result = formatDateTime(timestamp);

    // Should contain year and a time-like pattern
    expect(result).toContain('2024');
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
