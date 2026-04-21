/**
 * ringBuffer.js — Fixed-size circular buffer
 *
 * Used by the temporal smoother to keep the last N detection
 * frames for majority-vote stabilization.
 */

class RingBuffer {
  /**
   * @param {number} capacity  Maximum items stored
   */
  constructor(capacity) {
    this._capacity = capacity;
    this._buffer = [];
    this._index = 0;
    this._full = false;
  }

  /**
   * Push a value into the buffer. Overwrites oldest when full.
   * @param {*} value
   */
  push(value) {
    if (this._full) {
      this._buffer[this._index] = value;
    } else {
      this._buffer.push(value);
    }
    this._index = (this._index + 1) % this._capacity;
    if (this._buffer.length >= this._capacity) {
      this._full = true;
    }
  }

  /**
   * Returns all items currently in the buffer (oldest first).
   * @returns {Array}
   */
  getAll() {
    if (!this._full) return this._buffer.slice();
    // Reorder: oldest is at _index, newest is at _index - 1
    return [
      ...this._buffer.slice(this._index),
      ...this._buffer.slice(0, this._index)
    ];
  }

  /**
   * Number of items currently stored.
   * @returns {number}
   */
  get length() {
    return this._buffer.length;
  }

  /**
   * Clear all stored items.
   */
  clear() {
    this._buffer = [];
    this._index = 0;
    this._full = false;
  }
}
