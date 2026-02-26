// =============================================================================
// symbolMap Utility Unit Tests
// =============================================================================

import {
  toBinanceSymbol,
  toUpbitSymbol,
  getMappedBinanceSymbols,
  getMappedUpbitSymbols,
  BINANCE_TO_UPBIT_MAP,
  UPBIT_TO_BINANCE_MAP,
} from './symbolMap';

describe('symbolMap', () => {
  // ---------------------------------------------------------------------------
  // toUpbitSymbol (Binance → Upbit)
  // ---------------------------------------------------------------------------

  describe('toUpbitSymbol', () => {
    it('converts BTCUSDT to KRW-BTC', () => {
      expect(toUpbitSymbol('BTCUSDT')).toBe('KRW-BTC');
    });

    it('converts ETHUSDT to KRW-ETH', () => {
      expect(toUpbitSymbol('ETHUSDT')).toBe('KRW-ETH');
    });

    it('converts SOLUSDT to KRW-SOL', () => {
      expect(toUpbitSymbol('SOLUSDT')).toBe('KRW-SOL');
    });

    it('converts DOGEUSDT to KRW-DOGE', () => {
      expect(toUpbitSymbol('DOGEUSDT')).toBe('KRW-DOGE');
    });

    it('converts all default watchlist symbols', () => {
      expect(toUpbitSymbol('XRPUSDT')).toBe('KRW-XRP');
      expect(toUpbitSymbol('ADAUSDT')).toBe('KRW-ADA');
      expect(toUpbitSymbol('AVAXUSDT')).toBe('KRW-AVAX');
    });

    it('returns BNBUSDT unchanged (not listed on Upbit)', () => {
      expect(toUpbitSymbol('BNBUSDT')).toBe('BNBUSDT');
    });

    it('returns original symbol when no mapping exists', () => {
      expect(toUpbitSymbol('SHIBUSDT')).toBe('SHIBUSDT');
    });

    it('returns original for empty string', () => {
      expect(toUpbitSymbol('')).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // toBinanceSymbol (Upbit → Binance)
  // ---------------------------------------------------------------------------

  describe('toBinanceSymbol', () => {
    it('converts KRW-BTC to BTCUSDT', () => {
      expect(toBinanceSymbol('KRW-BTC')).toBe('BTCUSDT');
    });

    it('converts KRW-ETH to ETHUSDT', () => {
      expect(toBinanceSymbol('KRW-ETH')).toBe('ETHUSDT');
    });

    it('converts KRW-SOL to SOLUSDT', () => {
      expect(toBinanceSymbol('KRW-SOL')).toBe('SOLUSDT');
    });

    it('converts all default watchlist symbols', () => {
      expect(toBinanceSymbol('KRW-XRP')).toBe('XRPUSDT');
      expect(toBinanceSymbol('KRW-DOGE')).toBe('DOGEUSDT');
      expect(toBinanceSymbol('KRW-ADA')).toBe('ADAUSDT');
      expect(toBinanceSymbol('KRW-AVAX')).toBe('AVAXUSDT');
    });

    it('returns KRW-BNB unchanged (not mapped)', () => {
      expect(toBinanceSymbol('KRW-BNB')).toBe('KRW-BNB');
    });

    it('returns original symbol when no mapping exists', () => {
      expect(toBinanceSymbol('KRW-SHIB')).toBe('KRW-SHIB');
    });

    it('returns original for empty string', () => {
      expect(toBinanceSymbol('')).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // Bidirectional consistency
  // ---------------------------------------------------------------------------

  describe('bidirectional consistency', () => {
    it('round-trips all Binance symbols through Upbit and back', () => {
      for (const binanceSymbol of BINANCE_TO_UPBIT_MAP.keys()) {
        const upbitSymbol = toUpbitSymbol(binanceSymbol);
        expect(toBinanceSymbol(upbitSymbol)).toBe(binanceSymbol);
      }
    });

    it('round-trips all Upbit symbols through Binance and back', () => {
      for (const upbitSymbol of UPBIT_TO_BINANCE_MAP.keys()) {
        const binanceSymbol = toBinanceSymbol(upbitSymbol);
        expect(toUpbitSymbol(binanceSymbol)).toBe(upbitSymbol);
      }
    });

    it('has matching map sizes', () => {
      expect(BINANCE_TO_UPBIT_MAP.size).toBe(UPBIT_TO_BINANCE_MAP.size);
    });
  });

  // ---------------------------------------------------------------------------
  // Helper functions
  // ---------------------------------------------------------------------------

  describe('getMappedBinanceSymbols', () => {
    it('returns all mapped Binance symbols', () => {
      const symbols = getMappedBinanceSymbols();
      expect(symbols).toContain('BTCUSDT');
      expect(symbols).toContain('ETHUSDT');
      expect(symbols.length).toBe(BINANCE_TO_UPBIT_MAP.size);
    });
  });

  describe('getMappedUpbitSymbols', () => {
    it('returns all mapped Upbit symbols', () => {
      const symbols = getMappedUpbitSymbols();
      expect(symbols).toContain('KRW-BTC');
      expect(symbols).toContain('KRW-ETH');
      expect(symbols.length).toBe(UPBIT_TO_BINANCE_MAP.size);
    });
  });
});
