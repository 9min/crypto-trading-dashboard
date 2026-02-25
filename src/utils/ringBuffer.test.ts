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
  // getField (zero-allocation single field access)
  // ---------------------------------------------------------------------------

  describe('getField', () => {
    it('returns the correct field value', () => {
      const buffer = new RingBuffer(5, 3);
      buffer.push([10, 20, 30]);
      buffer.push([40, 50, 60]);

      expect(buffer.getField(0, 0)).toBe(10);
      expect(buffer.getField(0, 1)).toBe(20);
      expect(buffer.getField(0, 2)).toBe(30);
      expect(buffer.getField(1, 0)).toBe(40);
      expect(buffer.getField(1, 2)).toBe(60);
    });

    it('returns null for negative entry index', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      expect(buffer.getField(-1, 0)).toBeNull();
    });

    it('returns null for entry index >= length', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      expect(buffer.getField(1, 0)).toBeNull();
      expect(buffer.getField(5, 0)).toBeNull();
    });

    it('returns null for negative field index', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      expect(buffer.getField(0, -1)).toBeNull();
    });

    it('returns null for field index >= fieldsPerEntry', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      expect(buffer.getField(0, 2)).toBeNull();
    });

    it('returns null on empty buffer', () => {
      const buffer = new RingBuffer(5, 2);
      expect(buffer.getField(0, 0)).toBeNull();
    });

    it('returns correct values after overflow', () => {
      const buffer = new RingBuffer(2, 2);
      buffer.push([1, 2]);
      buffer.push([3, 4]);
      buffer.push([5, 6]); // evicts [1, 2]

      // index 0 is now [3, 4], index 1 is [5, 6]
      expect(buffer.getField(0, 0)).toBe(3);
      expect(buffer.getField(0, 1)).toBe(4);
      expect(buffer.getField(1, 0)).toBe(5);
      expect(buffer.getField(1, 1)).toBe(6);
    });
  });

  // ---------------------------------------------------------------------------
  // readInto (zero-allocation full entry access)
  // ---------------------------------------------------------------------------

  describe('readInto', () => {
    it('reads entry into pre-allocated array', () => {
      const buffer = new RingBuffer(5, 3);
      buffer.push([10, 20, 30]);
      buffer.push([40, 50, 60]);

      const out = [0, 0, 0];
      expect(buffer.readInto(0, out)).toBe(true);
      expect(out).toEqual([10, 20, 30]);

      expect(buffer.readInto(1, out)).toBe(true);
      expect(out).toEqual([40, 50, 60]);
    });

    it('returns false for negative index', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      const out = [0, 0];
      expect(buffer.readInto(-1, out)).toBe(false);
    });

    it('returns false for index >= length', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([1, 2]);
      const out = [0, 0];
      expect(buffer.readInto(1, out)).toBe(false);
    });

    it('returns false on empty buffer', () => {
      const buffer = new RingBuffer(5, 2);
      const out = [0, 0];
      expect(buffer.readInto(0, out)).toBe(false);
    });

    it('reuses the same output array across multiple reads', () => {
      const buffer = new RingBuffer(5, 2);
      buffer.push([10, 20]);
      buffer.push([30, 40]);
      buffer.push([50, 60]);

      const out = [0, 0];

      buffer.readInto(0, out);
      expect(out).toEqual([10, 20]);

      buffer.readInto(1, out);
      expect(out).toEqual([30, 40]);

      buffer.readInto(2, out);
      expect(out).toEqual([50, 60]);
    });

    it('reads correctly after overflow', () => {
      const buffer = new RingBuffer(2, 2);
      buffer.push([1, 2]);
      buffer.push([3, 4]);
      buffer.push([5, 6]); // evicts [1, 2]

      const out = [0, 0];
      buffer.readInto(0, out);
      expect(out).toEqual([3, 4]);

      buffer.readInto(1, out);
      expect(out).toEqual([5, 6]);
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
