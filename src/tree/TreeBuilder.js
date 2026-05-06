import { parseAll } from '../api/filenameDecoder.js';

export function buildTree(filenames, pathsIdx) {
  const parsed = parseAll(filenames);

  // ostatni stan każdej ścieżki (chronologicznie) — A=visible, D=hidden
  const latestFlag = new Map();
  const snapshotsByPath = new Map();

  for (const entry of parsed) {
    latestFlag.set(entry.pathId, entry.flag);
    if (!snapshotsByPath.has(entry.pathId)) {
      snapshotsByPath.set(entry.pathId, []);
    }
    snapshotsByPath.get(entry.pathId).push(entry);
  }

  const nodes = [];
  for (const [pathId, flag] of latestFlag) {
    const fullPath = pathsIdx[pathId] ?? null;
    const snapshots = snapshotsByPath.get(pathId) ?? [];
    nodes.push({
      pathId,
      fullPath,
      isOrphan: fullPath === null,
      isDeleted: flag === 'D',
      snapshots,
      latestAt: snapshots.at(-1)?.timestamp ?? null,
    });
  }

  // sortuj: znane ścieżki alfabetycznie, sieroty na końcu
  nodes.sort((a, b) => {
    if (a.isOrphan !== b.isOrphan) return a.isOrphan ? 1 : -1;
    return (a.fullPath ?? a.pathId).localeCompare(b.fullPath ?? b.pathId);
  });

  return nodes;
}

export function groupByRoot(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    const root = node.isOrphan
      ? '__orphans__'
      : '/' + (node.fullPath?.split('/')[1] ?? '');
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(node);
  }
  return groups;
}
