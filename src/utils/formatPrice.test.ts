// =============================================================================
// formatPrice Utility Unit Tests
// =============================================================================

import { formatPrice, formatVolume, formatPercentChange } from './formatPrice';

describe('formatPrice', () => {
  // ---------------------------------------------------------------------------
  // Large numbers (>= 1000) — should include commas
  // ---------------------------------------------------------------------------

  describe('large numbers (>= 1000)', () => {
    it('formats thousands with commas', () => {
      const result = formatPrice(1234.56);
      expect(result).toBe('1,234.56');
    });

    it('formats tens of thousands with commas', () => {
      const result = formatPrice(65432.1);
      expect(result).toBe('65,432.10');
    });

    it('formats millions with commas', () => {
      const result = formatPrice(1234567.89);
      expect(result).toBe('1,234,567.89');
    });

    it('respects custom decimal parameter', () => {
      const result = formatPrice(1234.5678, 4);
      expect(result).toBe('1,234.5678');
    });

    it('formats exactly 1000', () => {
      const result = formatPrice(1000);
      expect(result).toBe('1,000.00');
    });
  });

  // ---------------------------------------------------------------------------
  // Medium numbers (1 <= price < 1000)
  // ---------------------------------------------------------------------------

  describe('medium numbers (>= 1 and < 1000)', () => {
    it('formats a regular price with 2 decimals', () => {
      expect(formatPrice(42.5)).toBe('42.50');
    });

    it('formats exactly 1', () => {
      expect(formatPrice(1)).toBe('1.00');
    });

    it('formats 999.99', () => {
      expect(formatPrice(999.99)).toBe('999.99');
    });

    it('respects custom decimal parameter', () => {
      expect(formatPrice(42.1234, 4)).toBe('42.1234');
    });
  });

  // ---------------------------------------------------------------------------
  // Small numbers (< 1) — should show at least 6 decimals
  // ---------------------------------------------------------------------------

  describe('small numbers (< 1)', () => {
    it('shows at least 6 decimals for very small prices', () => {
      const result = formatPrice(0.00001234);
      expect(result).toBe('0.000012');
    });

    it('uses custom decimals when larger than 6', () => {
      const result = formatPrice(0.00001234, 8);
      expect(result).toBe('0.00001234');
    });

    it('uses 6 decimals even when custom decimals is smaller', () => {
      // decimals = 2 but price < 1, so Math.max(2, 6) = 6
      const result = formatPrice(0.123456, 2);
      expect(result).toBe('0.123456');
    });

    it('formats 0.5 with 6 decimals by default', () => {
      const result = formatPrice(0.5);
      expect(result).toBe('0.500000');
    });
  });
});

describe('formatVolume', () => {
  // ---------------------------------------------------------------------------
  // Billion suffix
  // ---------------------------------------------------------------------------

  describe('billions', () => {
    it('formats billions with B suffix', () => {
      expect(formatVolume(1500000000)).toBe('1.50B');
    });

    it('formats exactly 1 billion', () => {
      expect(formatVolume(1000000000)).toBe('1.00B');
    });
  });

  // ---------------------------------------------------------------------------
  // Million suffix
  // ---------------------------------------------------------------------------

  describe('millions', () => {
    it('formats millions with M suffix', () => {
      expect(formatVolume(2500000)).toBe('2.50M');
    });

    it('formats exactly 1 million', () => {
      expect(formatVolume(1000000)).toBe('1.00M');
    });
  });

  // ---------------------------------------------------------------------------
  // Thousand suffix
  // ---------------------------------------------------------------------------

  describe('thousands', () => {
    it('formats thousands with K suffix', () => {
      expect(formatVolume(45600)).toBe('45.60K');
    });

    it('formats exactly 1 thousand', () => {
      expect(formatVolume(1000)).toBe('1.00K');
    });
  });

  // ---------------------------------------------------------------------------
  // Small numbers (no suffix)
  // ---------------------------------------------------------------------------

  describe('small numbers', () => {
    it('formats numbers below 1000 with 2 decimals', () => {
      expect(formatVolume(999.99)).toBe('999.99');
    });

    it('formats zero', () => {
      expect(formatVolume(0)).toBe('0.00');
    });

    it('formats small decimal', () => {
      expect(formatVolume(42.1)).toBe('42.10');
    });
  });
});

describe('formatPercentChange', () => {
  it('adds + prefix for positive values', () => {
    expect(formatPercentChange(5.23)).toBe('+5.23%');
  });

  it('adds - prefix for negative values', () => {
    expect(formatPercentChange(-3.14)).toBe('-3.14%');
  });

  it('adds + prefix for zero', () => {
    // zero is considered non-negative, so it gets the + prefix
    expect(formatPercentChange(0)).toBe('+0.00%');
  });

  it('formats large positive change', () => {
    expect(formatPercentChange(123.456)).toBe('+123.46%');
  });

  it('formats large negative change', () => {
    expect(formatPercentChange(-99.999)).toBe('-100.00%');
  });

  it('formats small positive change', () => {
    expect(formatPercentChange(0.01)).toBe('+0.01%');
  });
});
