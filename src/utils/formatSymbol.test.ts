// =============================================================================
// formatSymbol Utility Unit Tests
// =============================================================================

import { formatSymbol, formatUpbitSymbol } from './formatSymbol';

describe('formatSymbol', () => {
  // ---------------------------------------------------------------------------
  // USDT pairs
  // ---------------------------------------------------------------------------

  it('formats BTCUSDT to BTC/USDT', () => {
    expect(formatSymbol('BTCUSDT')).toBe('BTC/USDT');
  });

  it('formats ETHUSDT to ETH/USDT', () => {
    expect(formatSymbol('ETHUSDT')).toBe('ETH/USDT');
  });

  it('formats DOGEUSDT to DOGE/USDT', () => {
    expect(formatSymbol('DOGEUSDT')).toBe('DOGE/USDT');
  });

  it('formats SOLUSDT to SOL/USDT', () => {
    expect(formatSymbol('SOLUSDT')).toBe('SOL/USDT');
  });

  // ---------------------------------------------------------------------------
  // BTC pairs
  // ---------------------------------------------------------------------------

  it('formats ETHBTC to ETH/BTC', () => {
    expect(formatSymbol('ETHBTC')).toBe('ETH/BTC');
  });

  it('formats BNBBTC to BNB/BTC', () => {
    expect(formatSymbol('BNBBTC')).toBe('BNB/BTC');
  });

  // ---------------------------------------------------------------------------
  // ETH pairs
  // ---------------------------------------------------------------------------

  it('formats ADAETH to ADA/ETH', () => {
    expect(formatSymbol('ADAETH')).toBe('ADA/ETH');
  });

  // ---------------------------------------------------------------------------
  // BNB pairs
  // ---------------------------------------------------------------------------

  it('formats SOLBNB to SOL/BNB', () => {
    expect(formatSymbol('SOLBNB')).toBe('SOL/BNB');
  });

  // ---------------------------------------------------------------------------
  // BUSD pairs
  // ---------------------------------------------------------------------------

  it('formats BTCBUSD to BTC/BUSD', () => {
    expect(formatSymbol('BTCBUSD')).toBe('BTC/BUSD');
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('returns original string when no known quote asset matches', () => {
    expect(formatSymbol('UNKNOWN')).toBe('UNKNOWN');
  });

  it('returns original string for empty input', () => {
    expect(formatSymbol('')).toBe('');
  });

  it('does not split a symbol that equals the quote asset exactly', () => {
    // "USDT" alone should not become "/USDT"
    expect(formatSymbol('USDT')).toBe('USDT');
  });

  it('prefers USDT over BTC when symbol ends with USDT', () => {
    // BTCUSDT should match USDT, not BTC
    expect(formatSymbol('BTCUSDT')).toBe('BTC/USDT');
  });
});

// ---------------------------------------------------------------------------
// formatUpbitSymbol
// ---------------------------------------------------------------------------

describe('formatUpbitSymbol', () => {
  it('formats KRW-BTC to BTC/KRW', () => {
    expect(formatUpbitSymbol('KRW-BTC')).toBe('BTC/KRW');
  });

  it('formats KRW-ETH to ETH/KRW', () => {
    expect(formatUpbitSymbol('KRW-ETH')).toBe('ETH/KRW');
  });

  it('formats KRW-DOGE to DOGE/KRW', () => {
    expect(formatUpbitSymbol('KRW-DOGE')).toBe('DOGE/KRW');
  });

  it('formats BTC-ETH to ETH/BTC', () => {
    expect(formatUpbitSymbol('BTC-ETH')).toBe('ETH/BTC');
  });

  it('returns original for invalid format', () => {
    expect(formatUpbitSymbol('UNKNOWN')).toBe('UNKNOWN');
  });

  it('returns original for empty string', () => {
    expect(formatUpbitSymbol('')).toBe('');
  });
});
