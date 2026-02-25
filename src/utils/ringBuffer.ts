export class RingBuffer {
  private buffer: Float64Array;
  private head: number;
  private count: number;
  private readonly fieldsPerEntry: number;
  private readonly _capacity: number;

  constructor(capacity: number, fieldsPerEntry: number) {
    if (capacity <= 0 || fieldsPerEntry <= 0) {
      throw new RangeError('capacity and fieldsPerEntry must be positive');
    }
    if (!Number.isInteger(capacity) || !Number.isInteger(fieldsPerEntry)) {
      throw new RangeError('capacity and fieldsPerEntry must be integers');
    }
    this._capacity = capacity;
    this.fieldsPerEntry = fieldsPerEntry;
    this.buffer = new Float64Array(capacity * fieldsPerEntry);
    this.head = 0;
    this.count = 0;
  }

  push(entry: number[]): void {
    if (entry.length !== this.fieldsPerEntry) {
      throw new RangeError(
        `entry length (${entry.length}) must equal fieldsPerEntry (${this.fieldsPerEntry})`,
      );
    }
    const offset = this.head * this.fieldsPerEntry;
    for (let i = 0; i < this.fieldsPerEntry; i++) {
      this.buffer[offset + i] = entry[i];
    }
    this.head = (this.head + 1) % this._capacity;
    if (this.count < this._capacity) {
      this.count++;
    }
  }

  getAt(index: number): number[] | null {
    if (index < 0 || index >= this.count) {
      return null;
    }

    // Oldest entry starts at (head - count) wrapped around
    const actualIndex = (this.head - this.count + index + this._capacity) % this._capacity;
    const offset = actualIndex * this.fieldsPerEntry;
    const entry: number[] = [];

    for (let i = 0; i < this.fieldsPerEntry; i++) {
      entry.push(this.buffer[offset + i]);
    }

    return entry;
  }

  toArray(): number[][] {
    const result: number[][] = [];

    for (let i = 0; i < this.count; i++) {
      const entry = this.getAt(i);
      if (entry !== null) {
        result.push(entry);
      }
    }

    return result;
  }

  /**
   * Returns a single field value from the entry at the given index.
   * Zero-allocation alternative to getAt() — no array is created.
   *
   * @param entryIndex - Logical index (0 = oldest, length-1 = newest)
   * @param fieldIndex - Field offset within the entry (0-based)
   * @returns The field value, or null if index is out of range
   */
  getField(entryIndex: number, fieldIndex: number): number | null {
    if (entryIndex < 0 || entryIndex >= this.count) return null;
    if (fieldIndex < 0 || fieldIndex >= this.fieldsPerEntry) return null;

    const actualIndex = (this.head - this.count + entryIndex + this._capacity) % this._capacity;
    return this.buffer[actualIndex * this.fieldsPerEntry + fieldIndex];
  }

  /**
   * Reads an entire entry into a pre-allocated output array.
   * Zero-allocation alternative to getAt() — caller reuses the same array.
   *
   * @param entryIndex - Logical index (0 = oldest, length-1 = newest)
   * @param out - Pre-allocated array to write field values into
   * @returns true if read succeeded, false if index is out of range
   */
  readInto(entryIndex: number, out: number[]): boolean {
    if (entryIndex < 0 || entryIndex >= this.count) return false;

    const actualIndex = (this.head - this.count + entryIndex + this._capacity) % this._capacity;
    const offset = actualIndex * this.fieldsPerEntry;
    for (let i = 0; i < this.fieldsPerEntry; i++) {
      out[i] = this.buffer[offset + i];
    }
    return true;
  }

  get length(): number {
    return this.count;
  }

  get capacity(): number {
    return this._capacity;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
    this.buffer.fill(0);
  }
}
