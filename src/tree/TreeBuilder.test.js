import { describe, it, expect } from 'vitest';
import { buildTree, groupByRoot } from './TreeBuilder.js';

const IDX = {
  aB3x9Q2k: '/home/minecraft/world',
  pQ7rT1wZ: '/var/www/mojastrona',
};

describe('buildTree', () => {
  it('returns visible node for active path', () => {
    const filenames = ['U1-2605010600-aB3x9Q2k-A-aa11.enc'];
    const nodes = buildTree(filenames, IDX);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].isDeleted).toBe(false);
    expect(nodes[0].fullPath).toBe('/home/minecraft/world');
  });

  it('marks path deleted when latest flag is D', () => {
    const filenames = [
      'U1-2605010600-aB3x9Q2k-A-aa11.enc',
      'U1-2605020000-aB3x9Q2k-D-bb22.enc',
    ];
    const nodes = buildTree(filenames, IDX);
    expect(nodes[0].isDeleted).toBe(true);
  });

  it('resurrects path when A follows D', () => {
    const filenames = [
      'U1-2605010600-aB3x9Q2k-A-aa11.enc',
      'U1-2605020000-aB3x9Q2k-D-bb22.enc',
      'U1-2605021200-aB3x9Q2k-A-cc33.enc',
    ];
    const nodes = buildTree(filenames, IDX);
    expect(nodes[0].isDeleted).toBe(false);
    expect(nodes[0].snapshots).toHaveLength(3);
  });

  it('marks orphan when pathId not in index', () => {
    const filenames = ['U1-2605010600-ZZorpHan-A-dead.enc'];
    const nodes = buildTree(filenames, IDX);
    expect(nodes[0].isOrphan).toBe(true);
    expect(nodes[0].fullPath).toBeNull();
  });

  it('places orphans after known paths in sorted order', () => {
    const filenames = [
      'U1-2605010600-ZZorpHan-A-dead.enc',
      'U1-2605010600-aB3x9Q2k-A-aa11.enc',
    ];
    const nodes = buildTree(filenames, IDX);
    expect(nodes[0].isOrphan).toBe(false);
    expect(nodes[1].isOrphan).toBe(true);
  });
});

describe('groupByRoot', () => {
  it('groups nodes by first path segment', () => {
    const filenames = [
      'U1-2605010600-aB3x9Q2k-A-aa11.enc',
      'U1-2605010600-pQ7rT1wZ-A-bb22.enc',
    ];
    const nodes = buildTree(filenames, IDX);
    const groups = groupByRoot(nodes);
    expect(groups.has('/home')).toBe(true);
    expect(groups.has('/var')).toBe(true);
  });

  it('puts orphans in __orphans__ group', () => {
    const filenames = ['U1-2605010600-ZZorpHan-A-dead.enc'];
    const nodes = buildTree(filenames, IDX);
    const groups = groupByRoot(nodes);
    expect(groups.has('__orphans__')).toBe(true);
  });
});
