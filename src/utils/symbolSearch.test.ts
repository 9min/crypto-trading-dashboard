import { filterSymbols, POPULAR_USDT_SYMBOLS } from './symbolSearch';

describe('filterSymbols', () => {
  it('returns matches for a case-insensitive query', () => {
    const results = filterSymbols('btc', []);
    expect(results).toContain('BTCUSDT');
  });

  it('handles uppercase query', () => {
    const results = filterSymbols('ETH', []);
    expect(results).toContain('ETHUSDT');
  });

  it('excludes symbols in the exclude list', () => {
    const results = filterSymbols('btc', ['BTCUSDT']);
    expect(results).not.toContain('BTCUSDT');
  });

  it('returns at most 20 results', () => {
    // Empty query matches everything
    const results = filterSymbols('', []);
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it('returns empty array when all matches are excluded', () => {
    const results = filterSymbols('BTCUSDT', ['BTCUSDT']);
    expect(results).toHaveLength(0);
  });

  it('returns results when query is empty (limited to 20)', () => {
    const results = filterSymbols('', []);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it('trims whitespace from the query', () => {
    const results = filterSymbols('  btc  ', []);
    expect(results).toContain('BTCUSDT');
  });

  it('returns results from the POPULAR_USDT_SYMBOLS list', () => {
    const results = filterSymbols('SOL', []);
    expect(results.every((s) => POPULAR_USDT_SYMBOLS.includes(s))).toBe(true);
  });

  describe('exchange filtering', () => {
    it('defaults to binance exchange and includes all popular symbols', () => {
      const results = filterSymbols('BNB', []);
      expect(results).toContain('BNBUSDT');
    });

    it('filters to mapped symbols only when exchange is upbit', () => {
      // BNB is NOT on Upbit KRW market
      const results = filterSymbols('BNB', [], 'upbit');
      expect(results).not.toContain('BNBUSDT');
    });

    it('includes symbols that have upbit mapping when exchange is upbit', () => {
      // BTC is on Upbit KRW market
      const results = filterSymbols('BTC', [], 'upbit');
      expect(results).toContain('BTCUSDT');
    });

    it('matches upbit format query when exchange is upbit', () => {
      const results = filterSymbols('KRW-BTC', [], 'upbit');
      expect(results).toContain('BTCUSDT');
    });
  });

  it('returns no results for a non-matching query', () => {
    const results = filterSymbols('ZZZZZ', []);
    expect(results).toHaveLength(0);
  });
});
