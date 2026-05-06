import { describe, it, expect } from 'vitest';
import { parseFilename, parseAll } from './filenameDecoder.js';

describe('parseFilename', () => {
  it('parses canonical example', () => {
    const p = parseFilename('U1-2605021200-aB3x9Q2k-A-f8c2.enc');
    expect(p.userId).toBe('U1');
    expect(p.pathId).toBe('aB3x9Q2k');
    expect(p.flag).toBe('A');
    expect(p.shortHash).toBe('f8c2');
    expect(p.timestamp.toISOString()).toBe('2026-05-02T12:00:00.000Z');
  });

  it('parses D flag', () => {
    const p = parseFilename('U1-2605021200-aB3x9Q2k-D-0000.enc');
    expect(p.flag).toBe('D');
  });

  it('returns null for invalid names', () => {
    expect(parseFilename('notafile.txt')).toBeNull();
    expect(parseFilename('U1-260502120-aB3x9Q2k-A-f8c2.enc')).toBeNull();
    expect(parseFilename('')).toBeNull();
    expect(parseFilename(null)).toBeNull();
  });

  it('parseAll sorts by timestamp', () => {
    const list = [
      'U1-2605021200-aB3x9Q2k-A-0000.enc',
      'U1-2605020600-aB3x9Q2k-A-1111.enc',
      'U1-2605021800-aB3x9Q2k-A-2222.enc',
    ];
    const parsed = parseAll(list);
    expect(parsed[0].timestamp < parsed[1].timestamp).toBe(true);
    expect(parsed[1].timestamp < parsed[2].timestamp).toBe(true);
  });
});
