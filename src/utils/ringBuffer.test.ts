// =============================================================================
// RingBuffer Unit Tests
// =============================================================================

import { RingBuffer } from './ringBuffer';

describe('RingBuffer', () => {
  // ---------------------------------------------------------------------------
  // Push & Length Tracking
  // ---------------------------------------------------------------------------

  describe('push and length', () => {
    it('starts with length 0', () => {
      const buffer = new RingBuffer(5, 2);
      expect(buffer.length).toBe(0);
    });

    it('increments length on push', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      expect(buffer.length).toBe(1);
      buffer.push([3, 4]);
      expect(buffer.length).toBe(2);
    });

    it('caps length at capacity', () => {
      const buffer = new RingBuffer(3, 1);
      buffer.push([1]);
      buffer.push([2]);
      buffer.push([3]);
      buffer.push([4]); // overflow
      expect(buffer.length).toBe(3);
    });

    it('reports correct capacity', () => {
      const buffer = new RingBuffer(10, 3);
      expect(buffer.capacity).toBe(10);
    });
  });

  // ---------------------------------------------------------------------------
  // getAt
  // ---------------------------------------------------------------------------

  describe('getAt', () => {
    it('returns correct items by index (insertion order)', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([10, 20]);
      buffer.push([30, 40]);
      buffer.push([50, 60]);

      expect(buffer.getAt(0)).toEqual([10, 20]);
      expect(buffer.getAt(1)).toEqual([30, 40]);
      expect(buffer.getAt(2)).toEqual([50, 60]);
    });

    it('returns null for negative index', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      expect(buffer.getAt(-1)).toBeNull();
    });

    it('returns null for index >= length', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      expect(buffer.getAt(1)).toBeNull();
      expect(buffer.getAt(5)).toBeNull();
    });

    it('returns null for index on empty buffer', () => {
      const buffer = new RingBuffer(5, 2);
      expect(buffer.getAt(0)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Overflow / FIFO Eviction
  // ---------------------------------------------------------------------------

  describe('overflow (FIFO eviction)', () => {
    it('evicts oldest entry when capacity is exceeded', () => {
      const buffer = new RingBuffer(3, 1);
      buffer.push([1]);
      buffer.push([2]);
      buffer.push([3]);
      buffer.push([4]); // evicts [1]

      expect(buffer.length).toBe(3);
      expect(buffer.getAt(0)).toEqual([2]);
      expect(buffer.getAt(1)).toEqual([3]);
      expect(buffer.getAt(2)).toEqual([4]);
    });

    it('handles multiple overflows correctly', () => {
      const buffer = new RingBuffer(2, 1);
      buffer.push([1]); // [1, _]
      buffer.push([2]); // [1, 2]
      buffer.push([3]); // [3, 2] — evicts 1
      buffer.push([4]); // [3, 4] — evicts 2
      buffer.push([5]); // [5, 4] — evicts 3

      expect(buffer.length).toBe(2);
      expect(buffer.getAt(0)).toEqual([4]);
      expect(buffer.getAt(1)).toEqual([5]);
    });

    it('handles complete wrap-around with multi-field entries', () => {
      const buffer = new RingBuffer(2, 3);
      buffer.push([1, 2, 3]);
      buffer.push([4, 5, 6]);
      buffer.push([7, 8, 9]); // evicts [1,2,3]

      expect(buffer.getAt(0)).toEqual([4, 5, 6]);
      expect(buffer.getAt(1)).toEqual([7, 8, 9]);
    });
  });

  // ---------------------------------------------------------------------------
  // toArray
  // ---------------------------------------------------------------------------

  describe('toArray', () => {
    it('returns empty array for empty buffer', () => {
      const buffer = new RingBuffer(5, 2);
      expect(buffer.toArray()).toEqual([]);
    });

    it('returns items in insertion order', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      buffer.push([3, 4]);
      buffer.push([5, 6]);

      expect(buffer.toArray()).toEqual([
        [1, 2],
        [3, 4],
        [5, 6],
      ]);
    });

    it('returns items in insertion order after overflow', () => {
      const buffer = new RingBuffer(3, 1);
      buffer.push([1]);
      buffer.push([2]);
      buffer.push([3]);
      buffer.push([4]); // evicts [1]
      buffer.push([5]); // evicts [2]

      expect(buffer.toArray()).toEqual([[3], [4], [5]]);
    });
  });

  // ---------------------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------------------

  describe('clear', () => {
    it('resets length to 0', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      buffer.push([3, 4]);
      buffer.clear();

      expect(buffer.length).toBe(0);
    });

    it('returns empty array from toArray after clear', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      buffer.clear();

      expect(buffer.toArray()).toEqual([]);
    });

    it('returns null from getAt after clear', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      buffer.clear();

      expect(buffer.getAt(0)).toBeNull();
    });

    it('allows new pushes after clear', () => {
      const buffer = new RingBuffer(3, 1);
      buffer.push([1]);
      buffer.push([2]);
      buffer.clear();
      buffer.push([10]);

      expect(buffer.length).toBe(1);
      expect(buffer.getAt(0)).toEqual([10]);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Case: Capacity 1
  // ---------------------------------------------------------------------------

  describe('capacity 1', () => {
    it('holds exactly one entry', () => {
      const buffer = new RingBuffer(1, 2);
      buffer.push([10, 20]);

      expect(buffer.length).toBe(1);
      expect(buffer.getAt(0)).toEqual([10, 20]);
    });

    it('overwrites the single entry on overflow', () => {
      const buffer = new RingBuffer(1, 2);
      buffer.push([10, 20]);
      buffer.push([30, 40]);

      expect(buffer.length).toBe(1);
      expect(buffer.getAt(0)).toEqual([30, 40]);
    });

    it('toArray returns the single entry', () => {
      const buffer = new RingBuffer(1, 1);
      buffer.push([42]);

      expect(buffer.toArray()).toEqual([[42]]);
    });

    it('clears properly', () => {
      const buffer = new RingBuffer(1, 1);
      buffer.push([42]);
      buffer.clear();

      expect(buffer.length).toBe(0);
      expect(buffer.toArray()).toEqual([]);
    });
  });
});
