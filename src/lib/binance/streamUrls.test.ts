import {
  buildStreamUrl,
  getKlineStream,
  getDepthStream,
  getTradeStream,
  getMiniTickerStream,
  buildCombinedStreamUrl,
} from './streamUrls';

describe('streamUrls', () => {
  describe('getKlineStream', () => {
    it('returns lowercase symbol with kline interval', () => {
      expect(getKlineStream('BTCUSDT', '1m')).toBe('btcusdt@kline_1m');
    });

    it('handles different intervals', () => {
      expect(getKlineStream('ETHUSDT', '4h')).toBe('ethusdt@kline_4h');
    });
  });

  describe('getDepthStream', () => {
    it('returns lowercase symbol with depth@100ms suffix', () => {
      expect(getDepthStream('BTCUSDT')).toBe('btcusdt@depth@100ms');
    });
  });

  describe('getTradeStream', () => {
    it('returns lowercase symbol with trade suffix', () => {
      expect(getTradeStream('BTCUSDT')).toBe('btcusdt@trade');
    });
  });

  describe('getMiniTickerStream', () => {
    it('returns lowercase symbol with miniTicker suffix', () => {
      expect(getMiniTickerStream('BTCUSDT')).toBe('btcusdt@miniTicker');
    });
  });

  describe('buildStreamUrl', () => {
    it('combines streams with / separator', () => {
      const url = buildStreamUrl(['btcusdt@kline_1m', 'btcusdt@depth@100ms']);
      expect(url).toContain('?streams=btcusdt@kline_1m/btcusdt@depth@100ms');
    });

    it('uses the Binance WS base URL', () => {
      const url = buildStreamUrl(['btcusdt@trade']);
      expect(url).toMatch(/^wss:\/\/stream\.binance\.com:9443\/stream\?streams=/);
    });

    it('throws for an empty streams array', () => {
      expect(() => buildStreamUrl([])).toThrow('streams must not be empty');
    });

    it('handles a single stream', () => {
      const url = buildStreamUrl(['btcusdt@trade']);
      expect(url).toContain('?streams=btcusdt@trade');
    });
  });

  describe('buildCombinedStreamUrl', () => {
    it('combines kline, depth, trade, and miniTicker streams', () => {
      const url = buildCombinedStreamUrl('BTCUSDT', '1m');

      expect(url).toContain('btcusdt@kline_1m');
      expect(url).toContain('btcusdt@depth@100ms');
      expect(url).toContain('btcusdt@trade');
      expect(url).toContain('btcusdt@miniTicker');
    });

    it('uses forward slash to separate streams', () => {
      const url = buildCombinedStreamUrl('ETHUSDT', '5m');
      const streamsParam = url.split('?streams=')[1];
      const streams = streamsParam.split('/');
      expect(streams).toHaveLength(4);
    });
  });
});
